import db from './supabase.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

export async function loadAnnouncements() {
  if (!db) return;
  const container = document.getElementById('announcements-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('announcements')
      .select('*')
      .eq('approved', true)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No announcements right now.</div>';
      return;
    }

    container.innerHTML = data.map((a) => `
      <div class="announcement-card">
        <div class="announcement-title">${escHtml(a.title)}</div>
        <div class="announcement-text">${escHtml(a.content)}</div>
        <div class="announcement-time">${timeAgo(a.created_at)}</div>
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_announcements_error', { message: err.message });
  }
}

export async function loadEvents() {
  if (!db) return;
  const container = document.getElementById('events-list');
  if (!container) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('events')
      .select('*')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No upcoming events.</div>';
      return;
    }

    container.innerHTML = data.map((evt) => {
      const date = new Date(evt.event_date);
      const dateStr = date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      return `
        <div class="event-card">
          <div class="event-date">${dateStr}</div>
          <div class="event-info">
            <div class="event-title">${escHtml(evt.title)}</div>
            ${evt.time ? `<div class="event-time">${escHtml(evt.time)}</div>` : ''}
            ${evt.description ? `<div class="event-desc">${escHtml(evt.description)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_events_error', { message: err.message });
  }
}
