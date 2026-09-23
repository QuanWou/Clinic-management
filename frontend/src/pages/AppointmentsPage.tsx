import { CalendarPlus, Search } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { cancelAppointment, confirmAppointment, createAppointment, getAppointment, getDoctors, getAppointmentAvailability } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse, CreateAppointmentRequest, DoctorProfileResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime, shortId } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';
import ReceptionAppointmentsPage from './ReceptionAppointmentsPage';
import { integrations } from '../config/integrations.config';
import DoctorAppointmentsWorkspace from './DoctorAppointmentsWorkspace';
import PatientAppointmentsWorkspace from './PatientAppointmentsWorkspace';
import './appointmentFormUx.css';

type AppointmentsPageProps = {
  appointments: AppointmentResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

const initialBooking: CreateAppointmentRequest = { doctorId: '', appointmentDate: '', startTime: '', endTime: '', reason: '' };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Filter = 'All' | 'Upcoming' | 'Completed' | 'Canceled';
type BookingField = keyof CreateAppointmentRequest;
type AppointmentDuration = 30 | 45 | 60;
type BookingFieldErrors = Partial<Record<BookingField, string>>;

const bookingFieldOrder: BookingField[] = ['doctorId', 'appointmentDate', 'startTime', 'endTime', 'reason'];
const durationOptions: AppointmentDuration[] = [30, 45, 60];

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
}

