import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from './DashboardPage';
import ReceptionDashboard from './ReceptionDashboard';
import type { AppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import type { StaffDashboard } from '../api/staffDashboard';

const user = { id: 'reception-account', email: 'reception@clinic.test', roles: ['ROLE_RECEPTIONIST'] };
const noop = () => undefined;
const date = '2026-09-20';
const appointment = (id: string, status: AppointmentResponse['status'], time: string): AppointmentResponse => ({
  id, patientId: `patient-${id}`, doctorId: 'doctor-a', appointmentDate: date,
  startTime: time, endTime: '12:00', status
});
const visit = (appointmentId: string, status: ReceptionVisitResponse['status'], number: number): ReceptionVisitResponse => ({
  id: `visit-${number}`, appointmentId, patientId: `patient-${appointmentId}`, doctorId: 'doctor-a',
  visitDate: date, queueNumber: number, status, checkedInAt: `${date}T09:00:00`, startedAt: null, completedAt: null
});
const data: StaffDashboard = {
  scope: 'RECEPTION', date,
  appointments: [appointment('pending', 'PENDING', '08:00'), appointment('ready', 'CONFIRMED', '09:00'),
    appointment('checked', 'CONFIRMED', '10:00'), appointment('cancelled', 'CANCELLED', '11:00')],
  queue: [visit('checked', 'WAITING', 7)]
};
function render(view: StaffDashboard = data) {
  return renderToStaticMarkup(<DashboardPage dashboard={null} staffDashboard={view} user={user} role="RECEPTIONIST"
    error={null} loading={false} onRefresh={noop} onNavigate={noop} />);
}

describe('receptionist dashboard visual workspace and data boundaries', () => {
  it('renders role-specific operational figures, avoids re-checking in a queued patient, and hides restricted data', () => {
    const html = render();
    expect(html).toContain('reception-dashboard-hero');
    expect(html).toContain('Trung tâm tiếp đón bệnh nhân');
    expect(html).toContain('Lịch hẹn hôm nay');
    expect(html).toContain('4</strong>');
    expect(html).toContain('1</strong>');
    expect(html).toContain('Chờ xác nhận');
    expect(html).toContain('Chờ check-in');
    expect(html).toContain('Hàng đợi hôm nay');
    expect(html).toContain('BN PATIENT-');
    expect(html).not.toContain('Lịch #CHECKED');
    expect(html).not.toContain('BN PATIENT-CA');
    expect(html).not.toContain('Doanh thu');
    expect(html).not.toContain('Hồ sơ bệnh án');
    expect(html).not.toContain('admin-overview');
    expect(html).not.toContain('doctor-dashboard');
  });

  it('distinguishes a genuine empty day from unavailable 30-day history', () => {
    const html = render({ scope: 'RECEPTION', date, appointments: [], queue: [], historyError: 'API lịch sử từ chối' });
    expect(html).toContain('Không có lịch đang chờ tiếp nhận');
    expect(html).toContain('Chưa có lượt check-in hôm nay');
    expect(html).toContain('Báo cáo 30 ngày chưa khả dụng');
    expect(html).toContain('API lịch sử từ chối');
    expect(html).not.toContain('reception-dashboard-chart-bars');
  });

  it('renders 30-day charts only for the correct verified reception history', () => {
    const days = Array.from({ length: 30 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 7, 22 + index)).toISOString().slice(0, 10),
      appointments: index === 0 ? 4 : 0, checkIns: index === 0 ? 2 : 0,
      completedVisits: 0, cancelledAppointments: 0
    }));
    const html = render({ ...data, history: { scope: 'RECEPTION', from: '2026-08-22', to: date, days } });
    expect(html).toContain('Xu hướng tiếp nhận 30 ngày');
    expect(html).toContain('4 lịch hẹn, 2 check-in');
    expect(html).toContain('reception-dashboard-chart-bars');
    const wrong = render({ ...data, history: { scope: 'DOCTOR', from: '2026-08-22', to: date, days } });
    expect(wrong).toContain('Báo cáo 30 ngày chưa khả dụng');
    expect(wrong).not.toContain('reception-dashboard-chart-bars');
  });

  it('fails closed when a doctor queue or records from another day are passed into the receptionist view', () => {
    const wrongScope = render({ scope: 'DOCTOR', date, queue: [visit('private', 'WAITING', 3)] });
    expect(wrongScope).toContain('Phạm vi dashboard không khớp');
    expect(wrongScope).not.toContain('patient-private');
    const wrongDate = render({ ...data, appointments: [{ ...data.appointments[0], appointmentDate: '2026-09-19' }] });
    expect(wrongDate).toContain('không khớp ngày tiếp nhận');
    expect(wrongDate).not.toContain('patient-pending');
    const wrongQueue = render({ ...data, queue: [{ ...data.queue[0], visitDate: '2026-09-19' }] });
    expect(wrongQueue).toContain('không khớp ngày tiếp nhận');
    expect(wrongQueue).not.toContain('patient-checked');
  });

  it('keeps navigation dedicated to receptionist workflows without admin or doctor-only controls', () => {
    const html = renderToStaticMarkup(<ReceptionDashboard data={data} onNavigate={noop} />);
    expect(html).toContain('Mở bàn tiếp đón');
    expect(html).toContain('Tìm bệnh nhân');
    expect(html).toContain('Xử lý tại trang Lịch hẹn');
    expect(html).not.toContain('Hoàn tất khám</button>');
    expect(html).not.toContain('Cấu hình hệ thống');
    expect(html).not.toContain('doctor-profile');
  });
});
