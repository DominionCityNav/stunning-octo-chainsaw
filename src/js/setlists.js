import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function showCreateSetlist() {
  const form = document.getElementById('setlist-form');
  if (!form) return;

  form.style.display = form.style.display === 'block' ? 'none' : 'block';

  if (form.style.display === 'block') {
    form.innerHTML = `
      <div class="setlist-create">
        <input type="text" id="setlist-title" class="input" placeholder="Setlist title (e.g. Sunday Worship 3/30)">
        <input type="date" id="setlist-date" class="input">
        <div id="setlist-songs">
          <div class="song-row">
            <input type="text" class="input song-title" placeholder="Song title">
            <input type="text" class="input song-key" placeholder="Key">
            <input type="text" class="input song-notes" placeholder="Notes">
          </div>
        </div>
        <button class="btn-secondary" onclick="addSongRow()">+ Add Song</button>
        <button class="btn-primary" onclick="saveSetlist()">Save Setlist</button>
      </div>`;
  }
}

function addSongRow() {
  const container = document.getElementById('setlist-songs');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'song-row';
  row.innerHTML = `
    <input type="text" class="input song-title" placeholder="Song title">
    <input type="text" class="input song-key" placeholder="Key">
    <input type="text" class="input song-notes" placeholder="Notes">`;
  container.appendChild(row);
}

async function saveSetlist() {
  if (!db || !APP.member) return;

  const title = document.getElementById('setlist-title')?.value.trim();
  const date = document.getElementById('setlist-date')?.value;

  if (!title) {
    alert('Please enter a setlist title.');
    return;
  }

  const songRows = document.querySelectorAll('#setlist-songs .song-row');
  const songs = [];
  songRows.forEach((row) => {
    const songTitle = row.querySelector('.song-title')?.value.trim();
    const key = row.querySelector('.song-key')?.value.trim();
    const notes = row.querySelector('.song-notes')?.value.trim();
    if (songTitle) {
      songs.push({ title: songTitle, key: key || '', notes: notes || '' });
    }
  });

  if (songs.length === 0) {
    alert('Please add at least one song.');
    return;
  }

  try {
    const { error } = await db.from('setlists').insert({
      title,
      date: date || null,
      songs,
      created_by: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
    });

    if (error) {
      alert('Failed to save setlist.');
      auditLog('error', 'save_setlist_error', { message: error.message });
      return;
    }

    alert('Setlist saved!');
    const form = document.getElementById('setlist-form');
    if (form) form.style.display = 'none';
    auditLog('info', 'setlist_saved', { title });
    loadSetlists();
  } catch (err) {
    alert('Failed to save setlist.');
    auditLog('error', 'save_setlist_error', { message: err.message });
  }
}

async function loadSetlists() {
  if (!db) return;
  const container = document.getElementById('setlists-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('setlists')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No setlists yet.</div>';
      return;
    }

    container.innerHTML = data.map((sl) => {
      const songs = Array.isArray(sl.songs) ? sl.songs : [];
      return `
        <div class="setlist-card">
          <div class="setlist-header">
            <div class="setlist-title">${escHtml(sl.title)}</div>
            <div class="setlist-meta">
              ${sl.date ? `<span>${sl.date}</span>` : ''}
              <span>by ${escHtml(sl.member_name || 'Unknown')}</span>
              <span>${timeAgo(sl.created_at)}</span>
            </div>
          </div>
          <div class="setlist-songs">
            ${songs.map((s, i) => `
              <div class="setlist-song">
                <span class="song-num">${i + 1}.</span>
                <span class="song-title">${escHtml(s.title)}</span>
                ${s.key ? `<span class="song-key">${escHtml(s.key)}</span>` : ''}
                ${s.notes ? `<span class="song-notes">${escHtml(s.notes)}</span>` : ''}
              </div>`).join('')}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_setlists_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.showCreateSetlist = showCreateSetlist;
window.addSongRow = addSongRow;
window.saveSetlist = saveSetlist;
window.loadSetlists = loadSetlists;

export { showCreateSetlist, addSongRow, saveSetlist, loadSetlists };
