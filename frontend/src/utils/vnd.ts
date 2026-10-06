export const VND_LIMIT = 9_000_000_000_000;
export const formatVnd = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(amount);

/** Accept integer dong or Vietnamese thousands groups; never interpret dots as decimals. */
export function parseVnd(value: string, allowZero = false): number {
  const text = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)$/.test(text)) {
    throw new Error('Nhập số tiền nguyên, ví dụ 1000 hoặc 1.000. Không dùng dấu phẩy, số lẻ hoặc số âm.');
  }
  const amount = Number(text.replaceAll('.', ''));
  if (!Number.isSafeInteger(amount) || amount > VND_LIMIT || amount < (allowZero ? 0 : 1)) {
    throw new Error(allowZero
      ? 'Số tiền phải từ 0 đến 9.000.000.000.000 đồng.'
      : 'Số tiền phải lớn hơn 0 và tối đa 9.000.000.000.000 đồng.');
  }
  return amount;
}
