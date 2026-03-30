import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function setPrayerType(type) {
  APP.prayerType = type;
  document.querySelectorAll('.prayer-type-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
}

async function submitPrayer() {
  if (!db) return;

  const input = document.getElementById('prayer-input');
  if (!input) return;

  const content = input.value.trim();
  if (!content) {
    alert('Please enter your prayer request.');
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
      type: APP.prayerType,
      prayer_count: 0,
    });

    if (error) {
      auditLog('error', 'submit_prayer_error', { message: error.message });
      alert('Failed to submit prayer. Please try again.');
      return;
    }

    input.value = '';
    auditLog('info', 'prayer_submitted', { type: APP.prayerType });
    loadPrayerWall();
  } catch (err) {
    auditLog('error', 'submit_prayer_error', { message: err.message });
  }
}

async function prayForRequest(requestId) {
  if (!db) return;

  try {
    const { data, error: fetchError } = await db
      .from('prayer_requests')
      .select('prayer_count')
      .eq('id', requestId)
      .single();

    if (fetchError || !data) return;

    const { error } = await db
      .from('prayer_requests')
      .update({ prayer_count: (data.prayer_count || 0) + 1 })
      .eq('id', requestId);

    if (!error) {
      auditLog('info', 'prayed_for_request', { request_id: requestId });
      loadPrayerWall();
    }
  } catch (err) {
    auditLog('error', 'pray_for_error', { message: err.message });
  }
}

async function loadPrayerWall() {
  if (!db) return;
  const container = document.getElementById('prayer-wall');
  if (!container) return;

  try {
    let query = db
      .from('prayer_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    // Non-members only see public prayers
    if (!APP.member) {
      query = query.eq('type', 'public');
    }

    const { data, error } = await query;

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No prayer requests yet. Be the first to share.</div>';
      return;
    }

    container.innerHTML = data.map((p) => {
      const isPrivate = p.type === 'private';
      const name = isPrivate ? 'Anonymous' : escHtml(p.member_name || 'Church Member');
      return `
        <div class="prayer-card ${isPrivate ? 'private' : ''}">
          <div class="prayer-header">
            <span class="prayer-name">${name}</span>
            ${isPrivate ? '<span class="prayer-private-badge">Private</span>' : ''}
            <span class="prayer-time">${timeAgo(p.created_at)}</span>
          </div>
          <div class="prayer-text">${escHtml(p.content)}</div>
          <div class="prayer-footer">
            <button class="pray-btn" onclick="prayForRequest('${p.id}')">
              Pray (${p.prayer_count || 0})
            </button>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    auditLog('error', 'load_prayer_wall_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.setPrayerType = setPrayerType;
window.submitPrayer = submitPrayer;
window.prayForRequest = prayForRequest;
window.loadPrayerWall = loadPrayerWall;

export { setPrayerType, submitPrayer, prayForRequest, loadPrayerWall };
