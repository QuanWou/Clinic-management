import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ReceptionAppointmentsOverview, { appointmentQueueStatus, calendarDays, filterReceptionAppointments } from './ReceptionAppointmentsOverview';
import type { ReceptionAppointmentResponse, ReceptionVisitResponse } from '../types/domain';

const appointments: ReceptionAppointmentResponse[] = [
  { id: 'booking-a', patientId: 'patient-a', patientName: 'Nguyễn An', doctorId: 'doctor-1', appointmentDate: '2026-09-20', startTime: '08:30', endTime: '09:00', status: 'CONFIRMED', reason: 'Khám định kỳ' },
  { id: 'booking-b', patientId: 'patient-b', patientName: 'Trần Bình', doctorId: 'doctor-2', appointmentDate: '2026-09-20', startTime: '09:30', endTime: '10:00', status: 'PENDING', reason: 'Đau đầu' },
  { id: 'booking-c', patientId: 'patient-c', patientName: 'Lê Chi', doctorId: 'doctor-1', appointmentDate: '2026-09-20', startTime: '10:30', endTime: '11:00', status: 'CANCELLED' }
];
const queue: ReceptionVisitResponse[] = [{
  id: 'visit-a', appointmentId: 'booking-a', patientId: 'patient-a', patientName: 'Nguyễn An', doctorId: 'doctor-1', visitDate: '2026-09-20',
  queueNumber: 1, status: 'WAITING', checkedInAt: '2026-09-20T08:00:00', startedAt: null, completedAt: null
}];
const noop = () => undefined;

describe('reception appointments visual overview', () => {
  it('builds a Monday-first calendar with correct leap month boundaries and no guessed days', () => {
    const february = calendarDays('2028-02');
    expect(february).toHaveLength(35);
    expect(february[0]).toBeNull();
    expect(february[1]).toBe('2028-02-01');
    expect(february).toContain('2028-02-29');
    expect(february).not.toContain('2028-02-30');
    expect(calendarDays('2026-13')).toEqual([]);
  });

  it('filters by actual doctor and appointment/queue statuses without mutating API rows', () => {
    const untouched = appointments.map((item) => item.id);
    expect(appointmentQueueStatus(appointments[0], queue)).toBe('WAITING');
    expect(filterReceptionAppointments(appointments, queue, '', 'WAITING', '').map((item) => item.id)).toEqual(['booking-a']);
    expect(filterReceptionAppointments(appointments, queue, 'doctor-2', 'PENDING', '').map((item) => item.id)).toEqual(['booking-b']);
    expect(filterReceptionAppointments(appointments, queue, '', 'ALL', 'đau đầu').map((item) => item.id)).toEqual(['booking-b']);
    expect(filterReceptionAppointments(appointments, queue, '', 'CONFIRMED', '')).toEqual([]);
    expect(appointments.map((item) => item.id)).toEqual(untouched);
  });

  it('renders real daily counts, accessible date/filter controls and an actual empty state', () => {
    const html = renderToStaticMarkup(<ReceptionAppointmentsOverview date="2026-09-20" appointments={appointments}
      queue={queue} doctors={[{ id: 'doctor-1', userId: 'identity-1', specialtyName: 'Tim mạch', fullName: 'Nguyễn Minh Khôi' }]}
      selectedId="" onDateChange={noop} onSelect={noop} />);
    expect(html).toContain('Tất cả lịch hẹn');
    expect(html).toContain('Lịch ngày đã chọn');
    expect(html).toContain('aria-label="Ngày lịch hẹn"');
    expect(html).toContain('aria-label="Lọc theo trạng thái"');
    expect(html).toContain('aria-label="Tháng sau"');
    expect(html).toContain('Nguyễn An');
    expect(html).toContain('Tim mạch');
    expect(html).toContain('BS. Nguyễn Minh Khôi');
    expect(html).toContain('Đang chờ');
    expect(html).toContain('3 trên 3 lịch phù hợp');
    expect(html).not.toContain('Sarah Lee');
    expect(html).not.toContain('186');
    expect(html).not.toContain('vs last month');
    const empty = renderToStaticMarkup(<ReceptionAppointmentsOverview date="2026-09-20" appointments={[]}
      queue={[]} doctors={null} selectedId="" onDateChange={noop} onSelect={noop} />);
    expect(empty).toContain('Không có lịch hẹn trong ngày đã chọn.');
    expect(empty).toContain('Không có lịch hẹn đang hoạt động trong ngày.');
  });

  it('paginates a populated day without claiming a monthly total', () => {
    const many = Array.from({ length: 14 }, (_, i): ReceptionAppointmentResponse => ({ ...appointments[0], id: `booking-${i}`, patientId: `patient-${i}`, patientName: `Bệnh nhân ${i}` }));
    const html = renderToStaticMarkup(<ReceptionAppointmentsOverview date="2026-09-20" appointments={many}
      queue={[]} doctors={[]} selectedId="" onDateChange={noop} onSelect={noop} />);
    expect(html).toContain('Hiển thị 1–10 / 14');
    expect(html).toContain('Trang 1/2');
    expect(html).toContain('Danh sách và số liệu thuộc ngày đang chọn.');
  });
});
