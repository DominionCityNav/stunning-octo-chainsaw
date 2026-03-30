import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { loadRoomMessages } from './ministry.js';

export async function sendChatMsg() {
  if (!db || !APP.member || !APP.currentRoom) return;

  const input = document.getElementById('chat-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  input.value = '';
  input.disabled = true;

  try {
    const { error } = await db.from('room_messages').insert({
      room: APP.currentRoom,
      member_id: APP.member.id,
      content,
    });

    if (error) {
      auditLog('error', 'send_chat_error', { message: error.message });
      alert('Failed to send message. Please try again.');
      input.value = content;
    } else {
      loadRoomMessages();
    }
  } catch (err) {
    auditLog('error', 'send_chat_error', { message: err.message });
    input.value = content;
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// Attach to window for HTML onclick handlers
window.sendChatMsg = sendChatMsg;
