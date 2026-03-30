import { APP } from './state.js';
import db from './supabase.js';
import { auditLog } from './audit.js';
import { escHtml } from './utils.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Cache of event dates for the currently displayed months
let _eventDates = new Set();

/**
 * Fetch approved event dates for a given month from Supabase.
 * Returns a Set of date strings like "2026-03-15".
 */
async function fetchEventDatesForMonth(year, month) {
  if (!db) return new Set();
  try {
    const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const endDay = new Date(year, month + 1, 0).getDate();
    const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

    const { data, error } = await db
      .from('events')
      .select('event_date')
      .eq('is_public', true)
      .gte('event_date', startDate)
      .lte('event_date', endDate);

    if (error || !data) return new Set();
    return new Set(data.map((e) => e.event_date?.split('T')[0]));
  } catch (err) {
    auditLog('warn', 'fetch_event_dates_error', { message: err.message });
    return new Set();
  }
}

export async function buildCalendar() {
  _eventDates = await fetchEventDatesForMonth(APP.calYear, APP.calMonth);

  const container = document.getElementById('cal-grid');
  if (container) {
    renderCalendarGrid(container, APP.calYear, APP.calMonth, _eventDates);
  }

  const label = document.getElementById('cal-month-label');
  if (label) {
    label.textContent = MONTH_NAMES[APP.calMonth] + ' ' + APP.calYear;
  }
}

export async function buildCalendarInGrid(container, year, month) {
  const dates = await fetchEventDatesForMonth(year, month);
  renderCalendarGrid(container, year, month, dates);
}

function renderCalendarGrid(container, year, month, eventDates) {
  if (!container) return;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDate = today.getDate();

  let html = '';

  // Day name headers
  DAY_NAMES.forEach((d) => {
    html += `<div class="cal-day-label">${d}</div>`;
  });

  // Blank cells before first day
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day other-month"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = isCurrentMonth && day === todayDate;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasEvent = eventDates.has(dateStr);
    const isSunday = new Date(year, month, day).getDay() === 0;

    // Sundays always show as having an event (weekly service)
    const showDot = hasEvent || isSunday;

    const classes = ['cal-day'];
    if (isToday) classes.push('today');
    if (showDot) classes.push('has-event');

    html += `<div class="${classes.join(' ')}" onclick="showDayEvents('${dateStr}')">${day}</div>`;
  }

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

export async function calNav2(dir) {
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

  const container = document.getElementById('cal-grid-2');
  if (container) {
    await buildCalendarInGrid(container, APP.cal2Year, APP.cal2Month);
  }

  const label = document.getElementById('cal-month-label-2');
  if (label) {
    label.textContent = MONTH_NAMES[APP.cal2Month] + ' ' + APP.cal2Year;
  }
}

