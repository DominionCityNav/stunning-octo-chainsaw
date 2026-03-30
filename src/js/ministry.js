import db from './supabase.js';
import { APP, ROOMS } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo, getMonday } from './utils.js';

export function renderMinistryRooms() {
  const container = document.getElementById('ministry-rooms-list');
  if (!container) return;

  let html = '';
  for (const [key, room] of Object.entries(ROOMS)) {
    const isMember = APP.member?.ministries?.includes(key);
    html += `
      <div class="room-card ${isMember ? 'member' : ''}" onclick="openRoom('${key}')">
        <div class="room-icon">${room.icon}</div>
        <div class="room-info">
          <div class="room-name">${escHtml(room.name)}</div>
          <div class="room-sub">${escHtml(room.sub)}</div>
        </div>
        ${isMember ? '<div class="room-badge">Member</div>' : ''}
      </div>`;
  }
  container.innerHTML = html;
}

export function openRoom(roomKey) {
  const room = ROOMS[roomKey];
  if (!room) return;

  APP.currentRoom = roomKey;
  APP.currentRoomTab = 'chat';

  const overlay = document.getElementById('overlay-room');
  if (!overlay) return;

  const header = overlay.querySelector('.room-header-title');
  if (header) header.textContent = room.icon + ' ' + room.name;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'room';

  switchRoomTab('chat');
  loadRoomMessages();
  loadRoomPhotos();
}

export function closeRoom() {
  APP.currentRoom = null;
  const overlay = document.getElementById('overlay-room');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'room') {
    APP.activeOverlay = null;
  }
}

export function switchRoomTab(tab) {
  APP.currentRoomTab = tab;

  document.querySelectorAll('.room-tab-content').forEach((el) => {
    el.classList.remove('active');
  });
  document.querySelectorAll('.room-tab-btn').forEach((el) => {
    el.classList.remove('active');
  });

  const tabEl = document.getElementById('room-tab-' + tab);
  if (tabEl) tabEl.classList.add('active');

  const btn = document.querySelector(`.room-tab-btn[onclick*="'${tab}'"]`);
  if (btn) btn.classList.add('active');

  if (tab === 'chat') loadRoomMessages();
  if (tab === 'photos') loadRoomPhotos();
  if (tab === 'announcements') loadMediaAnnouncements();
  if (tab === 'qotw') loadQOTW();
}

export async function loadQOTW() {
  if (!db) return;
  const container = document.getElementById('qotw-content');
  if (!container) return;

  try {
    const monday = getMonday();
    const { data, error } = await db
      .from('qotw')
      .select('*')
      .eq('week_of', monday)
      .eq('room', APP.currentRoom)
      .single();

    if (error || !data) {
      container.innerHTML = '<div class="empty-state">No question this week yet.</div>';
      return;
    }

    container.innerHTML = `
      <div class="qotw-card">
        <div class="qotw-question">${escHtml(data.question)}</div>
        ${data.scripture ? `<div class="qotw-scripture">${escHtml(data.scripture)}</div>` : ''}
        <div class="qotw-meta">Week of ${data.week_of}</div>
      </div>`;
  } catch (err) {
    auditLog('error', 'load_qotw_error', { message: err.message });
    container.innerHTML = '<div class="empty-state">Could not load question.</div>';
  }
}

