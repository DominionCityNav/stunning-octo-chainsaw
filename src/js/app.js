import CONFIG from '../config.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { switchTab } from './navigation.js';
import { loadScripture } from './scripture.js';
import { renderMinistryRooms } from './ministry.js';
import { loadPrayerWall } from './prayer.js';
import { loadCommunityFeed, loadFeedPosts } from './community.js';
import { loadAnnouncements, loadEvents } from './announcements.js';
import { buildCalendar } from './calendar.js';
import { initGivingSection, loadMyGiving } from './giving.js';
import { updateNotifBadge } from './notifications.js';
import { loadBlastFeed, loadHomeBlastPreview } from './blast.js';
import { runClaudeEngine } from './claude-engine.js';

function applyConfig() {
  // Set church name in all relevant elements
  document.querySelectorAll('[data-config="churchName"]').forEach((el) => {
    el.textContent = CONFIG.churchName;
  });

  document.querySelectorAll('[data-config="pastor"]').forEach((el) => {
    el.textContent = CONFIG.pastor;
  });

  document.querySelectorAll('[data-config="tagline"]').forEach((el) => {
    el.textContent = CONFIG.tagline;
  });

  document.querySelectorAll('[data-config="serviceTime"]').forEach((el) => {
    el.textContent = CONFIG.serviceTime;
  });

  document.querySelectorAll('[data-config="address"]').forEach((el) => {
    el.textContent = CONFIG.address;
  });

  document.querySelectorAll('[data-config="phone"]').forEach((el) => {
    el.textContent = CONFIG.phone;
  });

  document.querySelectorAll('[data-config="email"]').forEach((el) => {
    el.textContent = CONFIG.email;
  });

  // Set theme color meta
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = CONFIG.primaryColor;

  // Set CSS custom properties
  document.documentElement.style.setProperty('--primary', CONFIG.primaryColor);
  document.documentElement.style.setProperty('--accent', CONFIG.accentColor);
}

function loadPastorPhoto() {
  const photoEls = document.querySelectorAll('.pastor-photo, [data-config="pastorPhoto"]');
  photoEls.forEach((el) => {
    if (el.tagName === 'IMG') {
      el.src = CONFIG.pastorPhoto;
      el.alt = CONFIG.pastor;
    } else {
      el.style.backgroundImage = `url(${CONFIG.pastorPhoto})`;
    }
  });

  const churchPhotoEls = document.querySelectorAll('.church-photo, [data-config="churchPhoto"]');
  churchPhotoEls.forEach((el) => {
    if (el.tagName === 'IMG') {
      el.src = CONFIG.churchPhoto;
      el.alt = CONFIG.churchName;
    } else {
      el.style.backgroundImage = `url(${CONFIG.churchPhoto})`;
    }
  });
}

function launchApp() {
  const pinScreen = document.getElementById('pin-screen');
  if (pinScreen) pinScreen.style.display = 'none';

  const guestGate = document.getElementById('guest-gate');
  if (guestGate) guestGate.style.display = 'none';

  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.style.display = 'flex';

  applyConfig();
  loadPastorPhoto();

  // Show member info
  if (APP.member) {
    const memberNameEl = document.getElementById('member-name');
    if (memberNameEl) {
      memberNameEl.textContent = APP.member.first_name + ' ' + APP.member.last_name;
    }

    const memberRoleEl = document.getElementById('member-role');
    if (memberRoleEl) {
      memberRoleEl.textContent = APP.member.role || 'Member';
    }

    const memberPhotoEl = document.getElementById('member-photo');
    if (memberPhotoEl && APP.member.photo_url) {
      memberPhotoEl.src = APP.member.photo_url;
      memberPhotoEl.style.display = 'block';
    }

    // Show pastor dashboard button if pastor
    if (APP.member.role === 'pastor') {
      const dashBtn = document.getElementById('pastor-dashboard-btn');
      if (dashBtn) dashBtn.style.display = 'block';
    }
  }

  // Initialize all sections
  switchTab('home');
  renderMinistryRooms();
  initGivingSection();
  buildCalendar();
  updateNotifBadge();

  // Load data
  loadScripture();
  loadAnnouncements();
  loadEvents();
  loadPrayerWall();
  loadCommunityFeed();
  loadFeedPosts();
  loadBlastFeed();
  loadHomeBlastPreview();

  if (APP.member) {
    loadMyGiving();
  }

  // Run Claude engine in background
  setTimeout(() => {
    runClaudeEngine();
  }, 5000);

  // Tab switch listener for lazy loading
  document.addEventListener('tabSwitch', (e) => {
    const tab = e.detail.tab;
    if (tab === 'prayer') loadPrayerWall();
    if (tab === 'community') loadCommunityFeed();
    if (tab === 'feed') loadFeedPosts();
    if (tab === 'blasts') loadBlastFeed();
    if (tab === 'calendar') buildCalendar();
    if (tab === 'giving' && APP.member) loadMyGiving();
    if (tab === 'announcements') {
      loadAnnouncements();
      loadEvents();
    }
  });

  auditLog('info', 'app_launched', {
    member_id: APP.member?.id,
    guest: APP.guestMode,
  });
}

function showGuestGate() {
  const pinScreen = document.getElementById('pin-screen');
  if (pinScreen) pinScreen.style.display = 'none';

  const guestGate = document.getElementById('guest-gate');
  if (guestGate) guestGate.style.display = 'flex';

  applyConfig();
  loadPastorPhoto();
}

function showMemberView() {
  const guestGate = document.getElementById('guest-gate');
  if (guestGate) guestGate.style.display = 'none';

  const pinScreen = document.getElementById('pin-screen');
  if (pinScreen) pinScreen.style.display = 'flex';

  APP.guestMode = false;
  APP.pin = '';
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  applyConfig();
  loadPastorPhoto();

  // Check for biometric
  const bioMember = localStorage.getItem('dcc_bio_member');
  if (bioMember) {
    const bioBtn = document.getElementById('biometric-btn');
    if (bioBtn) bioBtn.style.display = 'block';
  }
});

// Attach to window for HTML onclick handlers
window.launchApp = launchApp;
window.showGuestGate = showGuestGate;
window.showMemberView = showMemberView;

export { applyConfig, loadPastorPhoto, launchApp, showGuestGate, showMemberView };
