import { describe, it, expect } from 'vitest';
import CONFIG from '../src/config.js';

describe('CONFIG', () => {
  it('has required identity fields', () => {
    expect(CONFIG.churchName).toBe('Dominion City Church');
    expect(CONFIG.shortName).toBe('DCC');
    expect(CONFIG.pastor).toBeTruthy();
  });

  it('has valid Supabase config', () => {
    expect(CONFIG.supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(CONFIG.supabaseKey).toBeTruthy();
    expect(CONFIG.supabaseKey.length).toBeGreaterThan(20);
  });

  it('has giving links configured', () => {
    expect(CONFIG.giving.square).toContain('square');
    expect(CONFIG.giving.zelle).toContain('@');
    expect(CONFIG.giving.cashapp).toMatch(/^\$/);
  });

  it('has contact information', () => {
    expect(CONFIG.phone).toMatch(/\d{3}-\d{3}-\d{4}/);
    expect(CONFIG.email).toContain('@');
    expect(CONFIG.address).toBeTruthy();
    expect(CONFIG.city).toBe('Navasota');
    expect(CONFIG.state).toBe('TX');
  });

  it('has mission and vision', () => {
    expect(CONFIG.mission.length).toBeGreaterThan(20);
    expect(CONFIG.vision.length).toBeGreaterThan(20);
  });
});
