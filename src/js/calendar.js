import { APP } from './state.js';
import db from './supabase.js';
import { auditLog } from './audit.js';
import { escHtml } from './utils.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildCalendar() {
  const container = document.getElementById('calendar-grid');
  if (!container) return;

  buildCalendarInGrid(container, APP.calYear, APP.calMonth);

  const label = document.getElementById('calendar-month-label');
  if (label) {
    label.textContent = MONTH_NAMES[APP.calMonth] + ' ' + APP.calYear;
  }
}

export function buildCalendarInGrid(container, year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  let html = '<div class="cal-header-row">';
  DAY_NAMES.forEach((d) => {
    html += `<div class="cal-day-name">${d}</div>`;
  });
  html += '</div><div class="cal-body">';

  // Blank cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-cell empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === todayDate;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    html += `
      <div class="cal-cell ${isToday ? 'today' : ''}" onclick="showDayEvents('${dateStr}')">
        <span class="cal-date">${day}</span>
      </div>`;
  }

  html += '</div>';
  container.innerHTML = html;
}

export function calNav(dir) {
  APP.calMonth += dir;
  if (APP.calMonth > 11) {
    APP.calMonth = 0;
    APP.calYear++;
  } else if (APP.calMonth < 0) {
    APP.calMonth = 11;
    APP.calYear--;
  }
  buildCalendar();
}

export function calNav2(dir) {
  if (APP.cal2Month === null) {
    APP.cal2Year = APP.calYear;
    APP.cal2Month = APP.calMonth;
  }

  APP.cal2Month += dir;
  if (APP.cal2Month > 11) {
    APP.cal2Month = 0;
    APP.cal2Year++;
  } else if (APP.cal2Month < 0) {
    APP.cal2Month = 11;
    APP.cal2Year--;
  }

  const container = document.getElementById('calendar2-grid');
  if (container) {
    buildCalendarInGrid(container, APP.cal2Year, APP.cal2Month);
  }

  const label = document.getElementById('calendar2-month-label');
  if (label) {
    label.textContent = MONTH_NAMES[APP.cal2Month] + ' ' + APP.cal2Year;
  }
}

export async function showDayEvents(dateStr) {
  const container = document.getElementById('day-events');
  if (!container) return;

  container.style.display = 'block';

  const dateLabel = document.getElementById('day-events-date');
  if (dateLabel) {
    const d = new Date(dateStr + 'T12:00:00');
    dateLabel.textContent = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const list = document.getElementById('day-events-list');
  if (!list) return;

  if (!db) {
    list.innerHTML = '<div class="empty-state">Database not available.</div>';
    return;
  }

  try {
    const { data, error } = await db
      .from('events')
      .select('*')
      .eq('event_date', dateStr)
      .order('time', { ascending: true });

    if (error || !data || data.length === 0) {
      list.innerHTML = '<div class="empty-state">No events on this day.</div>';
      return;
    }

    list.innerHTML = data.map((evt) => `
      <div class="day-event-card">
        <div class="day-event-title">${escHtml(evt.title)}</div>
        ${evt.time ? `<div class="day-event-time">${escHtml(evt.time)}</div>` : ''}
        ${evt.description ? `<div class="day-event-desc">${escHtml(evt.description)}</div>` : ''}
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'show_day_events_error', { message: err.message });
    list.innerHTML = '<div class="empty-state">Could not load events.</div>';
  }
}

// Attach to window for HTML onclick handlers
window.calNav = calNav;
window.calNav2 = calNav2;
window.showDayEvents = showDayEvents;
window.buildCalendar = buildCalendar;

export { MONTH_NAMES, DAY_NAMES };
