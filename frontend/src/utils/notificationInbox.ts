import type { NotificationResponse, NotificationStatus, NotificationType } from '../types/domain';

export type InboxFilter = 'ALL' | 'UNREAD' | 'READ';
export type InboxChannelFilter = 'ALL' | NotificationType;

export function inboxCounts(items: NotificationResponse[]) {
  const unread = items.filter((item) => !item.readAt).length;
  return { total: items.length, unread, read: items.length - unread, failed: items.filter((item) => item.status === 'FAILED').length };
}

export function filterInbox(items: NotificationResponse[], text: string, state: InboxFilter, channel: InboxChannelFilter) {
  const query = text.trim().toLocaleLowerCase('vi-VN');
  return items.filter((item) => {
    if (state === 'UNREAD' && item.readAt) return false;
    if (state === 'READ' && !item.readAt) return false;
    if (channel !== 'ALL' && item.type !== channel) return false;
    return !query || [item.subject, item.content, item.id].some((value) => value.toLocaleLowerCase('vi-VN').includes(query));
  });
}

export function channelLabel(type: NotificationType): string {
  return { IN_APP: 'Trong ứng dụng', EMAIL: 'Email', SMS: 'SMS', PUSH: 'Push' }[type] ?? type;
}

/** Sending state is NOT the same as the recipient's read state. */
export function deliveryLabel(status: NotificationStatus): string {
  return ({ PENDING: 'Đang xử lý', SENT: 'Đã xử lý gửi', FAILED: 'Gửi thất bại', SKIPPED: 'Đã bỏ qua' } as Record<string, string>)[status] ?? 'Chưa xác định';
}

export function notificationMoment(value?: string | null): string {
  if (!value) return 'Chưa có thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian không hợp lệ';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}
