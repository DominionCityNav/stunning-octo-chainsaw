import db from './supabase.js';
import { APP } from './state.js';
import { auditLog } from './audit.js';
import { escHtml, timeAgo } from './utils.js';

function showCreateReport() {
  const form = document.getElementById('giving-report-form');
  if (!form) return;

  form.style.display = form.style.display === 'block' ? 'none' : 'block';

  if (form.style.display === 'block') {
    form.innerHTML = `
      <div class="giving-report-create">
        <input type="date" id="report-date" class="input">
        <h4>Tithes & Offerings</h4>
        <div class="report-row">
          <label>Tithes</label>
          <input type="number" id="report-tithes" class="input" step="0.01" value="0" onchange="updateGrandTotal()">
        </div>
        <div class="report-row">
          <label>Offerings</label>
          <input type="number" id="report-offerings" class="input" step="0.01" value="0" onchange="updateGrandTotal()">
        </div>
        <div class="report-row">
          <label>Building Fund</label>
          <input type="number" id="report-building" class="input" step="0.01" value="0" onchange="updateGrandTotal()">
        </div>
        <div class="report-row">
          <label>Missions</label>
          <input type="number" id="report-missions" class="input" step="0.01" value="0" onchange="updateGrandTotal()">
        </div>
        <div class="report-row">
          <label>Other</label>
          <input type="number" id="report-other" class="input" step="0.01" value="0" onchange="updateGrandTotal()">
        </div>
        <div class="report-total">
          Grand Total: $<span id="report-grand-total">0.00</span>
        </div>
        <textarea id="report-notes" class="input" placeholder="Notes (optional)"></textarea>
        <button class="btn-primary" onclick="saveGivingReport()">Save Report</button>
      </div>`;
  }
}

function updateGrandTotal() {
  const fields = ['report-tithes', 'report-offerings', 'report-building', 'report-missions', 'report-other'];
  let total = 0;
  fields.forEach((id) => {
    const val = parseFloat(document.getElementById(id)?.value || 0);
    total += isNaN(val) ? 0 : val;
  });

  const el = document.getElementById('report-grand-total');
  if (el) el.textContent = total.toFixed(2);
}

async function saveGivingReport() {
  if (!db || !APP.member) return;

  const date = document.getElementById('report-date')?.value;
  if (!date) {
    alert('Please select a date.');
    return;
  }

  const tithes = parseFloat(document.getElementById('report-tithes')?.value || 0);
  const offerings = parseFloat(document.getElementById('report-offerings')?.value || 0);
  const building = parseFloat(document.getElementById('report-building')?.value || 0);
  const missions = parseFloat(document.getElementById('report-missions')?.value || 0);
  const other = parseFloat(document.getElementById('report-other')?.value || 0);
  const notes = document.getElementById('report-notes')?.value.trim() || '';
  const grandTotal = tithes + offerings + building + missions + other;

  try {
    const { error } = await db.from('giving_reports').insert({
      date,
      tithes,
      offerings,
      building_fund: building,
      missions,
      other,
      grand_total: grandTotal,
      notes,
      created_by: APP.member.id,
      member_name: APP.member.first_name + ' ' + APP.member.last_name,
    });

    if (error) {
      alert('Failed to save report.');
      auditLog('error', 'save_giving_report_error', { message: error.message });
      return;
    }

    alert('Giving report saved!');
    const form = document.getElementById('giving-report-form');
    if (form) form.style.display = 'none';
    auditLog('info', 'giving_report_saved', { date, total: grandTotal });
    loadGivingReports();
  } catch (err) {
    alert('Failed to save report.');
    auditLog('error', 'save_giving_report_error', { message: err.message });
  }
}

async function loadGivingReports() {
  if (!db) return;
  const container = document.getElementById('giving-reports-list');
  if (!container) return;

  try {
    const { data, error } = await db
      .from('giving_reports')
      .select('*')
      .order('date', { ascending: false })
      .limit(20);

    if (error || !data || data.length === 0) {
      container.innerHTML = '<div class="empty-state">No giving reports yet.</div>';
      return;
    }

    container.innerHTML = data.map((r) => `
      <div class="giving-report-card">
        <div class="report-header">
          <span class="report-date">${escHtml(r.date)}</span>
          <span class="report-total">$${(r.grand_total || 0).toFixed(2)}</span>
        </div>
        <div class="report-breakdown">
          <div>Tithes: $${(r.tithes || 0).toFixed(2)}</div>
          <div>Offerings: $${(r.offerings || 0).toFixed(2)}</div>
          <div>Building Fund: $${(r.building_fund || 0).toFixed(2)}</div>
          <div>Missions: $${(r.missions || 0).toFixed(2)}</div>
          <div>Other: $${(r.other || 0).toFixed(2)}</div>
        </div>
        ${r.notes ? `<div class="report-notes">${escHtml(r.notes)}</div>` : ''}
        <div class="report-meta">by ${escHtml(r.member_name || 'Unknown')} - ${timeAgo(r.created_at)}</div>
      </div>`).join('');
  } catch (err) {
    auditLog('error', 'load_giving_reports_error', { message: err.message });
  }
}

// Attach to window for HTML onclick handlers
window.showCreateReport = showCreateReport;
window.updateGrandTotal = updateGrandTotal;
window.saveGivingReport = saveGivingReport;
window.loadGivingReports = loadGivingReports;

export { showCreateReport, updateGrandTotal, saveGivingReport, loadGivingReports };
