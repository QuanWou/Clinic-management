import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from './DashboardPage';
import DoctorDashboard, { groupDoctorHistory } from './DoctorDashboard';
import type { ReceptionVisitResponse } from '../types/domain';

const doctor = { id: 'doctor-user', email: 'doctor@clinic.test', fullName: 'Bác sĩ thử nghiệm', roles: ['ROLE_DOCTOR'] };
const noop = () => undefined;
const visit = (status: ReceptionVisitResponse['status'], number: number): ReceptionVisitResponse => ({
  id: `visit-${number}`, appointmentId: `appointment-${number}`, patientId: `patient-${number}`,
  patientName: `Bệnh nhân số ${number}`,
  doctorId: 'doctor-current', visitDate: '2026-09-20', queueNumber: number,
  status, checkedInAt: '2026-09-20T08:30:00', startedAt: null, completedAt: null
});

function render(queue: ReceptionVisitResponse[] = [], history?: Parameters<typeof DoctorDashboard>[0]['data']['history']) {
  return renderToStaticMarkup(<DashboardPage dashboard={null} user={doctor} role="DOCTOR" error={null} loading={false}
    onRefresh={noop} onNavigate={noop} staffDashboard={{ scope: 'DOCTOR', date: '2026-09-20', queue, history }} />);
}

describe('doctor dashboard design and data boundaries', () => {
  it('shows a proper empty state without claiming appointments or global metrics', () => {
    const html = render();
    expect(html).toContain('doctor-dashboard');
    expect(html).toContain('Hàng đợi của bác sĩ hôm nay');
    expect(html).toContain('Chưa có lượt check-in hôm nay');
    expect(html).toContain('Báo cáo 30 ngày chưa khả dụng');
    expect(html).not.toContain('admin-overview');
    expect(html).not.toContain('Doanh thu');
    expect(html).not.toContain('Hồ sơ bệnh án của tôi');
    expect(html).not.toContain('Lịch hẹn hôm nay');
  });

  it('counts actual queue status, prioritizes in-progress visits, and shows verified patient names', () => {
    const html = render([visit('WAITING', 9), visit('COMPLETED', 1), visit('CALLED', 7), visit('IN_PROGRESS', 3), visit('SKIPPED', 8)]);
    expect(html).toContain('5 lượt trong hàng đợi');
    expect(html).toContain('2 lượt đang chờ hoặc đã gọi vào khám');
    expect(html).toContain('Bệnh nhân số 3');
    expect(html).toContain('Check-in 08:30');
    expect(html.indexOf('Mã lịch APPOINTM')).toBeGreaterThan(0);
    expect(html).not.toContain('Mã bệnh nhân PATIENT-');
    expect(html).not.toContain('private-staff-appointment');
    expect(html).not.toContain('Hóa đơn');
  });

  it('places the queue and priority visit side by side with shortcuts in their own full-width row', () => {
    const html = render([visit('WAITING', 1)]);
    const work = html.split('<section class="doctor-dashboard-work"')[1];
    expect(work).toBeDefined();
    expect(work).toMatch(/<\/article><article class="panel doctor-dashboard-next-panel"/);
    expect(work).toMatch(/<\/article><article class="doctor-dashboard-shortcuts"/);
    expect(work).not.toContain('doctor-dashboard-work-side');
    expect(work).toContain('Hồ sơ bệnh án');
    expect(work).toContain('Hồ sơ bác sĩ');
  });

  it('renders only a verified 30-day doctor scope and distinguishes unavailable history from empty history', () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 22 + index)).toISOString().slice(0, 10),
      appointments: 99, checkIns: index === 0 ? 3 : 0, completedVisits: index === 0 ? 2 : 0,
      cancelledAppointments: 99
    }));
    const html = render([], { from: '2026-08-22', to: '2026-09-20', scope: 'DOCTOR', days });
    expect(html).toContain('Hoạt động 30 ngày của tôi');
    expect(html).toContain('3 lượt check-in và 2 lượt khám hoàn tất');
    expect(html).toContain('doctor-dashboard-chart-layout');
    expect(html).toContain('doctor-dashboard-chart-scale');
    expect(html).toContain('6 giai đoạn, mỗi giai đoạn 5 ngày');
    expect(html).not.toContain('doctor-dashboard-chart-scroll');
    expect(html).toContain('22/08/2026 đến 26/08/2026: 3 lượt check-in, 2 lượt khám hoàn tất');
    expect((html.match(/class="doctor-dashboard-chart-day"/g) ?? [])).toHaveLength(6);
    expect(groupDoctorHistory(days)).toHaveLength(6);
    expect(groupDoctorHistory(days)[0]).toEqual({ from: '2026-08-22', to: '2026-08-26', checkIns: 3, completedVisits: 2 });
    expect(html).not.toContain('99 lịch hẹn');
    expect(html).not.toContain('Báo cáo 30 ngày chưa khả dụng');
    const wrongScope = renderToStaticMarkup(<DoctorDashboard data={{ scope: 'DOCTOR', date: '2026-09-20', queue: [],
      history: { from: '2026-08-22', to: '2026-09-20', scope: 'RECEPTION', days } }} />);
    expect(wrongScope).toContain('Báo cáo 30 ngày chưa khả dụng');
  });

  it('preserves all 30 days and labels periods crossing a month boundary unambiguously', () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 24 + index)).toISOString().slice(0, 10),
      appointments: 0, checkIns: index + 1, completedVisits: index % 2,
      cancelledAppointments: 0
    }));
    const periods = groupDoctorHistory(days);
    expect(periods).toHaveLength(6);
    expect(periods.reduce((sum, period) => sum + period.checkIns, 0)).toBe(465);
    expect(periods.reduce((sum, period) => sum + period.completedVisits, 0)).toBe(15);
    expect(periods[1]).toEqual({ from: '2026-08-29', to: '2026-09-02', checkIns: 40, completedVisits: 3 });
    const html = renderToStaticMarkup(<DoctorDashboard data={{ scope: 'DOCTOR', date: '2026-09-22', queue: [],
      history: { from: '2026-08-24', to: '2026-09-22', scope: 'DOCTOR', days } }} />);
    expect(html).toContain('29/08–02/09');
    expect(html).toContain('465 lượt check-in và 15 lượt khám hoàn tất');
  });

  it('fails closed for another role’s scope or records from the wrong date', () => {
    const reception = renderToStaticMarkup(<DoctorDashboard data={{ scope: 'RECEPTION', date: '2026-09-20', appointments: [], queue: [visit('WAITING', 9)] }} />);
    expect(reception).toContain('Phạm vi dashboard không khớp');
    expect(reception).not.toContain('Bệnh nhân số 9');
    const wrongDate = renderToStaticMarkup(<DoctorDashboard data={{ scope: 'DOCTOR', date: '2026-09-19', queue: [visit('WAITING', 9)] }} />);
    expect(wrongDate).toContain('Hàng đợi không khớp ngày khám');
    expect(wrongDate).not.toContain('Bệnh nhân số 9');
  });
});
