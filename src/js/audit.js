import CONFIG from '../config.js';
import { APP } from './state.js';

const AUDIT_URL = `${CONFIG.supabaseUrl}/functions/v1/dcc-audit`;
const SESSION_ID = Math.random().toString(36).slice(2, 10);

export function auditLog(level, event, detail = {}) {
  try {
    fetch(AUDIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CONFIG.supabaseKey}`,
      },
      body: JSON.stringify({
        level,
        event,
        detail,
        member_id: APP.member?.id || null,
        session_id: SESSION_ID,
      }),
    });
  } catch {
    /* Silent - audit failures never surface to user */
  }
}

export { SESSION_ID };
