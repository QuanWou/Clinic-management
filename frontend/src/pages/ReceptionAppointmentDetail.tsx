import type { ReactNode } from 'react';
import { CalendarDays, Clock3, ClipboardList, Hash, Phone, Stethoscope, UserRound, X } from 'lucide-react';
import Badge from '../components/Badge';
import type { AppointmentResponse, DoctorProfileResponse, ReceptionPatientResponse, ReceptionVisitResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { doctorName } from '../utils/doctorNames';
import './receptionAppointmentDetail.css';

type Props = {
  appointment: AppointmentResponse;
  visit?: ReceptionVisitResponse;
  doctor?: DoctorProfileResponse;
  patient?: ReceptionPatientResponse;
  patientLoading: boolean;
  patientError?: string;
  onClose: () => void;
  closeDisabled?: boolean;
  actions?: ReactNode;
  cancellation?: ReactNode;
};

/** Only show patient/doctor data verified for the selected appointment; never infer missing fields. */
export default function ReceptionAppointmentDetail({ appointment, visit, doctor, patient, patientLoading, patientError,
  onClose, closeDisabled = false, actions, cancellation }: Props) {
  const matchedPatient = patient?.id === appointment.patientId ? patient : undefined;
  const matchedDoctor = doctor?.id === appointment.doctorId ? doctor : undefined;
  const matchedVisit = visit?.appointmentId === appointment.id ? visit : undefined;

  return <section className="reception-detail-grid">
    <article className="panel detail-panel reception-desk-detail reception-appointment-detail" id="reception-detail-panel"
      aria-labelledby="reception-detail-title">
      <header className="reception-appointment-header">
        <div className="reception-appointment-heading">
          <span className="reception-desk-section-kicker">THÔNG TIN LỊCH KHÁM</span>
          <h3 id="reception-detail-title">Chi tiết lịch hẹn</h3>
          <span className="reception-appointment-id"><Hash size={14} aria-hidden="true" /> Mã lịch: <code>{appointment.id}</code></span>
        </div>
        <div className="reception-appointment-header-actions">
          <Badge tone={matchedVisit?.status ?? appointment.status}>{statusLabel(matchedVisit?.status ?? appointment.status)}</Badge>
          <button type="button" className="soft-button reception-appointment-close" disabled={closeDisabled} onClick={onClose}>
            <X size={16} aria-hidden="true" /> Đóng chi tiết
          </button>
        </div>
      </header>

      <div className="reception-appointment-schedule" aria-label="Ngày và giờ khám">
        <div className="reception-appointment-schedule-item">
          <span className="reception-appointment-icon"><CalendarDays size={21} aria-hidden="true" /></span>
          <div><span>Ngày khám</span><strong>{formatDate(appointment.appointmentDate)}</strong></div>
        </div>
        <div className="reception-appointment-schedule-item">
          <span className="reception-appointment-icon"><Clock3 size={21} aria-hidden="true" /></span>
          <div><span>Khung giờ đã đặt</span><strong>{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</strong></div>
        </div>
      </div>

      <div className="reception-appointment-people">
        <section className="reception-appointment-person" aria-label="Thông tin bệnh nhân">
          <h4><UserRound size={17} aria-hidden="true" /> Bệnh nhân</h4>
          <strong className="reception-appointment-person-name">{matchedPatient?.fullName?.trim() || (patientLoading ? 'Đang tải thông tin...' : 'Chưa có tên bệnh nhân')}</strong>
          <dl>
            <div><dt>Mã bệnh nhân</dt><dd title={appointment.patientId}>{shortId(appointment.patientId)}</dd></div>
            <div><dt><Phone size={14} aria-hidden="true" /> Điện thoại</dt><dd>{matchedPatient?.phone?.trim() || 'Chưa có dữ liệu'}</dd></div>
          </dl>
          {!matchedPatient && !patientLoading && <p className="reception-appointment-unavailable" role="status">
            {patientError ? `Không tải được hồ sơ bệnh nhân: ${patientError}` : 'Thông tin bệnh nhân chưa khả dụng.'}
          </p>}
        </section>
        <section className="reception-appointment-person" aria-label="Thông tin bác sĩ">
          <h4><Stethoscope size={17} aria-hidden="true" /> Bác sĩ phụ trách</h4>
          <strong className="reception-appointment-person-name">{doctorName(matchedDoctor)}</strong>
          <dl>
            <div><dt>Chuyên khoa</dt><dd>{matchedDoctor?.specialtyName?.trim() || 'Chưa có dữ liệu'}</dd></div>
            <div><dt>Mã bác sĩ</dt><dd title={appointment.doctorId}>{shortId(appointment.doctorId)}</dd></div>
          </dl>
          {!matchedDoctor && <p className="reception-appointment-unavailable">Chưa tải được thông tin từ danh sách bác sĩ.</p>}
        </section>
      </div>

      <section className="reception-appointment-reason" aria-label="Lý do khám">
        <h4><ClipboardList size={17} aria-hidden="true" /> Lý do khám</h4>
        <p>{appointment.reason?.trim() || 'Chưa có lý do khám.'}</p>
      </section>

      <div className="reception-appointment-meta">
        <span>Trạng thái đặt lịch: <strong>{statusLabel(appointment.status)}</strong></span>
        <span>Ngày tạo lịch: <strong>{appointment.createdAt ? formatDate(appointment.createdAt) : 'Chưa có dữ liệu'}</strong></span>
      </div>

      {matchedVisit && <section className="reception-appointment-visit" aria-label="Thông tin tiếp nhận">
        <div><h4>Thông tin tiếp nhận</h4><Badge tone={matchedVisit.status}>{statusLabel(matchedVisit.status)}</Badge></div>
        <dl>
          <div><dt>Số thứ tự</dt><dd>#{matchedVisit.queueNumber}</dd></div>
          <div><dt>Đã check-in lúc</dt><dd>{formatTime(matchedVisit.checkedInAt.slice(11, 16))} · {formatDate(matchedVisit.visitDate)}</dd></div>
          {matchedVisit.startedAt && <div><dt>Bắt đầu khám</dt><dd>{formatTime(matchedVisit.startedAt.slice(11, 16))}</dd></div>}
          {matchedVisit.completedAt && <div><dt>Hoàn thành lúc</dt><dd>{formatTime(matchedVisit.completedAt.slice(11, 16))}</dd></div>}
        </dl>
        <p>Đã tiếp nhận: không thể hủy hoặc đổi lịch sau check-in.</p>
      </section>}

      {(actions || cancellation) && <footer className="reception-appointment-footer">
        {actions && <div className="reception-appointment-action-area">
          <strong>Thao tác lịch hẹn</strong><div className="detail-actions reception-appointment-buttons">{actions}</div>
        </div>}
        {cancellation}
      </footer>}
    </article>
  </section>;
}