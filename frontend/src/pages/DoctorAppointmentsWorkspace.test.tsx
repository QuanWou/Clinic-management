import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReceptionVisitResponse } from '../types/domain';
import { doctorQueueCounts, filterDoctorVisits, shiftClinicDay } from '../utils/doctorAppointments';
import { allowedQueueTransitions } from './ReceptionAppointmentsPage';

vi.mock('../config/integrations.config', () => ({ integrations: { appointmentOwnership: true, reception: true } }));
import AppointmentsPage from './AppointmentsPage';
import DoctorAppointmentsWorkspace from './DoctorAppointmentsWorkspace';

const visits: ReceptionVisitResponse[] = [
  { id: 'visit-b', appointmentId: 'booking-b', patientId: 'patient-b', doctorId: 'doctor-owned', visitDate: '2026-09-20', queueNumber: 2,
    status: 'CALLED', checkedInAt: '2026-09-20T08:00:00', startedAt: null, completedAt: null },
  { id: 'visit-a', appointmentId: 'booking-a', patientId: 'patient-a', doctorId: 'doctor-owned', visitDate: '2026-09-20', queueNumber: 1,
    status: 'WAITING', checkedInAt: '2026-09-20T08:00:00', startedAt: null, completedAt: null },
  { id: 'visit-c', appointmentId: 'booking-c', patientId: 'patient-c', doctorId: 'doctor-owned', visitDate: '2026-09-20', queueNumber: 3,
    status: 'IN_PROGRESS', checkedInAt: '2026-09-20T08:00:00', startedAt: '2026-09-20T08:10:00', completedAt: null },
  { id: 'visit-d', appointmentId: 'booking-d', patientId: 'patient-d', doctorId: 'doctor-owned', visitDate: '2026-09-20', queueNumber: 4,
    status: 'COMPLETED', checkedInAt: '2026-09-20T08:00:00', startedAt: '2026-09-20T08:10:00', completedAt: '2026-09-20T08:30:00' }
];
const props = { appointments: null, error: null, loading: false, onRefresh: () => undefined };

describe('doctor-owned appointments UI', () => {
  it('renders a separate doctor workspace and no reception-wide or patient booking controls', () => {
    const html = renderToStaticMarkup(<AppointmentsPage {...props} role="DOCTOR" />);
    expect(html).toContain('doctor-appointments-workspace');
    expect(html).toContain('Lịch hẹn của tôi');
    expect(html).toContain('Hàng đợi được phân công'.toLocaleUpperCase('vi-VN'));
    expect(html).toContain('Mã lịch hẹn');
    expect(html).toContain('Hàng đợi chỉ hiển thị lượt đã check-in được phân công cho bạn.');
    expect(html).not.toContain('Đặt lịch cho bệnh nhân');
    expect(html).not.toContain('New Appointment');
    expect(html).not.toContain('Doanh thu');
  });

  it('does not show unverified check-in totals or fake patients before loading', () => {
    const html = renderToStaticMarkup(<DoctorAppointmentsWorkspace />);
    expect(html).toContain('Đang tải hàng đợi đã check-in');
    expect(html).not.toContain('doctor-appointments-metrics');
    expect(html).not.toContain('Sarah Lee');
    expect(html).not.toContain('Lượt khám đã hoàn tất.');
    expect(html).not.toContain('Xác nhận lịch hẹn');
  });

  it('keeps other roles in their existing screens, rather than exposing doctor queue', () => {
    for (const role of ['PATIENT', 'ADMIN', 'RECEPTIONIST'] as const) {
      const html = renderToStaticMarkup(<AppointmentsPage {...props} appointments={[]} role={role} />);
      expect(html).not.toContain('doctor-appointments-workspace');
      if (role === 'PATIENT') expect(html).toContain('patient-portal');
      else expect(html).not.toContain('patient-portal');
    }
  });

  it('counts only returned checked-in visits and filters without mutating server data', () => {
    const before = visits.map((item) => item.id);
    expect(doctorQueueCounts(visits)).toEqual({ checkedIn: 4, waiting: 2, inProgress: 1, completed: 1 });
    expect(doctorQueueCounts([])).toEqual({ checkedIn: 0, waiting: 0, inProgress: 0, completed: 0 });
    expect(filterDoctorVisits(visits, '', 'ALL').map((item) => item.id)).toEqual(['visit-a', 'visit-b', 'visit-c', 'visit-d']);
    expect(filterDoctorVisits(visits, 'PATIENT-B', 'CALLED').map((item) => item.id)).toEqual(['visit-b']);
    expect(filterDoctorVisits(visits, 'booking-a', 'IN_PROGRESS')).toEqual([]);
    expect(visits.map((item) => item.id)).toEqual(before);
  });

  it('preserves clinic calendar boundaries and the exact backend queue transition order', () => {
    expect(shiftClinicDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftClinicDay('2028-03-01', -1)).toBe('2028-02-29');
    expect(allowedQueueTransitions('WAITING', 'DOCTOR')).toEqual(['CALLED', 'SKIPPED']);
    expect(allowedQueueTransitions('CALLED', 'DOCTOR')).toEqual(['IN_PROGRESS', 'SKIPPED']);
    expect(allowedQueueTransitions('IN_PROGRESS', 'DOCTOR')).toEqual(['COMPLETED']);
    expect(allowedQueueTransitions('COMPLETED', 'DOCTOR')).toEqual([]);
  });
});
