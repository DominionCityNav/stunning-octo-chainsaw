import db from './supabase.js';
import CONFIG from '../config.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function copyToClip(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      const toast = document.getElementById('copy-toast');
      if (toast) {
        toast.textContent = 'Copied!';
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
      }
    });
  } else {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

function initGivingSection() {
  const zelleEl = document.getElementById('giving-zelle');
  if (zelleEl) zelleEl.textContent = CONFIG.giving.zelle;

  const cashappEl = document.getElementById('giving-cashapp');
  if (cashappEl) cashappEl.textContent = CONFIG.giving.cashapp;

  const squareLink = document.getElementById('giving-square-link');
  if (squareLink) squareLink.href = CONFIG.giving.square;
}

async function logGift(method) {
  if (!db || !APP.member) return;

  const amountInput = document.getElementById('gift-amount');
  const amount = amountInput ? parseFloat(amountInput.value) : 0;

  if (!amount || amount <= 0) {
    alert('Please enter a valid amount.');
    return;
  }

  try {
    const { error } = await db.from('giving_log').insert({
      member_id: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
      amount,
      method,
    });

    if (error) {
      auditLog('error', 'log_gift_error', { message: error.message });
      alert('Failed to log gift. Please try again.');
      return;
    }

    if (amountInput) amountInput.value = '';
    alert('Gift logged. Thank you for your generosity!');
    auditLog('info', 'gift_logged', { amount, method });
    loadMyGiving();
  } catch (err) {
    auditLog('error', 'log_gift_error', { message: err.message });
  }
}

async function loadMyGiving() {
  if (!db || !APP.member) return;
  const container = document.getElementById('my-giving-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('giving_log')
      .select('*')
      .eq('member_id', APP.member.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No giving history yet.</div>';
      return;
    }

    let total = 0;
    const rows = data.map((g) => {
      total += g.amount || 0;
      return `
        <div class="giving-row">
          <span class="giving-amount">$${(g.amount || 0).toFixed(2)}</span>
          <span class="giving-method">${escHtml(g.method)}</span>
          <span class="giving-date">${timeAgo(g.created_at)}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="giving-total">Total Given: $${total.toFixed(2)}</div>
      ${rows}`;
  } catch (err) {
    auditLog('error', 'load_my_giving_error', { message: err.message });
  }
}

async function loadChurchGivingTotals() {
  if (!db) return;
  const container = document.getElementById('church-giving-totals');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('giving_log')
      .select('amount, method');

    if (error || !data) return;

    let total = 0;
    const byMethod = {};
    data.forEach((g) => {
      total += g.amount || 0;
      byMethod[g.method] = (byMethod[g.method] || 0) + (g.amount || 0);
    });

    let html = `<div class="giving-total">Church Total: $${total.toFixed(2)}</div>`;
    for (const [method, amt] of Object.entries(byMethod)) {
      html += `<div class="giving-method-total">${escHtml(method)}: $${amt.toFixed(2)}</div>`;
    }

    container.innerHTML = html;
  } catch (err) {
    auditLog('error', 'load_church_giving_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.copyToClip = copyToClip;
window.initGivingSection = initGivingSection;
window.logGift = logGift;
window.loadMyGiving = loadMyGiving;
window.loadChurchGivingTotals = loadChurchGivingTotals;

export { copyToClip, initGivingSection, logGift, loadMyGiving, loadChurchGivingTotals };
