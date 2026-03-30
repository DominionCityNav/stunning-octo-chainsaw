import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

let blastType = 'text';
let blastMediaRecorder = null;
let blastAudioChunks = [];

function setBlastType(type) {
  blastType = type;
  document.querySelectorAll('.blast-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  const textSection = document.getElementById('blast-text-section');
  const audioSection = document.getElementById('blast-audio-section');

  if (textSection) textSection.style.display = type === 'text' ? 'block' : 'none';
  if (audioSection) audioSection.style.display = type === 'audio' ? 'block' : 'none';
}

async function toggleBlastRecording() {
  const recordBtn = document.getElementById('blast-record-btn');

  if (blastMediaRecorder && blastMediaRecorder.state === 'recording') {
    blastMediaRecorder.stop();
    if (recordBtn) recordBtn.textContent = 'Record';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    blastMediaRecorder = new MediaRecorder(stream);
    blastAudioChunks = [];

    blastMediaRecorder.ondataavailable = (e) => {
      blastAudioChunks.push(e.data);
    };

    blastMediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const preview = document.getElementById('blast-audio-preview');
      if (preview && blastAudioChunks.length > 0) {
        const blob = new Blob(blastAudioChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        preview.innerHTML = `<audio controls src="${url}"></audio>`;
        preview.style.display = 'block';
      }
    };

    blastMediaRecorder.start();
    if (recordBtn) recordBtn.textContent = 'Stop Recording';
  } catch (err) {
    alert('Could not access microphone.');
    auditLog('error', 'blast_record_error', { message: err.message });
  }
}

async function sendBlast() {
  if (!db || !APP.member) return;

  let content = '';
  let audioUrl = null;

  if (blastType === 'text') {
    const input = document.getElementById('blast-text-input');
    content = input ? input.value.trim() : '';
    if (!content) {
      alert('Please write something to blast.');
      return;
    }
  } else if (blastType === 'audio') {
    if (!blastAudioChunks.length) {
      alert('Please record an audio message first.');
      return;
    }

    const blob = new Blob(blastAudioChunks, { type: 'audio/webm' });
    const path = `blasts/${Date.now()}-${APP.member.id}.webm`;

    try {
      const { error: uploadErr } = await db.storage.from('audio').upload(path, blob);
      if (uploadErr) {
        alert('Audio upload failed.');
        auditLog('error', 'blast_audio_upload_error', { message: uploadErr.message });
        return;
      }
      const { data } = db.storage.from('audio').getPublicUrl(path);
      audioUrl = data.publicUrl;
      content = '[Audio Blast]';
    } catch (err) {
      alert('Audio upload failed.');
      auditLog('error', 'blast_audio_upload_error', { message: err.message });
      return;
    }
  }

  try {
    const { error } = await db.from('blasts').insert({
      content,
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      photo_url: APP.member.photo_url || null,
      audio_url: audioUrl,
      type: blastType,
      reactions: {},
      reply_count: 0,
    });

    if (error) {
      alert('Failed to send blast.');
      auditLog('error', 'send_blast_error', { message: error.message });
      return;
    }

    // Clear form
    const textInput = document.getElementById('blast-text-input');
    if (textInput) textInput.value = '';
    blastAudioChunks = [];
    const preview = document.getElementById('blast-audio-preview');
    if (preview) {
      preview.innerHTML = '';
      preview.style.display = 'none';
    }

    auditLog('info', 'blast_sent', { type: blastType });
    loadBlastFeed();
  } catch (err) {
    auditLog('error', 'send_blast_error', { message: err.message });
  }
}

async function loadBlastFeed() {
  if (!db) return;
  const container = document.getElementById('blast-feed');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('blasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No blasts yet. Be the first!</div>';
      return;
    }

    container.innerHTML = data.map((blast) => {
      const avatar = blast.photo_url
        ? `<img src="${escHtml(blast.photo_url)}" class="blast-avatar" alt="">`
        : `<div class="blast-avatar-placeholder">${escHtml(blast.member_name || 'M').charAt(0)}</div>`;

      const audioHtml = blast.audio_url
        ? `<audio controls src="${escHtml(blast.audio_url)}" class="blast-audio"></audio>`
        : '';

      return `
        <div class="blast-card" id="blast-${blast.id}">
          <div class="blast-header">
            ${avatar}
            <div class="blast-author">
              <span class="blast-name">${escHtml(blast.member_name)}</span>
              <span class="blast-time">${timeAgo(blast.created_at)}</span>
            </div>
          </div>
          ${blast.type !== 'audio' ? `<div class="blast-content">${escHtml(blast.content)}</div>` : ''}
          ${audioHtml}
          <div class="blast-actions">
            <button class="blast-react-btn" onclick="reactToBlast('${blast.id}')">React</button>
            <button class="blast-reply-btn" onclick="toggleBlastReply('${blast.id}')">
              Reply (${blast.reply_count || 0})
            </button>
          </div>
          <div class="blast-replies" id="blast-replies-${blast.id}" style="display:none;"></div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_blast_feed_error', { message: err.message });
  }
}

function reactToBlast(blastId) {
  const { toggleReactionPicker } = window;
  if (toggleReactionPicker) {
    toggleReactionPicker(blastId, 'blast');
  }
}

function toggleBlastReply(blastId) {
  const container = document.getElementById('blast-replies-' + blastId);
  if (!container) return;

  const isVisible = container.style.display !== 'none';
  if (isVisible) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';

  // Add reply input if not present
  if (!container.querySelector('.blast-reply-input')) {
    container.insertAdjacentHTML('beforeend', `
      <div class="blast-reply-form">
        <input type="text" class="blast-reply-input" placeholder="Type a reply..." id="blast-reply-input-${blastId}">
        <button class="blast-reply-send" onclick="submitBlastReply('${blastId}')">Send</button>
      </div>`);
  }

  loadBlastReplies(blastId);
}

async function submitBlastReply(blastId) {
  if (!db || !APP.member) return;

  const input = document.getElementById('blast-reply-input-' + blastId);
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  try {
    const { error } = await db.from('blast_replies').insert({
      blast_id: blastId,
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      content,
    });

    if (error) {
      auditLog('error', 'submit_blast_reply_error', { message: error.message });
      return;
    }

    // Increment reply count
    const { data: blast } = await db
      .from('blasts')
      .select('reply_count')
      .eq('id', blastId)
      .single();

    if (blast) {
      await db.from('blasts')
        .update({ reply_count: (blast.reply_count || 0) + 1 })
        .eq('id', blastId);
    }

    loadBlastReplies(blastId);
  } catch (err) {
    auditLog('error', 'submit_blast_reply_error', { message: err.message });
  }
}

async function loadBlastReplies(blastId) {
  if (!db) return;
  const container = document.getElementById('blast-replies-' + blastId);
  if (!container) return;

  try {
    const { data, error } = await db
      .from('blast_replies')
      .select('*')
      .eq('blast_id', blastId)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error || !data || data.length === 0) {
      // Keep the form, just show no replies
      const form = container.querySelector('.blast-reply-form');
      container.innerHTML = '<div class="empty-state small">No replies yet.</div>';
      if (form) container.appendChild(form);
      return;
    }

    const form = container.querySelector('.blast-reply-form');
    const repliesHtml = data.map((r) => `
      <div class="blast-reply">
        <span class="blast-reply-name">${escHtml(r.member_name)}</span>
        <span class="blast-reply-text">${escHtml(r.content)}</span>
        <span class="blast-reply-time">${timeAgo(r.created_at)}</span>
      </div>`).join('');

    container.innerHTML = repliesHtml;
    if (form) container.appendChild(form);
  } catch (err) {
    auditLog('error', 'load_blast_replies_error', { message: err.message });
  }
}

async function loadHomeBlastPreview() {
  if (!db) return;
  const container = document.getElementById('home-blast-preview');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('blasts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(3);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state small">No recent blasts.</div>';
      return;
    }

    container.innerHTML = data.map((blast) => `
      <div class="blast-preview-card" onclick="switchTab('blasts')">
        <span class="blast-preview-name">${escHtml(blast.member_name)}</span>
        <span class="blast-preview-text">${escHtml((blast.content || '').substring(0, 60))}${blast.content?.length > 60 ? '...' : ''}</span>
        <span class="blast-preview-time">${timeAgo(blast.created_at)}</span>
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_home_blast_preview_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.setBlastType = setBlastType;
window.toggleBlastRecording = toggleBlastRecording;
window.sendBlast = sendBlast;
window.loadBlastFeed = loadBlastFeed;
window.reactToBlast = reactToBlast;
window.toggleBlastReply = toggleBlastReply;
window.submitBlastReply = submitBlastReply;
window.loadBlastReplies = loadBlastReplies;
window.loadHomeBlastPreview = loadHomeBlastPreview;

export {
  setBlastType,
  toggleBlastRecording,
  sendBlast,
  loadBlastFeed,
  reactToBlast,
  toggleBlastReply,
  submitBlastReply,
  loadBlastReplies,
  loadHomeBlastPreview,
};
