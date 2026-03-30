import { APP } from './state.js';

const OVERLAY_CLOSERS = {};

function switchTabInternal(tabName) {
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach((el) => {
    el.classList.remove('active');
  });

  const tabEl = document.getElementById('tab-' + tabName);
  if (tabEl) tabEl.classList.add('active');

  const btn = document.querySelector(`.tab-btn[onclick*="'${tabName}'"]`);
  if (btn) btn.classList.add('active');

  APP.currentTab = tabName;
}

function switchTab(tabName) {
  // Close any open overlay first
  if (APP.activeOverlay) {
    popOverlay();
  }

  switchTabInternal(tabName);

  // Trigger tab-specific loaders
  const event = new CustomEvent('tabSwitch', { detail: { tab: tabName } });
  document.dispatchEvent(event);
}

function pushOverlay(name) {
  APP.activeOverlay = name;
  const el = document.getElementById('overlay-' + name);
  if (el) {
    el.classList.add('active');
    el.style.display = 'flex';
  }
}

function popOverlay() {
  if (!APP.activeOverlay) return;

  const name = APP.activeOverlay;
  const el = document.getElementById('overlay-' + name);
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
  }

  if (OVERLAY_CLOSERS[name]) {
    OVERLAY_CLOSERS[name]();
  }

  APP.activeOverlay = null;
}

function closeOverlayByName(name) {
  const el = document.getElementById('overlay-' + name);
  if (el) {
    el.classList.remove('active');
    el.style.display = 'none';
  }
  if (APP.activeOverlay === name) {
    APP.activeOverlay = null;
  }
}

// Attach to window for HTML onclick handlers
window.switchTab = switchTab;

export { switchTab, switchTabInternal, pushOverlay, popOverlay, closeOverlayByName, OVERLAY_CLOSERS };
