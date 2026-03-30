import db from './supabase.js';
import { APP } from './state.js';
import CONFIG from '../config.js';
import { auditLog } from './audit.js';

function showRegistration() {
  const overlay = document.getElementById('overlay-registration');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'registration';
}

function closeRegistration() {
  const overlay = document.getElementById('overlay-registration');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'registration') {
    APP.activeOverlay = null;
  }
}

async function submitRegistration() {
  if (!db) return;

  const firstName = document.getElementById('reg-first-name')?.value.trim();
  const lastName = document.getElementById('reg-last-name')?.value.trim();
  const email = document.getElementById('reg-email')?.value.trim();
  const phone = document.getElementById('reg-phone')?.value.trim();
  const pin = document.getElementById('reg-pin')?.value.trim();
  const confirmPin = document.getElementById('reg-confirm-pin')?.value.trim();

  if (!firstName || !lastName) {
    alert('Please enter your first and last name.');
    return;
  }

  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    alert('Please enter a 6-digit PIN.');
    return;
  }

  if (pin !== confirmPin) {
    alert('PINs do not match.');
    return;
  }

  // Check if PIN already exists
  const { data: existing } = await db
    .from('members')
    .select('id')
    .eq('pin', pin)
    .single();

  if (existing) {
    alert('This PIN is already taken. Please choose a different one.');
    return;
  }

  try {
    const { error } = await db.from('members').insert({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      pin,
      status: 'pending',
      role: 'member',
      ministries: [],
    });

    if (error) {
      alert('Registration failed. Please try again.');
      auditLog('error', 'submit_registration_error', { message: error.message });
      return;
    }

    // Clear form
    ['reg-first-name', 'reg-last-name', 'reg-email', 'reg-phone', 'reg-pin', 'reg-confirm-pin'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    closeRegistration();
    showPendingApprovalMessage();
    auditLog('info', 'member_registration_submitted', { name: firstName + ' ' + lastName });
  } catch (err) {
    alert('Registration failed. Please try again.');
    auditLog('error', 'submit_registration_error', { message: err.message });
  }
}

function showPendingApprovalMessage() {
  const _screen = document.getElementById('pin-screen');
  const pinError = document.getElementById('pin-error');

  if (pinError) {
    pinError.innerHTML = `
      <div class="pending-message">
        <h3>Registration Submitted!</h3>
        <p>Your account is pending approval by ${CONFIG.pastor}. You'll be able to log in once approved.</p>
        <p>In the meantime, you can browse as a guest.</p>
      </div>`;
  }
}

function showProfileSetup() {
  const overlay = document.getElementById('overlay-profile-setup');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'profile-setup';
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
