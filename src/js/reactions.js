import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';

const SKIN_TONES = ['', '\u{1F3FB}', '\u{1F3FC}', '\u{1F3FD}', '\u{1F3FE}', '\u{1F3FF}'];

const REACTION_LABELS = {
  '\u{1F64F}': 'Pray',
  '\u2764\uFE0F': 'Love',
  '\u{1F525}': 'Fire',
  '\u{1F64C}': 'Praise',
  '\u{1F622}': 'Crying',
  '\u{1F4AA}': 'Strength',
  '\u270C\uFE0F': 'Peace',
  '\u{1F60D}': 'Heart Eyes',
};

let activeReactionTarget = null;

function toggleReactionPicker(targetId, targetType) {
  const picker = document.getElementById('reaction-picker');
  if (!picker) return;

  if (picker.style.display === 'flex' && activeReactionTarget === targetId) {
    picker.style.display = 'none';
    activeReactionTarget = null;
    return;
  }

  activeReactionTarget = targetId;
  picker.dataset.targetId = targetId;
  picker.dataset.targetType = targetType;

  picker.innerHTML = Object.entries(REACTION_LABELS).map(([emoji, label]) =>
    `<button class="reaction-btn" onclick="pickReaction('${emoji}')" title="${label}">${emoji}</button>`
  ).join('');

  picker.style.display = 'flex';

  // Position near target
  const targetEl = document.getElementById(targetType + '-' + targetId);
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    picker.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    picker.style.left = rect.left + 'px';
  }
}

function pickReaction(emoji) {
  const picker = document.getElementById('reaction-picker');
  if (!picker) return;

  const targetId = picker.dataset.targetId;
  const targetType = picker.dataset.targetType;

  // Check if this emoji supports skin tones
  const skinToneEmojis = ['\u{1F64F}', '\u{1F64C}', '\u{1F4AA}', '\u270C\uFE0F'];
  if (skinToneEmojis.includes(emoji)) {
    showSkinPicker(emoji, targetId, targetType);
  } else {
    saveReaction(emoji, targetId, targetType);
  }

  picker.style.display = 'none';
  activeReactionTarget = null;
}

function showSkinPicker(baseEmoji, targetId, targetType) {
  const picker = document.getElementById('reaction-picker');
  if (!picker) return;

  picker.innerHTML = SKIN_TONES.map((tone) =>
    `<button class="reaction-btn skin-tone" onclick="saveReaction('${baseEmoji}${tone}', '${targetId}', '${targetType}')">${baseEmoji}${tone}</button>`
  ).join('');

  picker.style.display = 'flex';
}

async function saveReaction(emoji, targetId, targetType) {
  const picker = document.getElementById('reaction-picker');
  if (picker) picker.style.display = 'none';

  if (!db || !APP.member) return;

  try {
    const { error } = await db.from('reactions').upsert({
      target_id: targetId,
      target_type: targetType,
      member_id: APP.member.id,
      emoji,
    }, {
      onConflict: 'target_id,target_type,member_id',
    });

    if (error) {
      auditLog('error', 'save_reaction_error', { message: error.message });
    } else {
      auditLog('info', 'reaction_saved', { emoji, target_id: targetId, target_type: targetType });

      // Update UI inline
      const targetEl = document.getElementById(targetType + '-' + targetId);
      if (targetEl) {
        let reactionsEl = targetEl.querySelector('.reactions-row');
        if (!reactionsEl) {
          reactionsEl = document.createElement('div');
          reactionsEl.className = 'reactions-row';
          targetEl.appendChild(reactionsEl);
        }
        // Reload reactions for this target
        loadReactionsFor(targetId, targetType, reactionsEl);
      }
    }
  } catch (err) {
    auditLog('error', 'save_reaction_error', { message: err.message });
  }
}

async function loadReactionsFor(targetId, targetType, container) {
  if (!db) return;

  try {
    const { data, error } = await db
      .from('reactions')
      .select('emoji')
      .eq('target_id', targetId)
      .eq('target_type', targetType);

    if (error || !data || data.length === 0) {
      container.innerHTML = '';
      return;
    }

    // Count each emoji
    const counts = {};
    data.forEach((r) => {
      counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    });

    container.innerHTML = Object.entries(counts).map(([emoji, count]) =>
      `<span class="reaction-chip">${emoji} ${count}</span>`
    ).join('');
  } catch {
    /* Silent */
  }
}

// Long-press support for mobile
let longPressTimer = null;

document.addEventListener('touchstart', (e) => {
  const msgEl = e.target.closest('.chat-msg, .feed-post, .community-post, .blast-card');
  if (!msgEl) return;

  longPressTimer = setTimeout(() => {
    const id = msgEl.id.split('-').slice(1).join('-');
    const type = msgEl.classList.contains('chat-msg') ? 'msg'
      : msgEl.classList.contains('feed-post') ? 'feed-post'
      : msgEl.classList.contains('community-post') ? 'community-post'
      : 'blast';
    toggleReactionPicker(id, type);
  }, 500);
});

document.addEventListener('touchend', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

document.addEventListener('touchmove', () => {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

// Attach to window for HTML onclick handlers
window.toggleReactionPicker = toggleReactionPicker;
window.pickReaction = pickReaction;
window.showSkinPicker = showSkinPicker;
window.saveReaction = saveReaction;

export {
  SKIN_TONES,
  REACTION_LABELS,
  toggleReactionPicker,
  pickReaction,
  showSkinPicker,
  saveReaction,
};
