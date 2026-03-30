import db from './supabase.js';
import { auditLog } from './audit.js';

export async function loadScripture() {
  if (!db) return;

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await db
      .from('daily_scripture')
      .select('*')
      .eq('date', today)
      .single();

    if (error || !data) {
      const scriptureEl = document.getElementById('daily-scripture');
      if (scriptureEl) {
        scriptureEl.innerHTML = `
          <div class="scripture-card">
            <div class="scripture-text">"For I know the plans I have for you," declares the LORD.</div>
            <div class="scripture-ref">Jeremiah 29:11</div>
          </div>`;
      }
      return;
    }

    const scriptureEl = document.getElementById('daily-scripture');
    if (scriptureEl) {
      scriptureEl.innerHTML = `
        <div class="scripture-card">
          <div class="scripture-text">"${data.text}"</div>
          <div class="scripture-ref">${data.reference}</div>
          ${data.reflection ? `<div class="scripture-reflection">${data.reflection}</div>` : ''}
        </div>`;
    }
  } catch (err) {
    auditLog('error', 'load_scripture_error', { message: err.message });
  }
}
