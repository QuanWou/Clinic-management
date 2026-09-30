import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AppointmentResponse, DoctorProfileResponse, ReceptionPatientResponse, ReceptionVisitResponse } from '../types/domain';
import ReceptionAppointmentDetail from './ReceptionAppointmentDetail';

const appointment: AppointmentResponse = {
  id: 'appointment-real-01', patientId: 'patient-real-01', doctorId: 'doctor-real-01',
  appointmentDate: '2026-09-22', startTime: '08:59', endTime: '09:59', status: 'CONFIRMED',
  reason: 'Đau đầu, cần kiểm tra', createdAt: '2026-09-20T11:00:00'
};
const patient: ReceptionPatientResponse = {
  id: appointment.patientId, userId: null, fullName: 'Nguyễn Thị B', phone: '0912345678',
  dob: null, gender: null, address: null, bloodType: null
};
const doctor: DoctorProfileResponse = {
  id: appointment.doctorId, userId: 'doctor-account', specialtyName: 'Nội tổng quát', fullName: 'Nguyễn Minh Khôi'
};
const visit: ReceptionVisitResponse = {
  id: 'visit-real', appointmentId: appointment.id, patientId: appointment.patientId,
  doctorId: appointment.doctorId, visitDate: appointment.appointmentDate, queueNumber: 4,
  status: 'WAITING', checkedInAt: '2026-09-22T08:40:00', startedAt: null, completedAt: null
};
const noop = () => undefined;

describe('reception appointment details', () => {
  it('shows verified patient, doctor, schedule, reason, metadata and separated actions', () => {
    const html = renderToStaticMarkup(<ReceptionAppointmentDetail appointment={appointment} doctor={doctor}
      patient={patient} patientLoading={false} onClose={noop} actions={<button type="button">Đổi lịch</button>} />);
    expect(html).toContain('reception-appointment-header');
    expect(html).toContain('appointment-real-01');
    expect(html).toContain('22/09/2026');
    expect(html).toContain('08:59 – 09:59');
    expect(html).toContain('Nguyễn Thị B');
    expect(html).toContain('0912345678');
    expect(html).toContain('Nội tổng quát');
    expect(html).toContain('BS. Nguyễn Minh Khôi');
    expect(html).toContain('Đau đầu, cần kiểm tra');
    expect(html).toContain('Ngày tạo lịch:');
    expect(html).toContain('Thao tác lịch hẹn');
    expect(html).toContain('Đổi lịch');
    expect(html).not.toContain('Thanh toán');
  });

  it('does not leak details from unrelated patient, doctor or visit records', () => {
    const html = renderToStaticMarkup(<ReceptionAppointmentDetail appointment={appointment}
      patient={{ ...patient, id: 'different-patient', fullName: 'PRIVATE NAME', phone: '0123456789' }}
      doctor={{ ...doctor, id: 'different-doctor', specialtyName: 'PRIVATE SPECIALTY' }}
      visit={{ ...visit, appointmentId: 'different-appointment' }}
      patientLoading={false} patientError="Không tìm thấy" onClose={noop} />);
    expect(html).not.toContain('PRIVATE NAME');
    expect(html).not.toContain('0123456789');
    expect(html).not.toContain('PRIVATE SPECIALTY');
    expect(html).not.toContain('Thông tin tiếp nhận');
    expect(html).toContain('Không tải được hồ sơ bệnh nhân: Không tìm thấy');
    expect(html).toContain('Chưa có dữ liệu');
  });

  it('shows actual check-in status and queue number without offering an edit action', () => {
    const html = renderToStaticMarkup(<ReceptionAppointmentDetail appointment={appointment} visit={visit}
      patientLoading={true} onClose={noop} />);
    expect(html).toContain('Đang tải thông tin...');
    expect(html).toContain('Thông tin tiếp nhận');
    expect(html).toContain('Số thứ tự');
    expect(html).toContain('#4');
    expect(html).toContain('không thể hủy hoặc đổi lịch sau check-in');
    expect(html).not.toContain('Thao tác lịch hẹn');
    expect(html).not.toContain('Xác nhận hủy lịch');
  });

  it('prevents closing the detail while an appointment mutation is in progress', () => {
    const html = renderToStaticMarkup(<ReceptionAppointmentDetail appointment={appointment}
      patientLoading={false} onClose={noop} closeDisabled />);
    expect(html).toMatch(/class="soft-button reception-appointment-close"[^>]*disabled=""/);
  });
});