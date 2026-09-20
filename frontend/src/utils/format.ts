export function formatDate(value?: string | null): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value));
}

export function formatTime(value?: string | null): string {
  if (!value) return '--:--';
  const [hour = '0', minute = '0'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(date);
}

// Formats a numeric amount only. Callers must render a server-supplied currency;
// this function never guesses USD/VND from a locale.
export function formatMoney(value?: number | string | null): string {
  if (value == null) return 'Not available';
  const amount = Number(value);
  return Number.isFinite(amount) ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(amount) : 'Not available';
}

export function shortId(value?: string | null): string {
  return value ? value.slice(0, 8).toUpperCase() : 'N/A';
}
