import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarCheck2, CalendarDays, CalendarPlus, Clock3, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react';
import { cancelAppointment, createAppointment, getAppointmentAvailability, getDoctors } from '../api/clinic';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import DoctorPicker from '../components/DoctorPicker';
import DoctorScheduleTimeFields from '../components/DoctorScheduleTimeFields';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { AppointmentResponse, CreateAppointmentRequest, DoctorProfileResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { doctorName } from '../utils/doctorNames';
import { useDoctorBookingSchedule } from '../hooks/useDoctorBookingSchedule';
import { doctorEndOptions, scheduleSlotError } from '../utils/doctorBookingSchedule';
import { receptionSlotError } from '../utils/receptionBooking';
import './patientPortal.css';
import './appointmentFormUx.css';

type Filter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
type BookingField = keyof CreateAppointmentRequest;
type AppointmentDuration = 30 | 45 | 60;
type BookingFieldErrors = Partial<Record<BookingField, string>>;
const blank: CreateAppointmentRequest = { doctorId: '', appointmentDate: '', startTime: '', endTime: '', reason: '' };
const bookingFieldOrder: BookingField[] = ['doctorId', 'appointmentDate', 'startTime', 'endTime', 'reason'];
const durationOptions: AppointmentDuration[] = [30, 45, 60];
const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' }, { key: 'UPCOMING', label: 'Sắp tới' }, { key: 'COMPLETED', label: 'Hoàn thành' }, { key: 'CANCELLED', label: 'Đã hủy' }
];

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