export async function showDayEvents(dateStr) {
  // Remove existing popup
  const existing = document.getElementById('day-events-popup');
  if (existing) existing.remove();

  // Highlight selected day
  document.querySelectorAll('.cal-day.selected').forEach((el) => el.classList.remove('selected'));
  const clicked = event?.target?.closest('.cal-day');
  if (clicked) clicked.classList.add('selected');

  const dateObj = new Date(dateStr + 'T12:00:00');
  const dateLabel = dateObj.toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  const isSunday = dateObj.getDay() === 0;

  let eventsHtml = '';

  // Always show Sunday service
  if (isSunday) {
    const dayNum = dateObj.getDate();
    eventsHtml += `
      <div class="event-list-item">
        <div class="event-date-box"><div class="ev-month">SUN</div><div class="ev-day">${dayNum}</div></div>
        <div class="event-info">
          <div class="event-info-title">Sunday Morning Service</div>
          <div class="event-info-detail">9:00 AM &middot; 625 Blackshear St &middot; All welcome</div>
          <button class="remind-btn" onclick="setReminder(this,'Sunday Service')">&#x1F514; Remind Me</button>
        </div>
      </div>`;
  }

  // Fetch real events for this date
  if (db) {
    try {
      const { data } = await db
        .from('events')
        .select('*')
        .eq('is_public', true)
        .gte('event_date', dateStr)
        .lt('event_date', dateStr + 'T23:59:59');

      if (data?.length) {
        data.forEach((evt) => {
          const d = new Date(evt.event_date);
          const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
          const day = d.getDate();
          const time = evt.event_time || '';
          eventsHtml += `
            <div class="event-list-item">
              <div class="event-date-box"><div class="ev-month">${month}</div><div class="ev-day">${day}</div></div>
              <div class="event-info">
                <div class="event-info-title">${escHtml(evt.title)}</div>
                <div class="event-info-detail">${time ? escHtml(time) + ' &middot; ' : ''}${evt.location ? escHtml(evt.location) : ''}</div>
                ${evt.description ? `<div class="event-info-detail">${escHtml(evt.description)}</div>` : ''}
                <button class="remind-btn" onclick="setReminder(this,'${escHtml(evt.title)}')">&#x1F514; Remind Me</button>
              </div>
            </div>`;
        });
      }
    } catch (err) {
      auditLog('warn', 'show_day_events_error', { message: err.message });
    }
  }

  if (!eventsHtml) {
    eventsHtml = '<div class="muted-text centered-text" style="padding:10px 0">No events scheduled</div>';
  }

  const popup = document.createElement('div');
  popup.id = 'day-events-popup';
  popup.className = 'card';
  popup.style.cssText = 'margin-top:10px;animation:fade-up 0.2s ease';
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <div class="card-title" style="margin-bottom:0">${dateLabel}</div>
      <button onclick="document.getElementById('day-events-popup').remove()" style="background:none;border:none;color:var(--text-muted);font-size:16px;cursor:pointer">&times;</button>
    </div>
    ${eventsHtml}`;

  // Insert after the calendar card
  const calCard = document.getElementById('cal-grid')?.closest('.card')
    || document.getElementById('cal-grid-2')?.closest('.card');
  if (calCard) {
    calCard.after(popup);
  }
}

/**
 * Submit a new event. Admin/leadership events go live immediately.
 * Ministry member events go to pending (is_public = false).
 */
export async function submitEvent() {
  if (!db || !APP.member?.id) return;

  const title = document.getElementById('evt-title')?.value.trim();
  const date = document.getElementById('evt-date')?.value;
  const time = document.getElementById('evt-time')?.value.trim();
  const location = document.getElementById('evt-location')?.value.trim();
  const description = document.getElementById('evt-description')?.value.trim();
  const errorEl = document.getElementById('evt-error');

  if (!title) { if (errorEl) errorEl.textContent = 'Event title is required.'; return; }
  if (!date) { if (errorEl) errorEl.textContent = 'Event date is required.'; return; }
  if (errorEl) errorEl.textContent = '';

  const isAdmin = APP.member.is_admin || APP.member.status === 'leadership';
  const btn = document.getElementById('evt-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

  try {
    const { error } = await db.from('events').insert({
      title,
      event_date: date + (time ? 'T' + time + ':00' : 'T00:00:00'),
      event_time: time || null,
      location: location || null,
      description: description || null,
      is_public: isAdmin,
      created_by: APP.member.id,
    });

    if (error) {
      if (errorEl) errorEl.textContent = 'Error: ' + error.message;
      return;
    }

    // Clear form
    document.getElementById('evt-title').value = '';
    document.getElementById('evt-date').value = '';
    document.getElementById('evt-time').value = '';
    document.getElementById('evt-location').value = '';
    document.getElementById('evt-description').value = '';

    // Show success toast
    const toast = document.getElementById('evt-toast');
    if (toast) {
      toast.textContent = isAdmin
        ? '\u2705 Event published to the calendar!'
        : '\u2705 Event submitted for approval. Leadership will review it.';
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 4000);
    }

    // Toggle form closed
    const form = document.getElementById('evt-create-form');
    if (form) form.classList.add('hidden');

    auditLog('info', 'event_created', {
      title,
      date,
      is_public: isAdmin,
      created_by: APP.member.id,
    });

    // Refresh calendar and events list if admin
    if (isAdmin) {
      buildCalendar();
      window.loadEvents?.();
    }
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Connection error. Try again.';
    auditLog('error', 'submit_event_error', { message: err.message });
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Event \u2726'; }
  }
}

export function toggleEventForm() {
  const form = document.getElementById('evt-create-form');
  if (!form) return;
  form.classList.toggle('hidden');
  // Pre-fill date with today
  if (!form.classList.contains('hidden')) {
    const dateInput = document.getElementById('evt-date');
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }
}

// Attach to window for HTML onclick handlers
window.calNav = calNav;
window.calNav2 = calNav2;
window.showDayEvents = showDayEvents;
window.buildCalendar = buildCalendar;
window.submitEvent = submitEvent;
window.toggleEventForm = toggleEventForm;

export { MONTH_NAMES, DAY_NAMES };
