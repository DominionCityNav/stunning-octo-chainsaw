import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function openPastorDashboard() {
  if (APP.member?.role !== 'pastor') {
    alert('Access restricted to pastoral staff.');
    return;
  }

  const overlay = document.getElementById('overlay-pastor-dashboard');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'pastor-dashboard';

  loadPendingMembers();
  loadPendingEvents();
  runInAppDiagnostics();
}

function closePastorDashboard() {
  const overlay = document.getElementById('overlay-pastor-dashboard');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'pastor-dashboard') {
    APP.activeOverlay = null;
  }
}

async function runInAppDiagnostics() {
  const container = document.getElementById('diagnostics-panel');
  if (!container || !db) return;

  try {
    const checks = [];

    // Check member count
    const { count: memberCount } = await db
      .from('members')
      .select('*', { count: 'exact', head: true });
    checks.push({ label: 'Total Members', value: memberCount || 0, status: 'ok' });

    // Check pending members
    const { count: pendingCount } = await db
      .from('members')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    checks.push({
      label: 'Pending Approvals',
      value: pendingCount || 0,
      status: pendingCount > 0 ? 'warn' : 'ok',
    });

    // Check recent prayers
    const { count: prayerCount } = await db
      .from('prayer_requests')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
    checks.push({ label: 'Prayers This Week', value: prayerCount || 0, status: 'ok' });

    // Check recent blasts
    const { count: blastCount } = await db
      .from('blasts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString());
    checks.push({ label: 'Blasts This Week', value: blastCount || 0, status: 'ok' });

    container.innerHTML = `
      <div class="diagnostics-grid">
        ${checks.map((c) => `
          <div class="diag-card ${c.status}">
            <div class="diag-value">${c.value}</div>
            <div class="diag-label">${escHtml(c.label)}</div>
          </div>`).join('')}
      </div>
      <button class="btn-primary" onclick="generatePastoralReport().then(r => document.getElementById('pastoral-report').innerHTML = r.replace(/\\n/g, '<br>'))">
        Generate Pastoral Report
      </button>
      <div id="pastoral-report" class="pastoral-report"></div>`;
  } catch (err) {
    container.innerHTML = '<div class="empty-state">Could not load diagnostics.</div>';
    auditLog('error', 'diagnostics_error', { message: err.message });
  }
}

async function loadPendingMembers() {
  if (!db) return;
  const container = document.getElementById('pending-members-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('members')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No pending members.</div>';
      return;
    }

    container.innerHTML = data.map((m) => `
      <div class="pending-member-card">
        <div class="pending-info">
          <div class="pending-name">${escHtml(m.first_name)} ${escHtml(m.last_name)}</div>
          <div class="pending-email">${escHtml(m.email || '')}</div>
          <div class="pending-time">${timeAgo(m.created_at)}</div>
        </div>
        <div class="pending-actions">
          <button class="btn-approve" onclick="approveMember('${m.id}')">Approve</button>
          <button class="btn-decline" onclick="declineMember('${m.id}')">Decline</button>
        </div>
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_pending_members_error', { message: err.message });
  }
}

async function approveMember(memberId) {
  if (!db) return;

  try {
    const { error } = await db
      .from('members')
      .update({ status: 'active' })
      .eq('id', memberId);

    if (!error) {
      auditLog('info', 'member_approved', { member_id: memberId });
      loadPendingMembers();
    }
  } catch (err) {
    auditLog('error', 'approve_member_error', { message: err.message });
  }
}

async function declineMember(memberId) {
  if (!db) return;
  if (!confirm('Are you sure you want to decline this member?')) return;

  try {
    const { error } = await db
      .from('members')
      .update({ status: 'declined' })
      .eq('id', memberId);

    if (!error) {
      auditLog('info', 'member_declined', { member_id: memberId });
      loadPendingMembers();
    }
  } catch (err) {
    auditLog('error', 'decline_member_error', { message: err.message });
  }
}

async function loadPendingEvents() {
  if (!db) return;
  const container = document.getElementById('pending-events-container');
  const badge = document.getElementById('pending-events-badge');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('events')
      .select('*, members(full_name)')
      .eq('is_public', false)
      .order('event_date', { ascending: true });

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="muted-text">No pending events \u2713</div>';
      if (badge) badge.classList.add('hidden');
      return;
    }

    if (badge) {
      badge.textContent = data.length;
      badge.classList.remove('hidden');
    }

    container.innerHTML = data.map((evt) => {
      const d = new Date(evt.event_date);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      const submitter = evt.members?.full_name || 'Unknown member';
      return `
        <div class="pending-event-card" style="background:rgba(255,255,255,0.04);border:1px solid rgba(201,149,42,0.2);border-radius:var(--radius-sm);padding:14px;margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div style="font-family:var(--font-display);font-size:15px;color:var(--white)">${escHtml(evt.title)}</div>
              <div style="font-size:12px;color:var(--gold);margin-top:2px">${dateStr}${evt.event_time ? ' &middot; ' + escHtml(evt.event_time) : ''}</div>
            </div>
          </div>
          ${evt.location ? `<div style="font-size:12px;color:var(--text-muted);margin-bottom:4px">\u{1F4CD} ${escHtml(evt.location)}</div>` : ''}
          ${evt.description ? `<div style="font-size:12px;color:rgba(255,255,255,0.7);margin-bottom:8px">${escHtml(evt.description)}</div>` : ''}
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">Submitted by ${escHtml(submitter)}</div>
          <div style="display:flex;gap:8px">
            <button onclick="approveEvent('${evt.id}')" class="btn-gold" style="flex:1;font-size:12px;padding:8px">\u2713 Approve</button>
            <button onclick="rejectEvent('${evt.id}')" style="flex:1;background:rgba(239,68,68,0.15);color:#fca5a5;font-size:12px;padding:8px;border-radius:8px;border:1px solid rgba(239,68,68,0.3);cursor:pointer">\u2717 Reject</button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_pending_events_error', { message: err.message });
    container.innerHTML = '<div class="muted-text">Could not load pending events.</div>';
  }
}

async function approveEvent(eventId) {
  if (!db) return;
  try {
    const { error } = await db
      .from('events')
      .update({ is_public: true })
      .eq('id', eventId);

    if (!error) {
      auditLog('info', 'event_approved', { event_id: eventId, approved_by: APP.member?.id });
      loadPendingEvents();
    }
  } catch (err) {
    auditLog('error', 'approve_event_error', { message: err.message });
  }
}

async function rejectEvent(eventId) {
  if (!db) return;
  if (!confirm('Reject this event? It will be deleted.')) return;
  try {
    const { error } = await db
      .from('events')
      .delete()
      .eq('id', eventId);

    if (!error) {
      auditLog('info', 'event_rejected', { event_id: eventId, rejected_by: APP.member?.id });
      loadPendingEvents();
    }
  } catch (err) {
    auditLog('error', 'reject_event_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.openPastorDashboard = openPastorDashboard;
window.closePastorDashboard = closePastorDashboard;
window.runInAppDiagnostics = runInAppDiagnostics;
window.loadPendingMembers = loadPendingMembers;
window.approveMember = approveMember;
window.declineMember = declineMember;
window.loadPendingEvents = loadPendingEvents;
window.approveEvent = approveEvent;
window.rejectEvent = rejectEvent;

export {
  openPastorDashboard,
  closePastorDashboard,
  runInAppDiagnostics,
  loadPendingMembers,
  approveMember,
  declineMember,
  loadPendingEvents,
  approveEvent,
  rejectEvent,
};
