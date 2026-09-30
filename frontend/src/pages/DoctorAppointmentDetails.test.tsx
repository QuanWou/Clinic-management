import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppointmentResponse, DoctorProfileResponse, MedicalRecordResponse, ReceptionVisitResponse } from '../types/domain';
import { DoctorAppointmentDetails, DoctorVisitTimeline } from './DoctorAppointmentDetails';

const appointment: AppointmentResponse = {
  id: 'c20fd574-3710-4b3c-b4c3-bf4e36b0023d',
  patientId: 'f3000000-0000-4000-8000-000000000004',
  doctorId: 'f2000000-0000-4000-8000-000000000002',
  appointmentDate: '2026-09-22', startTime: '08:59:00', endTime: '09:59:00',
  status: 'COMPLETED', reason: 'Đau người'
};
const record: MedicalRecordResponse = {
  id: 'record-one', appointmentId: appointment.id, patientId: appointment.patientId, doctorId: appointment.doctorId,
  patientName: 'Bệnh nhân kiểm thử', patientCode: 'BN000513', doctorName: 'Bác sĩ thử', doctorCode: 'BS000002',
  diagnosis: 'Khám định kỳ', prescriptions: []
};
const doctor: DoctorProfileResponse = {
  id: appointment.doctorId, userId: 'doctor-user', fullName: 'Bác sĩ xác thực', doctorCode: 'BS000002',
  specialtyName: 'Nội tổng quát'
};
const visit: ReceptionVisitResponse = {
  id: 'visit-one', appointmentId: appointment.id, patientId: appointment.patientId, doctorId: appointment.doctorId,
  queueNumber: 1, visitDate: appointment.appointmentDate, status: 'COMPLETED',
  checkedInAt: '2026-09-22T08:59:00', startedAt: '2026-09-22T09:15:00', completedAt: '2026-09-22T09:45:00'
};

describe('doctor appointment detail redesign', () => {
  it('renders verified human-readable patient and doctor data, actual appointment info, and hides raw UUID by default', () => {
    const html = renderToStaticMarkup(<DoctorAppointmentDetails appointment={appointment} visit={visit} record={record} doctor={doctor} />);
    expect(html).toContain('Thông tin bệnh nhân');
    expect(html).toContain('Bệnh nhân kiểm thử');
    expect(html).toContain('BN000513');
    expect(html).toContain('Bác sĩ xác thực');
    expect(html).toContain('Nội tổng quát');
    expect(html).toContain('22/09/2026');
    expect(html).toContain('08:59');
    expect(html).toContain('Đau người');
    expect(html).toContain('Hoàn thành');
    expect(html).toContain('<details');
    expect(html).not.toContain('Ngày sinh');
    expect(html).not.toContain('0901 234 567');
  });

  it('never displays data for a different patient, appointment or doctor', () => {
    const html = renderToStaticMarkup(<DoctorAppointmentDetails appointment={appointment} visit={null}
      record={{ ...record, appointmentId: 'other-appointment' }} doctor={{ ...doctor, id: 'other-doctor' }} />);
    expect(html).toContain('Chưa có tên được xác minh');
    expect(html).toContain('Chưa có mã BN được xác minh');
    expect(html).toContain('Chưa xác minh được họ tên');
    expect(html).not.toContain('Bệnh nhân kiểm thử');
    expect(html).not.toContain('Bác sĩ xác thực');
    expect(html).not.toContain('BN000513');
    expect(html).not.toContain(appointment.patientId);
  });

  it('uses actual timestamps only and does not mark skipped visits as completed', () => {
    const completed = renderToStaticMarkup(<DoctorVisitTimeline visit={visit} />);
    expect(completed).toContain('08:59');
    expect(completed).toContain('09:15');
    expect(completed).toContain('09:45');
    const skipped = renderToStaticMarkup(<DoctorVisitTimeline visit={{ ...visit, status: 'SKIPPED', startedAt: null, completedAt: null }} />);
    expect(skipped).toContain('Đã bỏ qua');
    expect(skipped).toContain('Chưa ghi nhận');
    expect(skipped).not.toContain('09:15');
    expect(skipped).not.toContain('09:45');
    expect(skipped).toContain('không xem là đã hoàn thành');
  });
});
