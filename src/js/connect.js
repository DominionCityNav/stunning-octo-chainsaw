import db from './supabase.js';
import { APP } from './state.js';
import CONFIG from '../config.js';
import { auditLog } from './audit.js';

async function submitConnectCard() {
  if (!db) return;

  const name = document.getElementById('connect-name')?.value.trim();
  const email = document.getElementById('connect-email')?.value.trim();
  const phone = document.getElementById('connect-phone')?.value.trim();
  const message = document.getElementById('connect-message')?.value.trim();
  const visitType = document.getElementById('connect-visit-type')?.value || 'first-time';

  if (!name) {
    alert('Please enter your name.');
    return;
  }

  try {
    const { error } = await db.from('connect_cards').insert({
      name,
      email: email || null,
      phone: phone || null,
      message: message || null,
      visit_type: visitType,
      member_id: APP.member?.id || null,
    });

    if (error) {
      alert('Failed to submit. Please try again.');
      auditLog('error', 'submit_connect_card_error', { message: error.message });
      return;
    }

    // Clear form
    ['connect-name', 'connect-email', 'connect-phone', 'connect-message'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    alert(`Welcome to ${CONFIG.churchName}! We're glad you're here.`);
    auditLog('info', 'connect_card_submitted', { name, visitType });
  } catch (err) {
    alert('Failed to submit. Please try again.');
    auditLog('error', 'submit_connect_card_error', { message: err.message });
  }
}

async function submitGuestPrayer() {
  if (!db) return;

  const name = document.getElementById('guest-prayer-name')?.value.trim() || 'Guest';
  const content = document.getElementById('guest-prayer-content')?.value.trim();

  if (!content) {
    alert('Please enter your prayer request.');
    return;
  }

  try {
    const { error } = await db.from('prayer_requests').insert({
      content,
      member_name: name,
      type: 'public',
      prayer_count: 0,
    });

    if (error) {
      alert('Failed to submit prayer request.');
      auditLog('error', 'submit_guest_prayer_error', { message: error.message });
      return;
    }

    const nameInput = document.getElementById('guest-prayer-name');
    const contentInput = document.getElementById('guest-prayer-content');
    if (nameInput) nameInput.value = '';
    if (contentInput) contentInput.value = '';

    alert('Prayer request submitted. We are praying with you!');
    auditLog('info', 'guest_prayer_submitted');
  } catch (err) {
    alert('Failed to submit prayer request.');
    auditLog('error', 'submit_guest_prayer_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.submitConnectCard = submitConnectCard;
window.submitGuestPrayer = submitGuestPrayer;

export { submitConnectCard, submitGuestPrayer };
