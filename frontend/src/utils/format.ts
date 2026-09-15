export function formatDate(value?: string | null): string {
  if (!value) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  }).format(new Date(value));
}

export function formatTime(value?: string | null): string {
  if (!value) {
    return '--:--';
  }

  const [hour = '0', minute = '0'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hour), Number(minute), 0, 0);

  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatMoney(value?: number | string | null): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
}

export function shortId(value?: string | null): string {
  return value ? value.slice(0, 8).toUpperCase() : 'N/A';
}
