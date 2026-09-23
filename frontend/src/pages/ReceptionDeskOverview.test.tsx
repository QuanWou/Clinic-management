import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReceptionAppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import ReceptionDeskOverview from './ReceptionDeskOverview';
vi.mock('../config/integrations.config', () => ({ integrations: { reception: true, appointmentOwnership: true, adminCatalog: false } }));
import ReceptionAppointmentsPage, { allowedQueueTransitions } from './ReceptionAppointmentsPage';

const noop = vi.fn();
const bookings: ReceptionAppointmentResponse[] = [
  { id: 'booking-pending', patientId: 'patient-1', patientName: 'Nguyễn An', doctorId: 'doctor-1', appointmentDate: '2026-09-20', startTime: '08:00', endTime: '08:30', status: 'PENDING' },
  { id: 'booking-ready', patientId: 'patient-2', patientName: 'Trần Bình', doctorId: 'doctor-1', appointmentDate: '2026-09-20', startTime: '08:30', endTime: '09:00', status: 'CONFIRMED' },
  { id: 'booking-checked', patientId: 'patient-3', patientName: 'Lê Chi', doctorId: 'doctor-1', appointmentDate: '2026-09-20', startTime: '09:00', endTime: '09:30', status: 'CONFIRMED' },
  { id: 'other-date', patientId: 'patient-4', patientName: 'Phạm Dũng', doctorId: 'doctor-1', appointmentDate: '2026-09-21', startTime: '09:30', endTime: '10:00', status: 'PENDING' }
];
const queue: ReceptionVisitResponse[] = [
  { id: 'visit-1', appointmentId: 'booking-checked', patientId: 'patient-3', patientName: 'Lê Chi', doctorId: 'doctor-1', visitDate: '2026-09-20', queueNumber: 2, status: 'WAITING', checkedInAt: '2026-09-20T08:30:00', startedAt: null, completedAt: null },
  { id: 'other-visit', appointmentId: 'other-date', patientId: 'patient-4', patientName: 'Phạm Dũng', doctorId: 'doctor-1', visitDate: '2026-09-21', queueNumber: 3, status: 'CALLED', checkedInAt: '2026-09-21T08:30:00', startedAt: null, completedAt: null }
];

function render(date = '2026-09-20', rows = bookings, visits = queue, today = '2026-09-20') {
  return renderToStaticMarkup(<ReceptionDeskOverview date={date} today={today} appointments={rows} queue={visits}
    onSelect={noop} onBooking={noop} />);
}

describe('receptionist appointment desk', () => {
  it('mounts a receptionist-specific page without replacing the admin appointments screen', () => {
    const receptionist = renderToStaticMarkup(<ReceptionAppointmentsPage role="RECEPTIONIST" />);
    const admin = renderToStaticMarkup(<ReceptionAppointmentsPage role="ADMIN" />);
    expect(receptionist).toContain('receptionist-workspace');
    expect(receptionist).toContain('Lịch hẹn lễ tân');
    expect(admin).not.toContain('receptionist-workspace');
    expect(admin).not.toContain('Lịch hẹn lễ tân');
  });

  it('shows only actual selected-date work, excluding already checked-in and cross-date bookings', () => {
    const html = render();
    expect(html).toContain('Bàn tiếp đón lễ tân');
    expect(html).toContain('Lịch chờ xác nhận');
    expect(html).toContain('Lịch đã xác nhận');
    expect(html).toContain('Nguyễn An');
    expect(html).toContain('Trần Bình');
    expect(html).toContain('3 lịch hẹn');
    expect(html).not.toContain('OTHER-DATE');
    expect(html).not.toContain('Doanh thu');
    expect(html.match(/class="reception-desk-priority-row"/g)).toHaveLength(2);
  });

  it('distinguishes empty days and prevents suggesting check-in on another day', () => {
    const empty = render('2026-09-19', [], [], '2026-09-20');
    expect(empty).toContain('Không có lịch chờ xác nhận trong ngày.');
    expect(empty).toContain('Không có lịch đã xác nhận đang chờ tiếp nhận.');
    const past = render('2026-09-20', bookings, queue, '2026-09-21');
    expect(past).toContain('Chỉ có thể check-in cho lịch diễn ra hôm nay.');
  });

  it('excludes doctor-only queue transitions for receptionists', () => {
    expect(allowedQueueTransitions('WAITING', 'RECEPTIONIST')).toEqual(['CALLED', 'SKIPPED']);
    expect(allowedQueueTransitions('CALLED', 'RECEPTIONIST')).toEqual(['SKIPPED']);
    expect(allowedQueueTransitions('SKIPPED', 'RECEPTIONIST')).toEqual(['WAITING']);
    expect(allowedQueueTransitions('IN_PROGRESS', 'RECEPTIONIST')).toEqual([]);
    expect(allowedQueueTransitions('COMPLETED', 'RECEPTIONIST')).toEqual([]);
  });
});