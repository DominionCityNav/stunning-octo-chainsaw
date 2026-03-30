import db from './supabase.js';
import { APP } from './state.js';
import CONFIG from '../config.js';
import { auditLog } from './audit.js';

function openEMemberForm() {
  const overlay = document.getElementById('overlay-emember');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'emember';
}

function closeEMemberForm() {
  const overlay = document.getElementById('overlay-emember');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'emember') {
    APP.activeOverlay = null;
  }
}

async function submitEMember() {
  if (!db) return;

  const firstName = document.getElementById('emember-first-name')?.value.trim();
  const lastName = document.getElementById('emember-last-name')?.value.trim();
  const email = document.getElementById('emember-email')?.value.trim();
  const phone = document.getElementById('emember-phone')?.value.trim();
  const address = document.getElementById('emember-address')?.value.trim();
  const reason = document.getElementById('emember-reason')?.value.trim();

  if (!firstName || !lastName) {
    alert('Please enter your first and last name.');
    return;
  }

  try {
    const { error } = await db.from('emember_applications').insert({
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      phone: phone || null,
      address: address || null,
      reason: reason || null,
      status: 'pending',
    });

    if (error) {
      alert('Failed to submit application. Please try again.');
      auditLog('error', 'submit_emember_error', { message: error.message });
      return;
    }

    // Clear form
    ['emember-first-name', 'emember-last-name', 'emember-email', 'emember-phone', 'emember-address', 'emember-reason'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    alert(`Thank you for your interest in ${CONFIG.churchName}! Your e-membership application has been submitted.`);
    closeEMemberForm();
    auditLog('info', 'emember_application_submitted', { name: firstName + ' ' + lastName });
  } catch (err) {
    alert('Failed to submit application.');
    auditLog('error', 'submit_emember_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.openEMemberForm = openEMemberForm;
window.closeEMemberForm = closeEMemberForm;
window.submitEMember = submitEMember;

export { openEMemberForm, closeEMemberForm, submitEMember };
