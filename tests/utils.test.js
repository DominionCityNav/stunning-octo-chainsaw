import { describe, it, expect } from 'vitest';
import { escHtml, timeAgo, getMonday } from '../src/js/utils.js';

describe('escHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    expect(escHtml('A & B')).toBe('A &amp; B');
  });

  it('returns empty string for null/undefined', () => {
    expect(escHtml(null)).toBe('');
    expect(escHtml(undefined)).toBe('');
    expect(escHtml('')).toBe('');
  });

  it('passes through safe strings unchanged', () => {
    expect(escHtml('Hello World')).toBe('Hello World');
  });
});

describe('timeAgo', () => {
  it('returns "Just now" for recent timestamps', () => {
    expect(timeAgo(new Date().toISOString())).toBe('Just now');
  });

  it('returns minutes for timestamps less than an hour ago', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(timeAgo(tenMinsAgo)).toBe('10m ago');
  });

  it('returns hours for timestamps less than a day ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for older timestamps', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2d ago');
  });
});

describe('getMonday', () => {
  it('returns a date string in YYYY-MM-DD format', () => {
    const monday = getMonday();
    expect(monday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a Monday', () => {
    const monday = getMonday();
    const date = new Date(monday + 'T12:00:00');
    expect(date.getDay()).toBe(1);
  });
});
