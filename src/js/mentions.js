import db from './supabase.js';
import { APP } from './state.js';
import { escHtml } from './utils.js';

let mentionMembers = [];
let _mentionVisible = false;

async function loadRoomMembersForMention() {
  if (!db || !APP.currentRoom) return;

  try {
    const { data, error } = await db
      .from('members')
      .select('id, first_name, last_name, photo_url')
      .contains('ministries', [APP.currentRoom]);

    if (!error && data) {
      mentionMembers = data;
    }
  } catch {
    /* Silent */
  }
}

function handleChatKeydown(e) {
  const input = e.target;
  if (!input || input.id !== 'chat-input') return;

  const val = input.value;
  const cursorPos = input.selectionStart;

  // Check for @ trigger
  const textBeforeCursor = val.substring(0, cursorPos);
  const atIndex = textBeforeCursor.lastIndexOf('@');

  if (atIndex === -1 || (atIndex > 0 && textBeforeCursor[atIndex - 1] !== ' ')) {
    closeMentionSuggestions();
    return;
  }

  const query = textBeforeCursor.substring(atIndex + 1).toLowerCase();

  if (query.length === 0) {
    showMentionSuggestions(mentionMembers.slice(0, 10), input, atIndex);
    return;
  }

  const filtered = mentionMembers.filter((m) =>
    (m.first_name + ' ' + m.last_name).toLowerCase().includes(query)
  ).slice(0, 10);

  if (filtered.length > 0) {
    showMentionSuggestions(filtered, input, atIndex);
  } else {
    closeMentionSuggestions();
  }
}

function showMentionSuggestions(members, input, atIndex) {
  let container = document.getElementById('mention-suggestions');
  if (!container) {
    container = document.createElement('div');
    container.id = 'mention-suggestions';
    container.className = 'mention-suggestions';
    input.parentElement.appendChild(container);
  }

  container.innerHTML = members.map((m) => {
    const name = escHtml(m.first_name + ' ' + m.last_name);
    const avatar = m.photo_url
      ? `<img src="${escHtml(m.photo_url)}" class="mention-avatar" alt="">`
      : `<div class="mention-avatar-placeholder">${m.first_name.charAt(0)}</div>`;

    return `
      <div class="mention-item" onclick="insertMention('${m.id}', '${escHtml(m.first_name + ' ' + m.last_name)}', ${atIndex})">
        ${avatar}
        <span class="mention-name">${name}</span>
      </div>`;
  }).join('');

  container.style.display = 'block';
  _mentionVisible = true;
}

function insertMention(memberId, memberName, atIndex) {
  const input = document.getElementById('chat-input');
  if (!input) return;

  const val = input.value;
  const before = val.substring(0, atIndex);
  const afterCursor = val.substring(input.selectionStart);

  input.value = before + '@' + memberName + ' ' + afterCursor;
  input.focus();

  const newCursorPos = atIndex + memberName.length + 2;
  input.setSelectionRange(newCursorPos, newCursorPos);

  closeMentionSuggestions();
}

function closeMentionSuggestions() {
  const container = document.getElementById('mention-suggestions');
  if (container) {
    container.style.display = 'none';
  }
  _mentionVisible = false;
}

// Listen for keyup on chat input
document.addEventListener('keyup', (e) => {
  if (e.target && e.target.id === 'chat-input') {
    handleChatKeydown(e);
  }
});

// Attach to window for HTML onclick handlers
window.handleChatKeydown = handleChatKeydown;
window.showMentionSuggestions = showMentionSuggestions;
window.insertMention = insertMention;
window.closeMentionSuggestions = closeMentionSuggestions;
window.loadRoomMembersForMention = loadRoomMembersForMention;

export {
  handleChatKeydown,
  showMentionSuggestions,
  insertMention,
  closeMentionSuggestions,
  loadRoomMembersForMention,
};