export async function loadRoomMessages() {
  if (!db || !APP.currentRoom) return;
  const container = document.getElementById('room-chat-messages');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('room_messages')
      .select('*, members(first_name, last_name, photo_url)')
      .eq('room', APP.currentRoom)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No messages yet. Start the conversation!</div>';
      return;
    }

    container.innerHTML = data.map((msg) => {
      const name = msg.members
        ? escHtml(msg.members.first_name + ' ' + msg.members.last_name)
        : 'Unknown';
      const avatar = msg.members?.photo_url
        ? `<img src="${escHtml(msg.members.photo_url)}" class="chat-avatar" alt="">`
        : `<div class="chat-avatar-placeholder">${name.charAt(0)}</div>`;
      const isOwn = msg.member_id === APP.member?.id;
      const isPastor = APP.member?.role === 'pastor';
      const pinBtn = (isPastor && !msg.pinned)
        ? `<button class="msg-action" onclick="pinMessage('${msg.id}')">Pin</button>`
        : '';
      const deleteBtn = (isOwn || isPastor)
        ? `<button class="msg-action" onclick="deleteChatMessage('${msg.id}')">Delete</button>`
        : '';
      const pinnedBadge = msg.pinned ? '<span class="pinned-badge">Pinned</span>' : '';

      return `
        <div class="chat-msg ${isOwn ? 'own' : ''} ${msg.pinned ? 'pinned' : ''}" id="msg-${msg.id}">
          ${avatar}
          <div class="chat-msg-body">
            <div class="chat-msg-header">
              <span class="chat-msg-name">${name}</span>
              ${pinnedBadge}
              <span class="chat-msg-time">${timeAgo(msg.created_at)}</span>
            </div>
            <div class="chat-msg-text">${escHtml(msg.content)}</div>
            ${msg.image_url ? `<img src="${escHtml(msg.image_url)}" class="chat-msg-image" onclick="openPhotoFull('${escHtml(msg.image_url)}')">` : ''}
            <div class="chat-msg-actions">${pinBtn}${deleteBtn}</div>
          </div>
        </div>`;
    }).join('');

    container.scrollTop = container.scrollHeight;
  } catch (err) {
    auditLog('error', 'load_room_messages_error', { message: err.message });
  }
}

export async function postAnnouncement(content) {
  if (!db || !APP.member || !APP.currentRoom) return;

  try {
    const { error } = await db.from('room_announcements').insert({
      room: APP.currentRoom,
      member_id: APP.member.id,
      content,
    });

    if (error) {
      auditLog('error', 'post_announcement_error', { message: error.message });
      return;
    }

    loadMediaAnnouncements();
  } catch (err) {
    auditLog('error', 'post_announcement_error', { message: err.message });
  }
}

export async function loadMediaAnnouncements() {
  if (!db || !APP.currentRoom) return;
  const container = document.getElementById('room-announcements-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('room_announcements')
      .select('*, members(first_name, last_name)')
      .eq('room', APP.currentRoom)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No announcements yet.</div>';
      return;
    }

    container.innerHTML = data.map((a) => {
      const name = a.members
        ? escHtml(a.members.first_name + ' ' + a.members.last_name)
        : 'Unknown';
      return `
        <div class="announcement-card">
          <div class="announcement-author">${name}</div>
          <div class="announcement-text">${escHtml(a.content)}</div>
          <div class="announcement-time">${timeAgo(a.created_at)}</div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_announcements_error', { message: err.message });
  }
}

export async function pinMessage(msgId) {
  if (!db) return;

  try {
    const { error } = await db
      .from('room_messages')
      .update({ pinned: true })
      .eq('id', msgId);

    if (!error) {
      auditLog('info', 'message_pinned', { message_id: msgId, room: APP.currentRoom });
      loadRoomMessages();
    }
  } catch (err) {
    auditLog('error', 'pin_message_error', { message: err.message });
  }
}

export async function deleteChatMessage(msgId) {
  if (!db) return;
  if (!confirm('Delete this message?')) return;

  try {
    const { error } = await db
      .from('room_messages')
      .delete()
      .eq('id', msgId);

    if (!error) {
      auditLog('info', 'message_deleted', { message_id: msgId, room: APP.currentRoom });
      loadRoomMessages();
    }
  } catch (err) {
    auditLog('error', 'delete_message_error', { message: err.message });
  }
}

export function scrollToPinned() {
  const pinned = document.querySelector('.chat-msg.pinned');
  if (pinned) {
    pinned.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pinned.classList.add('highlight');
    setTimeout(() => pinned.classList.remove('highlight'), 2000);
  }
}

let _roomPhotoFile = null;

export async function loadRoomPhotos() {
  if (!db || !APP.currentRoom) return;
  const container = document.getElementById('room-photos-grid');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('room_photos')
      .select('*')
      .eq('room', APP.currentRoom)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No photos yet — be the first to share!</div>';
      return;
    }

    container.innerHTML = data.map((p) => `
      <div class="photo-thumb" onclick="openPhotoFull('${escHtml(p.photo_url)}','${escHtml((p.caption || '').replace(/'/g, "\\'"))}')">
        <img src="${escHtml(p.photo_url)}" alt="${escHtml(p.caption || '')}" loading="lazy" onerror="this.parentElement.style.display='none'">
        ${p.caption ? `<div class="photo-thumb-caption">${escHtml(p.caption)}</div>` : ''}
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_room_photos_error', { message: err.message });
  }
}

