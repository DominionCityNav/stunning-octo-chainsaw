import { createClient } from '@supabase/supabase-js';
import CONFIG from '../config.js';

let db = null;

try {
  db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'implicit',
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
} catch {
  /* Will show error on first PIN attempt */
}

export default db;
