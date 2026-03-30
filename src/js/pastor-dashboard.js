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

// Attach to window for HTML onclick handlers
window.openPastorDashboard = openPastorDashboard;
window.closePastorDashboard = closePastorDashboard;
window.runInAppDiagnostics = runInAppDiagnostics;
window.loadPendingMembers = loadPendingMembers;
window.approveMember = approveMember;
window.declineMember = declineMember;

export {
  openPastorDashboard,
  closePastorDashboard,
  runInAppDiagnostics,
  loadPendingMembers,
  approveMember,
  declineMember,
};
