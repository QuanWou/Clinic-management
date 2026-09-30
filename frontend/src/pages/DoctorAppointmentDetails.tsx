import { CalendarDays, CheckCircle2, Clock3, ClipboardList, FileText, Stethoscope, UserRound } from 'lucide-react';
import Badge from '../components/Badge';
import type { AppointmentResponse, DoctorProfileResponse, MedicalRecordResponse, ReceptionVisitResponse } from '../types/domain';
import { formatDate, formatTime } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './doctorAppointmentDetails.css';

export type DoctorAppointmentDetailsProps = {
  appointment: AppointmentResponse;
  visit: ReceptionVisitResponse | null;
  record: MedicalRecordResponse | null;
  doctor: DoctorProfileResponse | null;
  enrichmentLoading?: boolean;
};

/** Display only data tied to the selected, authorized appointment. UUIDs remain internal. */
export function DoctorAppointmentDetails({ appointment, record, doctor, enrichmentLoading = false }: DoctorAppointmentDetailsProps) {
  const verifiedRecord = record?.appointmentId === appointment.id && record.patientId === appointment.patientId
    && record.doctorId === appointment.doctorId ? record : null;
  const verifiedDoctor = doctor?.id === appointment.doctorId ? doctor : null;
  const patientName = verifiedRecord?.patientName?.trim();
  const patientCode = verifiedRecord?.patientCode?.trim();
  const doctorName = verifiedDoctor?.fullName?.trim() || verifiedRecord?.doctorName?.trim();
  const doctorCode = verifiedDoctor?.doctorCode?.trim() || verifiedRecord?.doctorCode?.trim();

  return <div className="doctor-appointment-info-columns">
    <section className="doctor-appointment-info-card" aria-label="Thông tin bệnh nhân">
      <h4><UserRound size={19} aria-hidden="true" /> Thông tin bệnh nhân</h4>
      <dl>
        <div><dt>Tên bệnh nhân</dt><dd>{patientName || (enrichmentLoading ? 'Đang tải thông tin...' : 'Chưa có tên được xác minh')}</dd></div>
        <div><dt>Mã bệnh nhân</dt><dd>{patientCode || (enrichmentLoading ? 'Đang tải...' : 'Chưa có mã BN được xác minh')}</dd></div>
      </dl>
      {!verifiedRecord && !enrichmentLoading && <p className="doctor-appointment-data-hint">Chưa có bệnh án liên kết để hiển thị tên và mã BN. Không dùng UUID làm mã bệnh nhân.</p>}
    </section>
    <section className="doctor-appointment-info-card" aria-label="Thông tin khám">
      <h4><Stethoscope size={19} aria-hidden="true" /> Thông tin khám</h4>
      <dl>
        <div><dt>Bác sĩ phụ trách</dt><dd>{doctorName || (enrichmentLoading ? 'Đang tải thông tin...' : 'Chưa xác minh được họ tên')}</dd></div>
        <div><dt>Mã bác sĩ</dt><dd>{doctorCode || 'Chưa có mã BS được xác minh'}</dd></div>
        <div><dt>Chuyên khoa</dt><dd>{verifiedDoctor?.specialtyName?.trim() || 'Chưa có thông tin chuyên khoa'}</dd></div>
        <div><dt><CalendarDays size={15} aria-hidden="true" /> Ngày khám</dt><dd>{formatDate(appointment.appointmentDate)}</dd></div>
        <div><dt><Clock3 size={15} aria-hidden="true" /> Khung giờ khám</dt><dd>{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</dd></div>
        <div><dt>Trạng thái lịch hẹn</dt><dd><Badge tone={appointment.status}>{statusLabel(appointment.status)}</Badge></dd></div>
        <div><dt><ClipboardList size={15} aria-hidden="true" /> Lý do khám</dt><dd>{appointment.reason?.trim() || 'Chưa ghi nhận lý do khám'}</dd></div>
      </dl>
    </section>
    <details className="doctor-appointment-technical-id">
      <summary><FileText size={15} aria-hidden="true" /> Xem mã tra cứu kỹ thuật</summary>
      <code>{appointment.id}</code>
    </details>
  </div>;
}

/** A timestamp is shown only if ReceptionVisit actually supplies it. No invented workflow times. */
function visitClock(timestamp: string | null): string {
  if (!timestamp) return 'Chưa ghi nhận';
  const match = /T(\d{2}:\d{2})/.exec(timestamp);
  return match ? match[1] : 'Chưa ghi nhận';
}

export function DoctorVisitTimeline({ visit }: { visit: ReceptionVisitResponse }) {
  const steps = [
    { label: 'Tiếp nhận / Check-in', timestamp: visit.checkedInAt, description: 'Bệnh nhân đã được tiếp nhận.' },
    { label: 'Bắt đầu khám', timestamp: visit.startedAt, description: 'Bác sĩ bắt đầu lượt khám.' },
    { label: 'Hoàn tất khám', timestamp: visit.completedAt, description: 'Lượt khám đã hoàn thành.' }
  ];
  return <section className="doctor-appointment-timeline" aria-label={`Tiến trình lượt khám số ${visit.queueNumber}`}>
    <header><div><span className="doctor-appointment-timeline-kicker">TIẾN TRÌNH LƯỢT KHÁM</span>
      <h4>Tiến trình lượt khám #{visit.queueNumber} <Badge tone={visit.status}>{statusLabel(visit.status)}</Badge></h4>
      <p>Các mốc thời gian được lấy từ hệ thống tiếp nhận; mốc chưa ghi nhận sẽ để trống.</p></div></header>
    <ol className="doctor-appointment-timeline-steps">
      {steps.map((step) => <li key={step.label} className={step.timestamp ? 'is-done' : 'is-pending'}>
        <span className="doctor-appointment-step-marker" aria-hidden="true">{step.timestamp ? <CheckCircle2 size={22} /> : <span />}</span>
        <strong>{step.label}</strong><time>{visitClock(step.timestamp)}</time>
        {step.timestamp && <small>{step.description}</small>}
      </li>)}
    </ol>
    {visit.status === 'SKIPPED' && <p className="doctor-appointment-data-hint">Lượt khám được đánh dấu bỏ qua; không xem là đã hoàn thành.</p>}
  </section>;
}
