export function formatDate(value?: string | null): string {
  if (!value) return 'Chưa có dữ liệu';
  // Date-only API values are local calendar days, not UTC instants.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Ngày không hợp lệ';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

export function formatTime(value?: string | null): string {
  if (!value) return '--:--';
  const [hour = '0', minute = '0'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
}

// Formats a numeric amount only. Callers must render a server-supplied currency;
// this function never guesses USD/VND from a locale.
export function formatMoney(value?: number | string | null): string {
  if (value == null) return 'Not available';
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount) : 'Not available';
}

/** Format money with the source currency; never relabel an unknown amount as VND. */
export function formatCurrency(value: number | string | null | undefined, currency?: string | null): string {
  const amount = formatMoney(value);
  if (amount === 'Not available') return 'Chưa có dữ liệu';
  return `${amount} ${currency?.trim() || '(chưa xác định đơn vị)'}`;
}

/** Consultation fees in this clinic are configured in VND; no amount conversion is performed. */
export function formatVnd(value: number | string | null | undefined): string {
  return formatCurrency(value, 'VND');
}

export function shortId(value?: string | null): string {
  return value ? value.slice(0, 8).toUpperCase() : 'N/A';
}
