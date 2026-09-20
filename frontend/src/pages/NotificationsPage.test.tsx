import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NotificationResponse } from '../types/domain';
import { channelLabel, deliveryLabel, filterInbox, inboxCounts, notificationMoment } from '../utils/notificationInbox';

vi.mock('../config/integrations.config', () => ({ integrations: { notifications: true } }));
import NotificationsPage from './NotificationsPage';

const inbox: NotificationResponse[] = [
  { id: 'one', subject: 'Lịch hẹn đã xác nhận', content: 'Có thay đổi lịch.', type: 'IN_APP', status: 'SENT', readAt: null, createdAt: '2026-09-20T09:00:00Z' },
  { id: 'two', subject: 'Hóa đơn', content: 'Đã ghi nhận thu tiền.', type: 'EMAIL', status: 'FAILED', readAt: '2026-09-20T12:00:00Z', createdAt: '2026-09-20T11:00:00Z' },
  { id: 'three', subject: 'Kết quả xét nghiệm', content: 'Có cập nhật mới.', type: 'IN_APP', status: 'PENDING', readAt: null, createdAt: '2026-09-20T13:00:00Z' }
];

describe('personal notification workspace', () => {
  it('renders its scoped inbox without inventing messages or staff-wide controls', () => {
    const html = renderToStaticMarkup(<NotificationsPage />);
    expect(html).toContain('notifications-workspace');
    expect(html).toContain('HỘP THƯ CÁ NHÂN');
    expect(html).toContain('Đang tải thông báo');
    expect(html).toContain('Tùy chọn nhận tin');
    expect(html).toContain('Chỉ dữ liệu từ API /my');
    expect(html).not.toContain('Đánh dấu tất cả đã đọc');
    expect(html).not.toContain('Danh sách thông báo toàn hệ thống');
    expect(html).not.toContain('Hóa đơn đã thanh toán thành công');
  });

  it('shows a doctor-only inbox layout with an unread focus and no global notification actions', () => {
    const doctorHtml = renderToStaticMarkup(<NotificationsPage role="DOCTOR" />);
    const adminHtml = renderToStaticMarkup(<NotificationsPage role="ADMIN" />);
    expect(doctorHtml).toContain('doctor-notifications');
    expect(doctorHtml).toContain('Thông báo bác sĩ');
    expect(doctorHtml).toContain('KHÔNG GIAN BÁC SĨ');
    expect(doctorHtml).toContain('Thông báo chưa đọc của tôi');
    expect(doctorHtml).toContain('Đang tải thông báo cá nhân');
    expect(doctorHtml).toContain('Chỉ dữ liệu từ API /my');
    expect(doctorHtml).not.toContain('Đánh dấu tất cả đã đọc');
    expect(doctorHtml).not.toContain('Danh sách thông báo toàn hệ thống');
    expect(adminHtml).not.toContain('doctor-notifications');
    expect(adminHtml).not.toContain('Thông báo chưa đọc của tôi');
  });

  it('derives counts strictly from the authenticated inbox and distinguishes reading from delivery', () => {
    expect(inboxCounts(inbox)).toEqual({ total: 3, unread: 2, read: 1, failed: 1 });
    expect(inboxCounts([])).toEqual({ total: 0, unread: 0, read: 0, failed: 0 });
    expect(deliveryLabel('SENT')).toBe('Đã xử lý gửi');
    expect(deliveryLabel('FAILED')).toBe('Gửi thất bại');
    expect(channelLabel('IN_APP')).toBe('Trong ứng dụng');
  });

  it('filters by read state, channel and text without modifying source rows', () => {
    expect(filterInbox(inbox, '', 'UNREAD', 'ALL').map((item) => item.id)).toEqual(['one', 'three']);
    expect(filterInbox(inbox, '', 'READ', 'IN_APP')).toEqual([]);
    expect(filterInbox(inbox, 'hÓa Đơn', 'ALL', 'EMAIL').map((item) => item.id)).toEqual(['two']);
    expect(filterInbox(inbox, 'no match', 'ALL', 'ALL')).toEqual([]);
    expect(inbox).toHaveLength(3);
  });

  it('handles missing and invalid dates without making up timestamps', () => {
    expect(notificationMoment(null)).toBe('Chưa có thời gian');
    expect(notificationMoment('not a timestamp')).toBe('Thời gian không hợp lệ');
    expect(notificationMoment('2026-09-20T10:00:00Z')).toContain('2026');
  });
});
