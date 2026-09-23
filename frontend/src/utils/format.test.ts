import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate, formatMoney, formatTime, formatVnd } from './format';

describe('Vietnamese clinic display formatting', () => {
  it('does not shift the calendar date supplied by the API', () => {
    expect(formatDate('2026-09-20')).toBe('20/09/2026');
    expect(formatDate('not-a-date')).toBe('Ngày không hợp lệ');
  });

  it('uses a 24-hour clock and never invents an invoice currency', () => {
    expect(formatTime('14:05')).toBe('14:05');
    expect(formatMoney(200000)).not.toMatch(/\$|USD|VND|₫/);
  });

  it('formats Vietnamese-dong prices without modifying amounts or inventing currencies', () => {
    expect(formatVnd('150000.00')).toBe('150.000 VND');
    expect(formatVnd(0)).toBe('0 VND');
    expect(formatCurrency('125000.50', 'VND')).toBe('125.000,5 VND');
    expect(formatCurrency('200000', 'USD')).toBe('200.000 USD');
    expect(formatCurrency('200000', null)).toBe('200.000 (chưa xác định đơn vị)');
    expect(formatCurrency(null, 'VND')).toBe('Chưa có dữ liệu');
  });
});