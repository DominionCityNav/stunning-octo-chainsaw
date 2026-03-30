import db from './supabase.js';
import { APP } from './state.js';
import CONFIG from '../config.js';
import { auditLog } from './audit.js';

function updateDots() {
  const dots = document.querySelectorAll('.pin-dot');
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < APP.pin.length);
  });
}

async function verifyPin() {
  if (!db) {
    document.getElementById('pin-error').textContent = 'Database not available. Please reload.';
    return;
  }

  const pinError = document.getElementById('pin-error');
  pinError.textContent = 'Verifying...';

  try {
    const { data, error } = await db
      .from('members')
      .select('*')
      .eq('pin', APP.pin)
      .single();

    if (error || !data) {
      pinError.textContent = 'Invalid PIN. Please try again.';
      auditLog('warn', 'pin_failed', { pin_length: APP.pin.length });
      APP.pin = '';
      updateDots();
      return;
    }

    if (data.status === 'pending') {
      APP.pin = '';
      updateDots();
      pinError.textContent = '';
      window.showPendingApprovalMessage?.();
      return;
    }

    if (data.status === 'declined') {
      pinError.textContent = 'Your membership request was not approved. Contact the church office.';
      APP.pin = '';
      updateDots();
      return;
    }

    APP.member = data;
    APP.authed = true;
    APP.guestMode = false;
    pinError.textContent = '';

    auditLog('info', 'login_success', {
      member_id: data.id,
      name: data.first_name + ' ' + data.last_name,
    });

    offerBiometricEnrollment();

    // Dynamic import to avoid circular dependency
    window.launchApp?.();
  } catch (err) {
    pinError.textContent = 'Connection error. Please try again.';
    auditLog('error', 'pin_verify_error', { message: err.message });
    APP.pin = '';
    updateDots();
  }
}

function pinPress(n) {
  if (APP.pin.length >= 6) return;
  APP.pin += n;
  updateDots();
  if (APP.pin.length === 6) {
    verifyPin();
  }
}

function pinDel() {
  APP.pin = APP.pin.slice(0, -1);
  updateDots();
}

function guestMode() {
  APP.guestMode = true;
  APP.authed = false;
  APP.member = null;
  auditLog('info', 'guest_mode_entered');

  window.launchApp?.();
}

async function checkBiometric() {
  if (!window.PublicKeyCredential) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

async function tryBiometric() {
  const hasBio = await checkBiometric();
  if (!hasBio) {
    document.getElementById('pin-error').textContent = 'Biometric not available on this device.';
    return;
  }

  const storedCredId = localStorage.getItem('dcc_bio_cred');
  const storedMemberId = localStorage.getItem('dcc_bio_member');
  if (!storedCredId || !storedMemberId) {
    document.getElementById('pin-error').textContent = 'No biometric enrolled. Please use your PIN.';
    return;
  }

  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: Uint8Array.from(atob(storedCredId), (c) => c.charCodeAt(0)),
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (credential) {
      const { data, error } = await db
        .from('members')
        .select('*')
        .eq('id', storedMemberId)
        .single();

      if (error || !data) {
        document.getElementById('pin-error').textContent = 'Biometric member not found. Use PIN.';
        return;
      }

      APP.member = data;
      APP.authed = true;
      APP.guestMode = false;

      auditLog('info', 'biometric_login', { member_id: data.id });

      window.launchApp?.();
    }
  } catch (err) {
    document.getElementById('pin-error').textContent = 'Biometric authentication cancelled.';
    auditLog('warn', 'biometric_failed', { message: err.message });
  }
}

async function offerBiometricEnrollment() {
  const hasBio = await checkBiometric();
  if (!hasBio) return;

  const alreadyEnrolled = localStorage.getItem('dcc_bio_cred');
  if (alreadyEnrolled) return;

  const declined = localStorage.getItem('dcc_bio_declined');
  if (declined) return;

  setTimeout(() => {
    const enroll = confirm('Would you like to enable fingerprint/face login for faster access?');
    if (!enroll) {
      localStorage.setItem('dcc_bio_declined', 'true');
      return;
    }
    enrollBiometric();
  }, 2000);
}

async function enrollBiometric() {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: CONFIG.churchName, id: location.hostname },
        user: {
          id: new TextEncoder().encode(APP.member.id),
          name: APP.member.first_name + ' ' + APP.member.last_name,
          displayName: APP.member.first_name,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    });

    if (credential) {
      const credId = btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
      localStorage.setItem('dcc_bio_cred', credId);
      localStorage.setItem('dcc_bio_member', APP.member.id);
      APP.biometricEnabled = true;
      auditLog('info', 'biometric_enrolled', { member_id: APP.member.id });
    }
  } catch (err) {
    auditLog('warn', 'biometric_enroll_failed', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.pinPress = pinPress;
window.pinDel = pinDel;
window.guestMode = guestMode;
window.tryBiometric = tryBiometric;

export { pinPress, pinDel, guestMode, tryBiometric, verifyPin, checkBiometric };