export function openPhotoFull(src, caption) {
  const overlay = document.createElement('div');
  overlay.className = 'photo-fullscreen-overlay';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <img src="${src}" alt="${caption || ''}" class="photo-fullscreen-img">
    ${caption ? `<div class="photo-fullscreen-caption">${caption}</div>` : ''}
    <div class="photo-fullscreen-hint">Tap anywhere to close</div>`;
  document.body.appendChild(overlay);
}

export function previewPhotoUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  _roomPhotoFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById('photo-preview-img');
    if (img) img.src = e.target.result;
    const wrap = document.getElementById('photo-preview-wrap');
    if (wrap) wrap.classList.remove('hidden');
    const btn = document.getElementById('photo-upload-btn');
    if (btn) btn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

export async function uploadRoomPhoto() {
  if (!_roomPhotoFile || !APP.currentRoom || !db || !APP.member?.id) return;

  const btn = document.getElementById('photo-upload-btn');
  const progress = document.getElementById('photo-upload-progress');
  const bar = document.getElementById('photo-progress-bar');
  const pText = document.getElementById('photo-progress-text');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
  if (progress) progress.classList.remove('hidden');
  if (bar) bar.style.width = '20%';

  try {
    const ext = _roomPhotoFile.name.split('.').pop();
    const fileName = `rooms/${APP.currentRoom}/${Date.now()}.${ext}`;
    if (bar) bar.style.width = '40%';
    if (pText) pText.textContent = 'Uploading image...';

    const { error: uploadError } = await db.storage
      .from('room-photos')
      .upload(fileName, _roomPhotoFile, { cacheControl: '3600', upsert: false });

    if (uploadError) throw uploadError;
    if (bar) bar.style.width = '70%';
    if (pText) pText.textContent = 'Saving record...';

    const { data: urlData } = db.storage.from('room-photos').getPublicUrl(fileName);
    const photoUrl = urlData.publicUrl;
    const caption = document.getElementById('photo-caption-input')?.value.trim();

    const { error: dbError } = await db.from('room_photos').insert({
      room: APP.currentRoom,
      member_id: APP.member.id,
      photo_url: photoUrl,
      caption: caption || null,
    });
    if (dbError) throw dbError;

    // If "share to community" is checked, also post to feed_posts
    const shareToCommunity = document.getElementById('photo-share-community')?.checked;
    if (shareToCommunity) {
      await db.from('feed_posts').insert({
        member_id: APP.member.id,
        post_type: 'photo',
        content: caption || null,
        media_url: photoUrl,
        like_count: 0,
        comment_count: 0,
      });
    }

    if (bar) bar.style.width = '100%';
    if (pText) pText.textContent = 'Done!';

    // Reset form
    _roomPhotoFile = null;
    const fileInput = document.getElementById('photo-file-input');
    if (fileInput) fileInput.value = '';
    const previewWrap = document.getElementById('photo-preview-wrap');
    if (previewWrap) previewWrap.classList.add('hidden');
    const captionInput = document.getElementById('photo-caption-input');
    if (captionInput) captionInput.value = '';
    const shareCheck = document.getElementById('photo-share-community');
    if (shareCheck) shareCheck.checked = false;
    if (btn) btn.classList.add('hidden');
    setTimeout(() => { if (progress) progress.classList.add('hidden'); if (bar) bar.style.width = '0%'; }, 1500);

    loadRoomPhotos();
    auditLog('info', 'room_photo_uploaded', { room: APP.currentRoom, shared_to_community: !!shareToCommunity });
  } catch (err) {
    if (pText) pText.textContent = 'Upload failed — try again';
    if (bar) bar.style.width = '0%';
    auditLog('error', 'room_photo_upload_error', { message: err.message });
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Upload Photo \u2726'; }
}

// Attach to window for HTML onclick handlers
window.openRoom = openRoom;
window.closeRoom = closeRoom;
window.switchRoomTab = switchRoomTab;
window.pinMessage = pinMessage;
window.deleteChatMessage = deleteChatMessage;
window.scrollToPinned = scrollToPinned;
window.postAnnouncement = postAnnouncement;
window.renderMinistryRooms = renderMinistryRooms;
window.openPhotoFull = openPhotoFull;
window.previewPhotoUpload = previewPhotoUpload;
window.uploadRoomPhoto = uploadRoomPhoto;

export { renderMinistryRooms as default };