function addDuration(startTime: string, duration: AppointmentDuration) {
  const start = timeToMinutes(startTime);
  if (start === null) return '';
  const end = start + duration;
  if (end > 23 * 60 + 59) return '';
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

function validateBooking(booking: CreateAppointmentRequest, todayKey: string): BookingFieldErrors {
  const errors: BookingFieldErrors = {};
  if (!uuidPattern.test(booking.doctorId.trim())) errors.doctorId = 'Chọn bác sĩ trước khi tiếp tục.';
  if (!booking.appointmentDate) errors.appointmentDate = 'Chọn ngày khám.';
  else if (booking.appointmentDate < todayKey) errors.appointmentDate = 'Ngày khám không thể ở quá khứ.';

  const start = timeToMinutes(booking.startTime);
  if (!booking.startTime) errors.startTime = 'Chọn giờ bắt đầu.';
  else if (start === null) errors.startTime = 'Nhập giờ bắt đầu hợp lệ.';

  const end = timeToMinutes(booking.endTime);
  if (!booking.endTime) errors.endTime = 'Chọn giờ kết thúc.';
  else if (end === null) errors.endTime = 'Nhập giờ kết thúc hợp lệ.';
  else if (start !== null && end <= start) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';

  if (!booking.reason.trim()) errors.reason = 'Nhập lý do khám.';
  else if (booking.reason.length > 500) errors.reason = 'Lý do khám không được vượt quá 500 ký tự.';
  return errors;
}

export default function AppointmentsPage({ appointments, role, error, loading, onRefresh }: AppointmentsPageProps) {
  if (role === 'ADMIN' || role === 'RECEPTIONIST') return <ReceptionAppointmentsPage role={role} />;
  if (role === 'PATIENT') return <PatientAppointmentsWorkspace appointments={appointments} error={error} loading={loading} onRefresh={onRefresh} />;
  if (role === 'DOCTOR' && !integrations.appointmentOwnership) {
    return <><PageHeader title="Appointments" subtitle="Your assigned appointments" />
      <Alert tone="info">Tính năng lịch hẹn của bác sĩ hiện chưa khả dụng.</Alert></>;
  }
  if (role === 'DOCTOR') return <DoctorAppointmentsWorkspace />;
  return <PersonalAppointmentsPage appointments={appointments} role={role} error={error} loading={loading} onRefresh={onRefresh} />;
}

function PersonalAppointmentsPage({ appointments, role, error, loading, onRefresh }: AppointmentsPageProps) {
  const [localRows, setLocalRows] = useState<AppointmentResponse[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [booking, setBooking] = useState(initialBooking);
  const [duration, setDuration] = useState<AppointmentDuration | null>(30);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [showBooking, setShowBooking] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [doctorOptions, setDoctorOptions] = useState<DoctorProfileResponse[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const bookingFieldRefs = useRef<Partial<Record<BookingField, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});
  const isPatient = role === 'PATIENT';
  useEffect(() => { if (isPatient) setLocalRows(null); }, [appointments, isPatient]);
  useEffect(() => {
    if (!isPatient || !showBooking) return;
    let active = true;
    setDirectoryError(null); setDoctorOptions(null);
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result)) throw new Error('Danh sách bác sĩ không hợp lệ.');
      setDoctorOptions(result);
    }).catch((cause: unknown) => {
      if (active) setDirectoryError(cause instanceof Error ? cause.message : 'Danh sách bác sĩ chưa khả dụng.');
    });
    return () => { active = false; };
  }, [isPatient, showBooking]);
  const rows = useMemo(() => getUiAppointments(localRows ?? appointments), [localRows, appointments]);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const filtered = rows.filter((row) => filter === 'All' ||
    (filter === 'Upcoming' && row.appointmentDate >= todayKey && (row.status === 'PENDING' || row.status === 'CONFIRMED')) ||
    (filter === 'Completed' && row.status === 'COMPLETED') || (filter === 'Canceled' && row.status === 'CANCELLED'));
  const selected = filtered.find((row) => row.id === selectedId) ?? filtered[0];

  async function runAction(action: () => Promise<AppointmentResponse>, success: string) {
    setBusy(true); setActionError(null); setNotice(null);
    try {
      const updated = await action();
      setLocalRows((previous) => {
        const source = previous ?? appointments ?? [];
        return source.some((item) => item.id === updated.id)
          ? source.map((item) => item.id === updated.id ? updated : item) : [updated, ...source];
      });
      setSelectedId(updated.id);
      setNotice(success);
      return true;
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Thao tác không thành công.'); return false; }
    finally { setBusy(false); }
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateBooking(booking, todayKey);
    setFieldErrors(errors);
    setActionError(null);
    const firstInvalidField = bookingFieldOrder.find((field) => errors[field]);
    if (firstInvalidField) {
      bookingFieldRefs.current[firstInvalidField]?.focus();
      return;
    }
    const succeeded = await runAction(async () => {
      const available = await getAppointmentAvailability(booking.doctorId, booking.appointmentDate, booking.startTime, booking.endTime);
      if (!available.available || available.doctorId !== booking.doctorId || available.date !== booking.appointmentDate) {
        throw new Error('Bác sĩ không còn trống trong khung giờ này. Hãy chọn khung giờ khác.');
      }
      return createAppointment({ ...booking, doctorId: booking.doctorId.trim(), reason: booking.reason.trim() });
    }, 'Đã gửi yêu cầu đặt lịch.');
    if (succeeded) {
      setShowBooking(false);
      setBooking(initialBooking);
      setDuration(30);
      setFieldErrors({});
    }
  }

  function updateBookingField(field: BookingField, value: string) {
    setBooking((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setActionError(null);
  }

  function updateStartTime(value: string) {
    const nextEndTime = duration === null ? booking.endTime : addDuration(value, duration);
    setBooking((current) => ({ ...current, startTime: value, endTime: nextEndTime }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.startTime;
      delete next.endTime;
      return next;
    });
    setActionError(null);
  }

  function chooseDuration(nextDuration: AppointmentDuration) {
    setDuration(nextDuration);
    if (booking.startTime) {
      updateBookingField('endTime', addDuration(booking.startTime, nextDuration));
    }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uuidPattern.test(lookupId.trim())) { setActionError('Nhập mã lịch hẹn hợp lệ.'); return; }
    await runAction(() => getAppointment(lookupId.trim()), 'Đã tải lịch hẹn.');
  }

  return (
    <>
      <PageHeader title="Lịch hẹn" subtitle={isPatient ? 'Xem và quản lý lịch khám của bạn.' : 'Tra cứu lịch hẹn theo mã.'}
        actions={isPatient && integrations.appointmentOwnership ? <button type="button" onClick={() => setShowBooking((value) => !value)}><CalendarPlus size={17} />Đặt lịch mới</button> : undefined} />
      {isPatient && !integrations.appointmentOwnership && <Alert tone="info">Tạm thời chưa thể thay đổi lịch hẹn. Bạn vẫn có thể xem các lịch đã có.</Alert>}
      {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Thử lại</button></Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      {loading && <p role="status">Đang tải lịch hẹn...</p>}
      {isPatient && integrations.appointmentOwnership && showBooking && <form className="panel settings-form appointment-booking-form" noValidate onSubmit={(event) => void handleBooking(event)} aria-busy={busy}>
        <h3>Đặt lịch khám</h3>
        <p>Chọn bác sĩ và khung giờ phù hợp. Lịch trống sẽ được kiểm tra trước khi gửi.</p>
        {directoryError && <Alert tone="error">{directoryError}</Alert>}
        <label className="appointment-field"><span>Bác sĩ</span><select ref={(element) => { bookingFieldRefs.current.doctorId = element; }} id="appointment-doctor" value={booking.doctorId} required disabled={!doctorOptions?.length}
          aria-invalid={Boolean(fieldErrors.doctorId)} aria-describedby="appointment-doctor-error"
          onChange={(event) => updateBookingField('doctorId', event.target.value)}>
          <option value="">{doctorOptions?.length ? 'Chọn bác sĩ' : 'Chưa có bác sĩ khả dụng'}</option>
          {doctorOptions?.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.specialtyName || 'Bác sĩ'} · {doctor.id.slice(0, 8)}</option>)}
        </select><span id="appointment-doctor-error" className="appointment-field-error">{fieldErrors.doctorId}</span></label>
        <label className="appointment-field"><span>Ngày khám</span><input ref={(element) => { bookingFieldRefs.current.appointmentDate = element; }} id="appointment-date" type="date" min={todayKey} value={booking.appointmentDate} required aria-invalid={Boolean(fieldErrors.appointmentDate)} aria-describedby="appointment-date-error" onChange={(event) => updateBookingField('appointmentDate', event.target.value)} /><span id="appointment-date-error" className="appointment-field-error">{fieldErrors.appointmentDate}</span></label>
        <label className="appointment-field"><span>Giờ bắt đầu</span><input ref={(element) => { bookingFieldRefs.current.startTime = element; }} id="appointment-start-time" type="time" value={booking.startTime} required aria-invalid={Boolean(fieldErrors.startTime)} aria-describedby="appointment-start-time-error" onChange={(event) => updateStartTime(event.target.value)} /><span id="appointment-start-time-error" className="appointment-field-error">{fieldErrors.startTime}</span></label>
        <label className="appointment-field"><span>Giờ kết thúc</span><input ref={(element) => { bookingFieldRefs.current.endTime = element; }} id="appointment-end-time" type="time" value={booking.endTime} required aria-invalid={Boolean(fieldErrors.endTime)} aria-describedby="appointment-end-time-error" onChange={(event) => { setDuration(null); updateBookingField('endTime', event.target.value); }} /><span id="appointment-end-time-error" className="appointment-field-error">{fieldErrors.endTime}</span></label>
        <fieldset className="appointment-duration-picker"><legend>Thời lượng khám nhanh</legend><span id="duration-help" className="appointment-form-hint">Chọn thời lượng để tự điền giờ kết thúc; bạn vẫn có thể sửa thủ công.</span><div className="appointment-duration-options">{durationOptions.map((option) => <button type="button" key={option} aria-pressed={duration === option} className={duration === option ? 'is-selected' : undefined} onClick={() => chooseDuration(option)}>{option} phút</button>)}</div></fieldset>
        <label className="appointment-field appointment-field-wide"><span>Lý do khám</span><textarea ref={(element) => { bookingFieldRefs.current.reason = element; }} id="appointment-reason" value={booking.reason} maxLength={500} required aria-invalid={Boolean(fieldErrors.reason)} aria-describedby="appointment-reason-error" onChange={(event) => updateBookingField('reason', event.target.value)} /><span id="appointment-reason-error" className="appointment-field-error">{fieldErrors.reason}</span></label>
        <div className="appointment-form-actions"><button type="submit" disabled={busy || !doctorOptions?.length}>{busy ? 'Đang kiểm tra lịch trống…' : 'Gửi yêu cầu'}</button>{busy && <span className="appointment-busy-status" role="status" aria-live="polite">Đang kiểm tra lịch trống và gửi yêu cầu.</span>}</div>
      </form>}
      {!isPatient && <form className="inline-search" onSubmit={(event) => void handleLookup(event)}>
        <Search size={16} /><input aria-label="Mã lịch hẹn" placeholder="Mã lịch hẹn" value={lookupId} onChange={(event) => setLookupId(event.target.value)} required />
        <button type="submit" disabled={busy}>Tra cứu</button>
      </form>}
      <section className="split-page split-appointments">
        <article className="panel table-panel">
          <div className="tabs">{(['All', 'Upcoming', 'Completed', 'Canceled'] as Filter[]).map((tab) => (
            <button className={filter === tab ? 'active' : undefined} type="button" key={tab} onClick={() => setFilter(tab)} aria-pressed={filter === tab}>{tab}</button>
          ))}</div>
          {filtered.length === 0 && <p>{loading ? 'Đang tải...' : isPatient && !appointments && !localRows ? 'Chưa có dữ liệu lịch hẹn.' : 'Không tìm thấy lịch hẹn.'}</p>}
          {filtered.length > 0 && <div className="data-table"><div className="table-row table-head">
            <span>Bệnh nhân</span><span>Bác sĩ</span><span>Ngày & giờ</span><span>Chuyên khoa</span><span>Trạng thái</span><span>Thao tác</span>
          </div>{filtered.map((item) => (
            <button className="table-row" type="button" key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id}>
              <span className="person-cell"><Avatar label={item.patientAvatar} size="sm" />{item.patientName}</span>
              <span className="person-cell"><Avatar label={item.doctorAvatar} size="sm" />{item.doctorName}</span>
              <span>{formatDate(item.appointmentDate)}<small>{formatTime(item.startTime)}</small></span>
              <span>{item.department}</span><span><Badge tone={item.status}>{item.status}</Badge></span><span>Xem chi tiết</span>
            </button>
          ))}</div>}
        </article>
        {selected && <article className="panel detail-panel">
          <div className="panel-heading"><h3>Chi tiết lịch hẹn</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
          <dl className="details-list compact">
            <div><dt>Mã lịch hẹn</dt><dd>{selected.id}</dd></div>
            <div><dt>Mã bệnh nhân</dt><dd>{shortId(selected.patientId)}</dd></div>
            <div><dt>Mã bác sĩ</dt><dd>{shortId(selected.doctorId)}</dd></div>
            <div><dt>Ngày khám</dt><dd>{formatDate(selected.appointmentDate)}</dd></div>
            <div><dt>Thời gian</dt><dd>{formatTime(selected.startTime)} – {formatTime(selected.endTime)}</dd></div>
            <div><dt>Lý do khám</dt><dd>{selected.reason ?? 'Chưa cung cấp'}</dd></div>
          </dl>
          <div className="detail-actions">
            {isPatient && integrations.appointmentOwnership && ['PENDING', 'CONFIRMED'].includes(selected.status) && <button type="button" className="soft-button danger" disabled={busy} onClick={() => void runAction(() => cancelAppointment(selected.id), 'Đã hủy lịch hẹn.')}>Hủy lịch hẹn</button>}
            {role === 'DOCTOR' && integrations.appointmentOwnership && selected.status === 'PENDING' && <button type="button" className="soft-button success" disabled={busy} onClick={() => void runAction(() => confirmAppointment(selected.id), 'Đã xác nhận lịch hẹn.')}>Xác nhận lịch hẹn</button>}
            {role === 'DOCTOR' && selected.status === 'CONFIRMED' && <p>Đối với lịch đã check-in, sử dụng Hàng đợi của tôi ở phía trên để hoàn tất đúng thứ tự.</p>}
          </div>
        </article>}
      </section>
    </>
  );
}
