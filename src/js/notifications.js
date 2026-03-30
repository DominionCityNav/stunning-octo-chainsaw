import { APP } from './state.js';

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (!panel) return;

  const isVisible = panel.style.display === 'flex' || panel.classList.contains('active');
  if (isVisible) {
    panel.classList.remove('active');
    panel.style.display = 'none';
  } else {
    panel.classList.add('active');
    panel.style.display = 'flex';
    APP.unreadCount = 0;
    updateNotifBadge();
  }
}

function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;

  if (APP.unreadCount > 0) {
    badge.textContent = APP.unreadCount > 99 ? '99+' : APP.unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// Close notification panel when clicking outside
document.addEventListener('click', (e) => {
  const panel = document.getElementById('notif-panel');
  const bell = document.getElementById('notif-bell');
  if (!panel || !bell) return;

  if (!panel.contains(e.target) && !bell.contains(e.target)) {
    panel.classList.remove('active');
    panel.style.display = 'none';
  }
});

// Attach to window for HTML onclick handlers
window.toggleNotifPanel = toggleNotifPanel;
window.updateNotifBadge = updateNotifBadge;

export { toggleNotifPanel, updateNotifBadge };
