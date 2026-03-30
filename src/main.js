// Styles
import './styles/variables.css';
import './styles/reset.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/screens.css';

// JS modules - import order matters for side effects
import { auditLog } from './js/audit.js';
import './js/supabase.js';
import './js/utils.js';
import './js/navigation.js';
import './js/auth.js';
import './js/scripture.js';
import './js/ministry.js';
import './js/chat.js';
import './js/prayer.js';
import './js/community.js';
import './js/announcements.js';
import './js/calendar.js';
import './js/giving.js';
import './js/notifications.js';
import './js/profile.js';
import './js/reactions.js';
import './js/blast.js';
import './js/claude-engine.js';
import './js/pastor-dashboard.js';
import './js/setlists.js';
import './js/giving-reports.js';
import './js/home.js';
import './js/connect.js';
import './js/emember.js';
import './js/mentions.js';
import './js/registration.js';
import './js/app.js';

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      /* Silent - SW not critical */
    });
  });
}

// Error handlers
window.addEventListener('error', (e) => {
  auditLog('error', 'unhandled_error', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
  });
});

window.addEventListener('unhandledrejection', (e) => {
  auditLog('error', 'unhandled_promise', {
    reason: String(e.reason).substring(0, 200),
  });
});