export default function PatientAppointmentsWorkspace({ appointments, error, loading, onRefresh }: {
  appointments: AppointmentResponse[] | null | undefined; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  const [localRows, setLocalRows] = useState<AppointmentResponse[] | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [booking, setBooking] = useState<CreateAppointmentRequest>(blank);
  const doctorSchedule = useDoctorBookingSchedule(booking.doctorId, showBooking);
  const [duration, setDuration] = useState<AppointmentDuration | null>(30);
  const [fieldErrors, setFieldErrors] = useState<BookingFieldErrors>({});
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState('');
  const bookingFieldRefs = useRef<Partial<Record<BookingField, HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement | null>>>({});
  const today = clinicToday();
  useEffect(() => { setLocalRows(null); setSelectedId(''); setConfirmCancel(''); }, [appointments]);
  useEffect(() => {
    if (!integrations.appointmentOwnership) return;
    let active = true;
    setDoctors(null); setDirectoryError(null);
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((doctor) => !doctor?.id)) throw new Error('Danh sách bác sĩ không hợp lệ.');
      setDoctors(result);
    }).catch((cause: unknown) => { if (active) setDirectoryError(cause instanceof Error ? cause.message : 'Không tải được bác sĩ.'); });
    return () => { active = false; };
  }, [showBooking]);
  const rows = useMemo(() => [...(localRows ?? appointments ?? [])].sort((a, b) => `${b.appointmentDate}${b.startTime}`.localeCompare(`${a.appointmentDate}${a.startTime}`)), [localRows, appointments]);
  const upcoming = rows.filter((item) => item.appointmentDate >= today && ['PENDING', 'CONFIRMED'].includes(item.status)).length;
  const filtered = rows.filter((item) => filter === 'ALL' || filter === 'UPCOMING' && item.appointmentDate >= today && ['PENDING', 'CONFIRMED'].includes(item.status)
    || filter === 'COMPLETED' && item.status === 'COMPLETED' || filter === 'CANCELLED' && item.status === 'CANCELLED');
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !integrations.appointmentOwnership) return;
    setActionError(null); setNotice(null);
    const errors: BookingFieldErrors = {};
    if (!doctors?.some((doctor) => doctor.id === booking.doctorId)) errors.doctorId = 'Chọn bác sĩ đang hoạt động.';
    if (!booking.appointmentDate) errors.appointmentDate = 'Chọn ngày khám.';
    else if (booking.appointmentDate < today) errors.appointmentDate = 'Ngày khám không thể ở quá khứ.';
    const start = timeToMinutes(booking.startTime);
    if (!booking.startTime) errors.startTime = 'Chọn giờ bắt đầu.';
    else if (start === null) errors.startTime = 'Nhập giờ bắt đầu hợp lệ.';
    const end = timeToMinutes(booking.endTime);
    if (!booking.endTime) errors.endTime = 'Chọn giờ kết thúc.';
    else if (end === null) errors.endTime = 'Nhập giờ kết thúc hợp lệ.';
    else if (start !== null && end <= start) errors.endTime = 'Giờ kết thúc phải sau giờ bắt đầu.';
    if (!errors.appointmentDate && !errors.startTime && !errors.endTime) {
      const scheduleError = scheduleSlotError(doctorSchedule.schedules, booking.appointmentDate, booking.startTime, booking.endTime);
      if (scheduleError) errors.startTime = scheduleError;
      else {
        const timeError = receptionSlotError(booking);
        if (timeError) errors.startTime = timeError;
      }
    }
    if (!booking.reason.trim()) errors.reason = 'Nhập lý do khám.';
    else if (booking.reason.length > 500) errors.reason = 'Lý do khám không được vượt quá 500 ký tự.';
    setFieldErrors(errors);
    const firstInvalidField = bookingFieldOrder.find((field) => errors[field]);
    if (firstInvalidField) {
      bookingFieldRefs.current[firstInvalidField]?.focus();
      return;
    }
    setBusy(true);
    try {
      const available = await getAppointmentAvailability(booking.doctorId, booking.appointmentDate, booking.startTime, booking.endTime);
      if (!available.available || available.doctorId !== booking.doctorId || available.date !== booking.appointmentDate
        || available.startTime?.slice(0, 5) !== booking.startTime || available.endTime?.slice(0, 5) !== booking.endTime) throw new Error('Khung giờ này không còn trống. Vui lòng chọn giờ khác.');
      const created = await createAppointment({ ...booking, reason: booking.reason.trim() });
      if (!created?.id || created.doctorId !== booking.doctorId || created.appointmentDate !== booking.appointmentDate || created.status !== 'PENDING') throw new Error('Máy chủ chưa xác nhận lịch mới; vui lòng tải lại trước khi thử tiếp.');
      setLocalRows((previous) => [created, ...(previous ?? appointments ?? []).filter((item) => item.id !== created.id)]);
      setSelectedId(created.id); setFilter('ALL'); setBooking(blank); setDuration(30); setFieldErrors({}); setShowBooking(false);
      setNotice('Máy chủ đã ghi nhận yêu cầu đặt lịch. Vui lòng chờ xác nhận.');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Không thể đặt lịch.'); }
    finally { setBusy(false); }
  }

  function updateBookingField(field: BookingField, value: string) {
    setBooking((current) => ({ ...current, [field]: value,
      ...(field === 'doctorId' || field === 'appointmentDate' ? { startTime: '', endTime: '' } : {}) }));
    setFieldErrors((current) => {
      if (!current[field] && field !== 'doctorId' && field !== 'appointmentDate') return current;
      const next = { ...current };
      delete next[field];
      if (field === 'doctorId' || field === 'appointmentDate') { delete next.startTime; delete next.endTime; }
      return next;
    });
    setActionError(null);
  }

  function updateStartTime(value: string) {
    const proposedEnd = duration === null ? '' : addDuration(value, duration);
    const nextEndTime = proposedEnd && doctorSchedule.schedules
      && doctorEndOptions(doctorSchedule.schedules, booking.appointmentDate, value).includes(proposedEnd) ? proposedEnd : '';
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
      const proposedEnd = addDuration(booking.startTime, nextDuration);
      updateBookingField('endTime', proposedEnd && doctorSchedule.schedules
        && doctorEndOptions(doctorSchedule.schedules, booking.appointmentDate, booking.startTime).includes(proposedEnd)
        ? proposedEnd : '');
    }
  }

  async function cancel() {
    if (!selected || selected.id !== confirmCancel || busy || !integrations.appointmentOwnership) return;
    const id = selected.id;
    setBusy(true); setActionError(null); setNotice(null);
    try {
      const result = await cancelAppointment(id);
      if (result.id !== id || result.status !== 'CANCELLED') throw new Error('Máy chủ chưa xác nhận hủy lịch. Hãy tải lại để kiểm tra.');
      setLocalRows((previous) => (previous ?? appointments ?? []).map((item) => item.id === id ? result : item));
      setConfirmCancel(''); setNotice('Máy chủ đã xác nhận hủy lịch.');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Không thể hủy lịch.'); }
    finally { setBusy(false); }
  }

  return <div className="patient-portal" aria-label="Lịch hẹn bệnh nhân"><PageHeader title="Lịch hẹn của tôi" subtitle="Xem, đặt mới và quản lý lịch khám cá nhân"
    actions={<><button type="button" className="soft-button" disabled={loading || busy} onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>
      {integrations.appointmentOwnership && <button type="button" disabled={busy} onClick={() => setShowBooking((value) => !value)}><CalendarPlus size={17} /> {showBooking ? 'Đóng đặt lịch' : 'Đặt lịch mới'}</button>}</>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> LỊCH KHÁM CÁ NHÂN</span><h3>Sắp xếp lịch khám dễ dàng.</h3>
      <p>Kiểm tra lịch và yêu cầu khung giờ với bác sĩ đang hoạt động. Trạng thái đặt lịch chỉ cập nhật theo xác nhận của máy chủ.</p><div className="patient-hero-tags"><span><CalendarDays size={15} /> {appointments == null && localRows == null ? 'Đang tải lịch' : `${rows.length} lịch của tôi`}</span><span><Clock3 size={15} /> {appointments == null && localRows == null ? '—' : upcoming} sắp tới</span></div></div><CalendarCheck2 size={60} aria-hidden="true" /></section>
    {!integrations.appointmentOwnership && <Alert tone="info">Chức năng đặt/hủy lịch chưa bật vì kiểm tra quyền và chống trùng lịch chưa được xác nhận. Bạn vẫn có thể xem lịch hiện có.</Alert>}
    {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Thử lại</button></Alert>}
    {actionError && <Alert tone="error">{actionError}</Alert>}{notice && <Alert tone="info">{notice}</Alert>}
    {showBooking && integrations.appointmentOwnership && <form className="panel patient-panel patient-form appointment-booking-form" noValidate onSubmit={(event) => void book(event)} aria-busy={busy}>
      <div className="patient-section-head"><div><span>YÊU CẦU ĐẶT LỊCH</span><h3>Chọn bác sĩ và thời gian</h3><p>Phòng khám sẽ xác nhận yêu cầu của bạn.</p></div><Stethoscope size={22} /></div>
      {directoryError && <Alert tone="error">{directoryError}</Alert>}
      <div className="patient-form-fields"><div className="appointment-field"><span id="appointment-doctor-label">Bác sĩ</span>
        <DoctorPicker doctors={doctors ?? []} value={booking.doctorId} labelId="appointment-doctor-label"
          triggerRef={(element) => { bookingFieldRefs.current.doctorId = element; }}
          disabled={!doctors?.length || busy} loading={doctors === null && !directoryError}
          invalid={Boolean(fieldErrors.doctorId)} onChange={(doctorId) => updateBookingField('doctorId', doctorId)} />
        <span id="appointment-doctor-error" className="appointment-field-error">{fieldErrors.doctorId}</span></div>
        <label className="appointment-field"><span>Ngày khám</span><input ref={(element) => { bookingFieldRefs.current.appointmentDate = element; }} id="appointment-date" type="date" min={today} required disabled={busy} value={booking.appointmentDate} aria-invalid={Boolean(fieldErrors.appointmentDate)} aria-describedby="appointment-date-error" onChange={(event) => updateBookingField('appointmentDate', event.target.value)} /><span id="appointment-date-error" className="appointment-field-error">{fieldErrors.appointmentDate}</span></label>
        <DoctorScheduleTimeFields doctorId={booking.doctorId} date={booking.appointmentDate}
          schedules={doctorSchedule.schedules} loading={doctorSchedule.loading} error={doctorSchedule.error}
          start={booking.startTime} end={booking.endTime} disabled={busy}
          startId="appointment-start-time" endId="appointment-end-time"
          startRef={(element) => { bookingFieldRefs.current.startTime = element; }}
          endRef={(element) => { bookingFieldRefs.current.endTime = element; }}
          startError={fieldErrors.startTime} endError={fieldErrors.endTime}
          onStartChange={updateStartTime} onEndChange={(value) => { setDuration(null); updateBookingField('endTime', value); }} />
      </div><fieldset className="appointment-duration-picker"><legend>Thời lượng khám nhanh</legend><span id="duration-help" className="appointment-form-hint">Chỉ chọn thời lượng nằm trọn trong ca làm việc; bạn vẫn có thể chọn giờ kết thúc khác trong danh sách.</span><div className="appointment-duration-options">{durationOptions.map((option) => <button type="button" key={option} aria-pressed={duration === option} className={duration === option ? 'is-selected' : undefined} onClick={() => chooseDuration(option)} disabled={busy || (!!booking.startTime && (!doctorSchedule.schedules || !doctorEndOptions(doctorSchedule.schedules, booking.appointmentDate, booking.startTime).includes(addDuration(booking.startTime, option))))}>{option} phút</button>)}</div></fieldset>
      <label className="appointment-field appointment-field-wide">Lý do khám<textarea ref={(element) => { bookingFieldRefs.current.reason = element; }} id="appointment-reason" required maxLength={500} disabled={busy} value={booking.reason} aria-invalid={Boolean(fieldErrors.reason)} aria-describedby="appointment-reason-error" onChange={(event) => updateBookingField('reason', event.target.value)} /><span id="appointment-reason-error" className="appointment-field-error">{fieldErrors.reason}</span></label>
      <div className="patient-form-actions appointment-form-actions"><button type="submit" disabled={busy || !doctors?.length || !!scheduleSlotError(doctorSchedule.schedules, booking.appointmentDate, booking.startTime, booking.endTime) || !!receptionSlotError(booking)}>{busy ? 'Đang kiểm tra lịch trống…' : 'Gửi yêu cầu đặt lịch'}</button><button type="button" className="soft-button" disabled={busy} onClick={() => setShowBooking(false)}>Đóng</button>{busy && <span className="appointment-busy-status" role="status" aria-live="polite">Đang kiểm tra lịch trống và gửi yêu cầu.</span>}</div>
      <p className="patient-note"><ShieldCheck size={16} /> Hệ thống kiểm tra khả dụng trước khi đặt; máy chủ vẫn là nơi quyết định lịch có hợp lệ hay không.</p>
    </form>}
    {loading && <p role="status">Đang tải lịch khám cá nhân...</p>}
    <div className="patient-two-columns"><section className="panel patient-panel"><div className="patient-section-head"><div><span>DANH SÁCH</span><h3>Lịch hẹn của tôi</h3><p>{filtered.length}/{rows.length} lịch theo bộ lọc.</p></div></div>
      <div className="patient-filters" role="group" aria-label="Lọc lịch hẹn">{filters.map(({ key, label }) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key}
        onClick={() => { setFilter(key); setSelectedId(''); setConfirmCancel(''); }}>{label}</button>)}</div>
      {!loading && !error && !appointments && !localRows && <p>Chưa tải được dữ liệu lịch hẹn.</p>}
      {!loading && (appointments != null || localRows != null) && filtered.length === 0 && <div className="patient-empty"><CalendarDays size={26} /><strong>Không có lịch hẹn phù hợp.</strong><p>Thử đổi bộ lọc hoặc yêu cầu đặt lịch mới.</p></div>}
      <div className="patient-worklist">{filtered.map((item) => <button key={item.id} type="button" className={selected?.id === item.id ? 'is-active' : ''} aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setConfirmCancel(''); }}>
        <span className="patient-row-icon"><CalendarDays size={19} /></span><div><strong>{formatDate(item.appointmentDate)} · {formatTime(item.startTime)}</strong><small>{doctorName(doctors?.find((doctor) => doctor.id === item.doctorId))} · Lịch #{shortId(item.id)}</small></div><Badge tone={item.status}>{statusLabel(item.status)}</Badge></button>)}</div>
    </section><aside className="panel patient-panel"><div className="patient-section-head"><div><span>CHI TIẾT</span><h3>Thông tin lịch hẹn</h3><p>Dữ liệu của lịch được chọn.</p></div></div>
      {!selected ? <div className="patient-empty"><CalendarDays size={26} /><strong>Chọn lịch để xem chi tiết</strong></div> : <><dl className="patient-fields"><div><dt>Mã lịch hẹn</dt><dd>{selected.id}</dd></div><div><dt>Trạng thái</dt><dd><Badge tone={selected.status}>{statusLabel(selected.status)}</Badge></dd></div>
        <div><dt>Ngày khám</dt><dd>{formatDate(selected.appointmentDate)}</dd></div><div><dt>Khung giờ</dt><dd>{formatTime(selected.startTime)}–{formatTime(selected.endTime)}</dd></div>
        <div><dt>Bác sĩ</dt><dd>{doctorName(doctors?.find((doctor) => doctor.id === selected.doctorId))}</dd></div><div className="patient-field-wide"><dt>Lý do khám</dt><dd>{selected.reason || 'Chưa cung cấp'}</dd></div></dl>
        {integrations.appointmentOwnership && ['PENDING', 'CONFIRMED'].includes(selected.status) && <div className="patient-form-actions" style={{ marginTop: '1rem' }}>
          <button className="soft-button danger" type="button" disabled={busy} onClick={() => setConfirmCancel(selected.id)}>Yêu cầu hủy lịch</button></div>}
        {confirmCancel === selected.id && <div className="patient-note"><div><strong>Xác nhận hủy lịch #{shortId(selected.id)}?</strong><p>Không thể hủy lịch đã check-in; máy chủ sẽ kiểm tra trạng thái trước khi thực hiện.</p>
          <div className="patient-form-actions"><button type="button" className="soft-button danger" disabled={busy} onClick={() => void cancel()}>Xác nhận hủy</button><button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmCancel('')}>Giữ lịch</button></div></div></div>}
      </>}
    </aside></div>
  </div>;
}
