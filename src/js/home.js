import db from './supabase.js';
import CONFIG from '../config.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function toggleAboutDCC() {
  const section = document.getElementById('about-dcc');
  if (!section) return;

  const isVisible = section.style.display === 'block';
  section.style.display = isVisible ? 'none' : 'block';
}

function toggleConnectCard() {
  const section = document.getElementById('connect-card-section');
  if (!section) return;

  const isVisible = section.style.display === 'block';
  section.style.display = isVisible ? 'none' : 'block';
}

function shareApp() {
  const shareData = {
    title: CONFIG.churchName,
    text: `Join ${CONFIG.churchName} - ${CONFIG.tagline}`,
    url: CONFIG.website,
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {
      /* User cancelled */
    });
  } else {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(CONFIG.website);
      alert('Link copied to clipboard!');
    }
  }
}

function openPastorPage() {
  const overlay = document.getElementById('overlay-pastor-page');
  if (!overlay) return;

  overlay.classList.add('active');
  overlay.style.display = 'flex';
  APP.activeOverlay = 'pastor-page';

  loadPastorPageBlasts();
  updatePastorCountdown();
  updatePastorScripture();
}

function closePastorPage() {
  const overlay = document.getElementById('overlay-pastor-page');
  if (overlay) {
    overlay.classList.remove('active');
    overlay.style.display = 'none';
  }
  if (APP.activeOverlay === 'pastor-page') {
    APP.activeOverlay = null;
  }
}

async function loadPastorPageBlasts() {
  if (!db) return;
  const container = document.getElementById('pastor-blasts');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('blasts')
      .select('*')
      .eq('type', 'pastoral')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No pastoral messages yet.</div>';
      return;
    }

    container.innerHTML = data.map((blast) => `
      <div class="pastor-blast-card">
        <div class="pastor-blast-text">${escHtml(blast.content)}</div>
        ${blast.audio_url ? `<audio controls src="${escHtml(blast.audio_url)}" class="pastor-blast-audio"></audio>` : ''}
        <div class="pastor-blast-time">${timeAgo(blast.created_at)}</div>
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_pastor_blasts_error', { message: err.message });
  }
}

function updatePastorCountdown() {
  const container = document.getElementById('pastor-countdown');
  if (!container) return;

  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

  const nextSunday = new Date(now);
  nextSunday.setDate(now.getDate() + daysUntilSunday);
  nextSunday.setHours(9, 0, 0, 0); // Service at 9 AM

  if (dayOfWeek === 0 && now.getHours() < 12) {
    container.innerHTML = `<div class="countdown-active">Service Today at ${CONFIG.serviceTime.split(' ')[1]} ${CONFIG.serviceTime.split(' ')[2]}</div>`;
  } else {
    const diff = nextSunday - now;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    container.innerHTML = `<div class="countdown">${days}d ${hours}h until next service</div>`;
  }
}

async function updatePastorScripture() {
  const container = document.getElementById('pastor-scripture');
  if (!container || !db) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await db
      .from('daily_scripture')
      .select('text, reference')
      .eq('date', today)
      .single();

    if (data) {
      container.innerHTML = `
        <div class="pastor-scripture-text">"${escHtml(data.text)}"</div>
        <div class="pastor-scripture-ref">- ${escHtml(data.reference)}</div>`;
    }
  } catch {
    /* Silent */
  }
}

async function quickPrayerFromPastor() {
  if (!db) return;

  const input = document.getElementById('pastor-quick-prayer');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    alert('Please enter a prayer request.');
    return;
  }

  const memberName = APP.member
    ? APP.member.first_name + ' ' + APP.member.last_name
    : 'Guest';

  try {
    const { error } = await db.from('prayer_requests').insert({
      content,
      member_id: APP.member?.id || null,
      member_name: memberName,
      type: 'pastoral',
      prayer_count: 0,
    });

    if (!error) {
      input.value = '';
      alert('Prayer request sent to ' + CONFIG.pastor + '.');
      auditLog('info', 'pastoral_prayer_submitted');
    }
  } catch (err) {
    auditLog('error', 'pastoral_prayer_error', { message: err.message });
  }
}

async function requestMeetingFromPastor() {
  if (!db || !APP.member) return;

  const reason = document.getElementById('pastor-meeting-reason')?.value.trim();
  if (!reason) {
    alert('Please describe the reason for your meeting request.');
    return;
  }

  try {
    const { error } = await db.from('meeting_requests').insert({
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      reason,
      status: 'pending',
    });

    if (!error) {
      const reasonInput = document.getElementById('pastor-meeting-reason');
      if (reasonInput) reasonInput.value = '';
      alert('Meeting request sent. ' + CONFIG.pastor + ' will respond soon.');
      auditLog('info', 'meeting_request_submitted');
    }
  } catch (err) {
    auditLog('error', 'meeting_request_error', { message: err.message });
  }
}

async function submitTestimonyFromPastor() {
  if (!db) return;

  const input = document.getElementById('pastor-testimony-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    alert('Please share your testimony.');
    return;
  }

  const memberName = APP.member
    ? APP.member.first_name + ' ' + APP.member.last_name
    : 'Guest';

  try {
    const { error } = await db.from('community_posts').insert({
      content,
      member_id: APP.member?.id || null,
      member_name: memberName,
      type: 'testimony',
      likes: 0,
    });

    if (!error) {
      input.value = '';
      alert('Testimony shared! God is good!');
      auditLog('info', 'testimony_submitted_from_pastor_page');
    }
  } catch (err) {
    auditLog('error', 'testimony_submit_error', { message: err.message });
  }
}

async function submitPastorQuickAction(action) {
  if (!db || !APP.member) return;

  try {
    const { error } = await db.from('pastor_actions').insert({
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      action,
    });

    if (!error) {
      auditLog('info', 'pastor_quick_action', { action });
      alert('Request submitted.');
    }
  } catch (err) {
    auditLog('error', 'pastor_quick_action_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.toggleAboutDCC = toggleAboutDCC;
window.toggleConnectCard = toggleConnectCard;
window.shareApp = shareApp;
window.openPastorPage = openPastorPage;
window.closePastorPage = closePastorPage;
window.quickPrayerFromPastor = quickPrayerFromPastor;
window.requestMeetingFromPastor = requestMeetingFromPastor;
window.submitTestimonyFromPastor = submitTestimonyFromPastor;
window.submitPastorQuickAction = submitPastorQuickAction;

export {
  toggleAboutDCC,
  toggleConnectCard,
  shareApp,
  openPastorPage,
  closePastorPage,
  loadPastorPageBlasts,
  updatePastorCountdown,
  updatePastorScripture,
  quickPrayerFromPastor,
  requestMeetingFromPastor,
  submitTestimonyFromPastor,
  submitPastorQuickAction,
};
