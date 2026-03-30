import db from './supabase.js';
import { APP } from './state.js';
import CONFIG from '../config.js';
import { auditLog } from './audit.js';
import { pushOverlay, popOverlay } from './navigation.js';

function showRegistration() {
  const el = document.getElementById('registration-screen');
  if (!el) return;
  el.classList.remove('hidden');
  el.style.display = 'block';
  pushOverlay('registration');
}

function closeRegistration() {
  const el = document.getElementById('registration-screen');
  if (!el) return;
  el.classList.add('hidden');
  el.style.display = 'none';
  if (APP.activeOverlay === 'registration') {
    popOverlay();
    history.back();
  }
}

function showProfileSetup() {
  showRegistration();
}

async function submitRegistration() {
  const btn = document.getElementById('reg-submit-btn');
  const errorEl = document.getElementById('reg-error');
  const name = document.getElementById('reg-name')?.value.trim();
  const phone = document.getElementById('reg-phone')?.value.trim();
  const gender = document.getElementById('reg-gender')?.value;
  const status = document.getElementById('reg-status')?.value;
  const bmonth = document.getElementById('reg-bmonth')?.value;
  const bday = document.getElementById('reg-bday')?.value;

  if (!name) { if (errorEl) errorEl.textContent = 'Full name is required.'; return; }
  if (!gender) { if (errorEl) errorEl.textContent = 'Please select your gender.'; return; }
  if (!status) { if (errorEl) errorEl.textContent = 'Please select your membership type.'; return; }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }
  if (errorEl) errorEl.textContent = '';

  try {
    const ministries = Array.from(
      document.querySelectorAll('.reg-ministry-check:checked')
    ).map((cb) => cb.value);

    const updates = {
      full_name: name,
      phone: phone || null,
      gender,
      status: 'pending',
      birthday_month: bmonth ? parseInt(bmonth) : null,
      birthday_day: bday ? parseInt(bday) : null,
      ministry_affiliations: ministries,
      profile_complete: false,
      profile_last_updated: new Date().toISOString(),
    };

    const { error } = await db
      .from('members')
      .update(updates)
      .eq('id', APP.member.id);

    if (error) {
      if (errorEl) errorEl.textContent = 'Error: ' + error.message;
      if (btn) { btn.disabled = false; btn.textContent = 'Complete Registration \u2726'; }
      return;
    }

    APP.member = {
      ...APP.member,
      ...updates,
      initials: name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase(),
    };

    auditLog('info', 'member_registration_pending', { member_id: APP.member.id });
    closeRegistration();
    showPendingApprovalMessage(name.split(' ')[0]);
  } catch (err) {
    if (errorEl) errorEl.textContent = 'Connection error. Try again.';
    if (btn) { btn.disabled = false; btn.textContent = 'Complete Registration \u2726'; }
    auditLog('error', 'registration_failed', { message: err.message });
  }
}

function showPendingApprovalMessage(firstName) {
  const overlay = document.createElement('div');
  overlay.id = 'pending-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;height:100vh;z-index:300;background:var(--purple-deep);display:flex;align-items:center;justify-content:center;padding:32px';
  overlay.innerHTML = `
    <div style="text-align:center">
      <div style="font-size:64px;margin-bottom:20px">\u{1F64F}</div>
      <div style="font-family:var(--font-display);font-size:22px;color:var(--gold-light);margin-bottom:12px">Welcome, ${firstName || 'Friend'}!</div>
      <div style="font-size:15px;line-height:1.8;color:rgba(255,255,255,0.85);margin-bottom:24px">
        Your profile has been submitted for approval.<br><br>
        ${CONFIG.pastor} will review your request within <strong style="color:var(--gold)">1\u20132 days</strong>.<br><br>
        You'll be notified when your account is activated and can set your personal PIN.
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:28px">While you wait, you can still browse the Visitor section.</div>
      <button onclick="document.getElementById('pending-overlay').remove();switchTab('visitors')" style="background:var(--gold);color:var(--purple-deep);font-family:var(--font-display);font-size:13px;font-weight:700;padding:14px 32px;border-radius:30px;border:none;cursor:pointer;letter-spacing:1px">Continue as Visitor \u2726</button>
    </div>`;
  document.body.appendChild(overlay);
}

// Attach to window for HTML onclick handlers
window.showRegistration = showRegistration;
window.closeRegistration = closeRegistration;
window.submitRegistration = submitRegistration;
window.showPendingApprovalMessage = showPendingApprovalMessage;
window.showProfileSetup = showProfileSetup;

export {
  showRegistration,
  closeRegistration,
  submitRegistration,
  showPendingApprovalMessage,
  showProfileSetup,
};
