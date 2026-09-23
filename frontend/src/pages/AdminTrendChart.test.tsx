import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AdminTrendChart, { groupHistoryDays } from './AdminTrendChart';

const days = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 7, 22 + index)).toISOString().slice(0, 10),
  appointments: index === 2 ? 4 : 0,
  checkIns: index === 2 ? 3 : 0,
  completedVisits: 0,
  cancelledAppointments: 0
}));

describe('admin 30-day grouped volume chart', () => {
  it('groups all 30 days into six equal five-day periods without inventing or losing counts', () => {
    const grouped = groupHistoryDays(days);
    expect(grouped).toHaveLength(6);
    expect(grouped[0]).toMatchObject({ from: '2026-08-22', to: '2026-08-26',
      dayCount: 5, appointments: 4, checkIns: 3 });
    expect(grouped[1]).toMatchObject({ from: '2026-08-27', to: '2026-08-31',
      dayCount: 5, appointments: 0, checkIns: 0 });
    expect(grouped[5].to).toBe('2026-09-20');
    expect(grouped.reduce((sum, group) => sum + group.appointments, 0)).toBe(4);
    expect(grouped.reduce((sum, group) => sum + group.checkIns, 0)).toBe(3);
  });

  it('defaults to zero-based paired columns with six accessible periods and complete daily table', () => {
    const html = renderToStaticMarkup(<AdminTrendChart days={days} from="2026-08-22" to="2026-09-20" />);
    expect(html).toContain('admin-volume-bar bookings');
    expect(html).toContain('admin-volume-bar checkins');
    expect(html).toContain('tổng theo từng nhóm 5 ngày');
    expect(html).toContain('22/08–26/08');
    expect(html).toContain('aria-pressed="true">5 ngày');
    expect(html).toContain('aria-pressed="false">Từng ngày');
    expect(html).toContain('22/08/2026 – 26/08/2026: 4 lịch hẹn, 3 check-in');
    expect(html).toContain('Xem bảng số liệu 30 ngày');
    expect((html.match(/<tr>/g) ?? []).length).toBe(31);
    expect((html.match(/class="admin-volume-group"/g) ?? []).length).toBe(6);
    expect(html).not.toContain('admin-trend-line');
  });

  it('keeps incomplete groups explicit instead of pretending they represent full weeks', () => {
    const grouped = groupHistoryDays(days.slice(0, 7));
    expect(grouped.map(({ dayCount }) => dayCount)).toEqual([5, 2]);
    expect(() => groupHistoryDays(days, 0)).toThrow('Invalid period size');
  });
});
