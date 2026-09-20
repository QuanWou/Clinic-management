import { describe, expect, it } from 'vitest';
import { formatDate, formatMoney, formatTime } from './format';

describe('Vietnamese clinic display formatting', () => {
  it('does not shift the calendar date supplied by the API', () => {
    expect(formatDate('2026-09-20')).toBe('20/09/2026');
    expect(formatDate('not-a-date')).toBe('Ngày không hợp lệ');
  });

  it('uses a 24-hour clock and never invents an invoice currency', () => {
    expect(formatTime('14:05')).toBe('14:05');
    expect(formatMoney(200000)).not.toMatch(/\$|USD|VND|₫/);
  });
});