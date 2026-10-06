import {describe, expect, it} from 'vitest';
import {parseVnd} from '../utils/vnd';

describe('VND input meaning', () => {
  it.each([['1000',1000],['1.000',1000],['45.000',45000],['1.234.567',1234567],[' 1.000 ',1000]])(
    '%s preserves the intended integer amount', (input, amount) => expect(parseVnd(input)).toBe(amount));
  it.each(['', '1,5', '1.5', '1.0000', '-1000', '1e3', '9000000000001', 'Infinity', '1 000']) (
    'refuses ambiguous or unsupported %s', input => expect(() => parseVnd(input)).toThrow());
  it('allows zero only for a declared balance or catalog price', () => {
    expect(parseVnd('0',true)).toBe(0);
    expect(() => parseVnd('0')).toThrow();
  });
});
