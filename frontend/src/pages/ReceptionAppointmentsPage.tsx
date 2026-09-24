import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  bookReceptionAppointment, cancelReceptionAppointment, checkInReceptionAppointment,
  confirmAppointment, getAppointmentAvailability, getDoctors, getReceptionAppointments, getReceptionPatientById, getReceptionQueue,
  rescheduleReceptionAppointment, searchReceptionPatients, updateReceptionQueue
} from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import DoctorPicker from '../components/DoctorPicker';
import DoctorScheduleTimeFields from '../components/DoctorScheduleTimeFields';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type {
  DoctorProfileResponse, AppointmentResponse, QueueStatus, ReceptionPatientResponse, ReceptionAppointmentResponse,
  ReceptionRescheduleRequest, ReceptionVisitResponse
} from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import ReceptionAppointmentsOverview from './ReceptionAppointmentsOverview';
import ReceptionDeskOverview from './ReceptionDeskOverview';
import ReceptionAppointmentDetail from './ReceptionAppointmentDetail';
import { clinicToday } from '../api/staffDashboard';
import { clinicDateTime, receptionSlotError } from '../utils/receptionBooking';
import { useDoctorBookingSchedule } from '../hooks/useDoctorBookingSchedule';
import { scheduleSlotError } from '../utils/doctorBookingSchedule';
import { X } from 'lucide-react';
import './reception-desk.css';

const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const blankBooking = { patientId: '', doctorId: '', appointmentDate: '', startTime: '', endTime: '', reason: '' };

export function allowedQueueTransitions(status: QueueStatus, role: ClinicRole): QueueStatus[] {
  const transitions: Record<QueueStatus, QueueStatus[]> = {
    WAITING: ['CALLED', 'SKIPPED'],
    CALLED: ['IN_PROGRESS', 'SKIPPED'],
    SKIPPED: ['WAITING'],
    IN_PROGRESS: ['COMPLETED'],
    COMPLETED: []
  };
  return transitions[status].filter((target) =>
    !['IN_PROGRESS', 'COMPLETED'].includes(target) || role === 'ADMIN' || role === 'DOCTOR');
}

export default function ReceptionAppointmentsPage({ role, preselectedPatient, onPatientConsumed }: {
  role: ClinicRole;
  preselectedPatient?: ReceptionPatientResponse | null;
  onPatientConsumed?: () => void;
}) {
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">Bạn không có quyền truy cập lịch hẹn lễ tân.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Lịch hẹn" subtitle="Đặt lịch và quản lý hàng đợi" />
    <Alert tone="info">Tính năng đặt lịch, check-in và quản lý hàng đợi hiện chưa khả dụng.</Alert></>;
  return <ActiveReceptionAppointmentsPage role={role} preselectedPatient={preselectedPatient} onPatientConsumed={onPatientConsumed} />;
}

function ActiveReceptionAppointmentsPage({ role, preselectedPatient, onPatientConsumed }: {
  role: ClinicRole;
  preselectedPatient?: ReceptionPatientResponse | null;
  onPatientConsumed?: () => void;
}) {
  const todayKey = clinicToday();
  const [date, setDate] = useState(todayKey);
  const [appointments, setAppointments] = useState<ReceptionAppointmentResponse[] | null>(null);
  const [queue, setQueue] = useState<ReceptionVisitResponse[] | null>(null);
  const [patients, setPatients] = useState<ReceptionPatientResponse[] | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const patientSearchRequest = useRef(0);
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [detailPatient, setDetailPatient] = useState<ReceptionPatientResponse | null>(null);
  const [detailPatientLoading, setDetailPatientLoading] = useState(false);
  const [detailPatientError, setDetailPatientError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [booking, setBooking] = useState(blankBooking);
  const [rescheduleDraft, setRescheduleDraft] = useState(blankBooking);
  const bookingDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);
  const [selectedId, setSelectedId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const bookingSchedule = useDoctorBookingSchedule(booking.doctorId, showBooking);
  const rescheduleSchedule = useDoctorBookingSchedule(rescheduleDraft.doctorId, rescheduling);
  const [cancelPendingId, setCancelPendingId] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = appointments?.find((item) => item.id === selectedId);
  const selectedVisit = queue?.find((visit) => visit.appointmentId === selected?.id);
  const selectedDoctor = doctors?.find((doctor) => doctor.id === selected?.doctorId);
  const selectedPatientId = selected?.patientId;
  useEffect(() => {
    if (!preselectedPatient?.id) return;
    setPatients([preselectedPatient]);
    setPatientSearch(preselectedPatient.fullName);
    setBooking((current) => ({ ...current, patientId: preselectedPatient.id }));
    setShowBooking(true);
  }, [preselectedPatient?.id]);
  useEffect(() => {
    setDetailPatient(null);
    setDetailPatientError(null);
    if (!selectedPatientId) { setDetailPatientLoading(false); return; }
    if (!uuid.test(selectedPatientId)) {
      setDetailPatientLoading(false);
      setDetailPatientError('Mã bệnh nhân không hợp lệ.');
      return;
    }
    let active = true;
    setDetailPatientLoading(true);
    void getReceptionPatientById(selectedPatientId).then((profile) => {
      if (!active) return;
      if (!profile || profile.id !== selectedPatientId) throw new Error('Hồ sơ không khớp lịch hẹn.');
      setDetailPatient(profile);
    }).catch((cause: unknown) => {
      if (active) setDetailPatientError(message(cause));
    }).finally(() => { if (active) setDetailPatientLoading(false); });
    return () => { active = false; };
  }, [selectedPatientId, revision]);
  useEffect(() => {
    const dialog = bookingDialog.current;
    if (showBooking && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('.reception-booking-search input')?.focus({ preventScroll: true });
    }
    if (!showBooking && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [showBooking]);
  // Keep detail in the browser's modal layer; never scroll the worklist to a panel below it.
  useEffect(() => {
    const dialog = detailDialog.current;
    if (selected && !loading && dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [selected?.id, loading]);
  function closeDetail() {
    if (busy) return;
    detailDialog.current?.close();
    setSelectedId('');
    setRescheduling(false);
    setCancelPendingId('');
  }
  function selectDate(next: string) {
    setSelectedId('');
    setRescheduling(false);
    setCancelPendingId('');
    setDate(next);
  }

  function openBooking() {
    setError(null);
    setSearchError(null);
    setBookingError(null);
    setBooking((draft) => {
      const now = clinicDateTime();
      const nextDate = draft.appointmentDate >= now.date ? draft.appointmentDate : date >= now.date ? date : now.date;
      const expired = nextDate === now.date && !!draft.startTime && draft.startTime <= now.time;
      return { ...draft, appointmentDate: nextDate,
        // Never reuse a previously entered time which has already elapsed.
        startTime: expired ? '' : draft.startTime, endTime: expired ? '' : draft.endTime };
    });
    setShowBooking(true);
  }

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setDoctorError(null); setDoctors(null);
    setAppointments(null); setQueue(null);
    // Both roles book from the active doctor list enriched by the restricted
    // Identity name-only endpoint. No privileged account lookup is needed.
    const directory = getDoctors();
    void Promise.allSettled([getReceptionAppointments({ date }), getReceptionQueue({ date }), directory])
      .then(([bookings, visits, doctorList]) => {
        if (!active) return;
        if (bookings.status === 'rejected' || visits.status === 'rejected') {
          setError(message(bookings.status === 'rejected' ? bookings.reason : visits.status === 'rejected' ? visits.reason : null));
          return;
        }
        if (!Array.isArray(bookings.value) || !Array.isArray(visits.value)) {
          setError('Dữ liệu lịch hẹn không hợp lệ.');
          return;
        }
        setAppointments(bookings.value); setQueue(visits.value);
        if (doctorList.status === 'fulfilled' && Array.isArray(doctorList.value)) {
          setDoctors(doctorList.value);
        } else {
          setDoctorError(doctorList.status === 'rejected' ? message(doctorList.reason) : 'Danh sách bác sĩ không hợp lệ.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, revision, role]);

  async function execute(action: () => Promise<unknown>, confirmation: string, verify?: (result: unknown) => boolean) {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await action();
      if (response === null || typeof response !== 'object' || !('id' in response) || !response.id
        || (verify && !verify(response))) {
        throw new Error('Chưa xác nhận được trạng thái mới. Hãy tải lại trước khi tiếp tục.');
      }
      setNotice(confirmation);
      setRevision((value) => value + 1);
      return true;
    } catch (cause) { setError(message(cause)); return false; }
    finally { setBusy(false); }
  }

  async function searchPatients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSearchError(null); setPatients(null);
    setBooking((draft) => ({ ...draft, patientId: '' }));
    if (!patientSearch.trim()) { setSearchError('Nhập tên hoặc số điện thoại bệnh nhân.'); return; }
    const requestId = ++patientSearchRequest.current;
    setBusy(true);
    setSearchingPatients(true);
    try {
      const term = patientSearch.trim();
      const result = await searchReceptionPatients(/^[+\d\s().-]+$/.test(term)
        ? { phone: term } : { name: term });
      if (!Array.isArray(result)) throw new Error('Dữ liệu tìm kiếm bệnh nhân không hợp lệ.');
      if (requestId === patientSearchRequest.current) setPatients(result.filter((patient) => patient?.id && patient.fullName));
    } catch (cause) { if (requestId === patientSearchRequest.current) setSearchError(message(cause)); }
    finally {
      setSearchingPatients(false);
      setBusy(false);
    }
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookingError(null);
    if (!uuid.test(booking.patientId)) { setBookingError('Vui lòng tìm và chọn bệnh nhân.'); return; }
    if (!uuid.test(booking.doctorId) || !doctors?.some((doctor) => doctor.id === booking.doctorId)) {
      setBookingError('Vui lòng chọn bác sĩ đang hoạt động trong danh sách.'); return;
    }
    const slotError = receptionSlotError(booking);
    if (slotError) { setBookingError(slotError); return; }
    const workHourError = scheduleSlotError(bookingSchedule.schedules, booking.appointmentDate, booking.startTime, booking.endTime);
    if (workHourError) { setBookingError(workHourError); return; }
    if (!booking.reason.trim()) { setBookingError('Vui lòng nhập lý do khám.'); return; }
    const request = { ...booking, reason: booking.reason.trim() };
    setBusy(true); setError(null); setNotice(null);
    try {
      const availability = await getAppointmentAvailability(request.doctorId, request.appointmentDate, request.startTime, request.endTime);
      if (!availability.available || availability.doctorId !== request.doctorId || availability.date !== request.appointmentDate
        || availability.startTime?.slice(0, 5) !== request.startTime || availability.endTime?.slice(0, 5) !== request.endTime) {
        throw new Error('Khung giờ không còn trống hoặc đã thay đổi. Vui lòng chọn giờ khác.');
      }
      const result = await bookReceptionAppointment(request);
      if (!result?.id || result.status !== 'PENDING' || result.patientId !== request.patientId || result.doctorId !== request.doctorId) {
        throw new Error('Chưa xác nhận được lịch mới. Vui lòng tải lại danh sách trước khi thử lần nữa.');
      }
      setNotice('Đã tạo lịch hẹn.');
      setShowBooking(false);
      setDate(request.appointmentDate);
      setRevision((value) => value + 1);
      setBooking(blankBooking);
      setPatientSearch('');
      setPatients(null);
      onPatientConsumed?.();
    } catch (cause) {
      const reason = message(cause);
      setBookingError(reason.includes('Invalid appointment date or time range')
        ? 'Ngày hoặc giờ khám đã qua, hoặc giờ kết thúc không sau giờ bắt đầu. Vui lòng chọn lại thời gian trong tương lai (giờ Việt Nam).'
        : reason);
    } finally {
      setBusy(false);
    }

  }

  async function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const slotError = receptionSlotError(rescheduleDraft);
    const workHourError = scheduleSlotError(rescheduleSchedule.schedules, rescheduleDraft.appointmentDate,
      rescheduleDraft.startTime, rescheduleDraft.endTime);
    if (!selected || !uuid.test(rescheduleDraft.doctorId)
      || !doctors?.some((doctor) => doctor.id === rescheduleDraft.doctorId) || slotError || workHourError) {
      setError(slotError || workHourError || 'Vui lòng chọn bác sĩ hợp lệ để đổi lịch.'); return;
    }
    const request: ReceptionRescheduleRequest = {
      doctorId: rescheduleDraft.doctorId, appointmentDate: rescheduleDraft.appointmentDate,
      startTime: rescheduleDraft.startTime, endTime: rescheduleDraft.endTime
    };
    const succeeded = await execute(() => rescheduleReceptionAppointment(selected.id, request), 'Đã đổi lịch hẹn.',
      (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'PENDING'
        && (result as AppointmentResponse).appointmentDate === request.appointmentDate);
    if (succeeded) setRescheduling(false);
  }

  const doctorInput = (value: string, change: (id: string) => void, labelId: string) =>
    <DoctorPicker doctors={doctors ?? []} value={value} onChange={change} labelId={labelId}
      loading={doctors === null && !doctorError} disabled={!doctors?.length || busy} />;
  const bookingSlotWarning = booking.appointmentDate && booking.startTime && booking.endTime
    ? receptionSlotError(booking) || scheduleSlotError(bookingSchedule.schedules, booking.appointmentDate,
      booking.startTime, booking.endTime) : null;

  return <div className={`reception-workspace${role === 'RECEPTIONIST' ? ' receptionist-workspace' : ''}`}>
    <PageHeader title={role === 'RECEPTIONIST' ? 'Lịch hẹn lễ tân' : 'Lịch hẹn'} subtitle={role === 'RECEPTIONIST' ? 'Tiếp đón bệnh nhân, quản lý lịch và hàng đợi trong phạm vi lễ tân' : 'Quản lý và theo dõi lịch khám từ dữ liệu phòng khám'}
      actions={<><button type="button" disabled={busy} onClick={openBooking}>Đặt lịch cho bệnh nhân</button>
        <button type="button" disabled={loading || busy} className="soft-button" onClick={() => setRevision((value) => value + 1)}>Làm mới</button></>} />
    {error && <Alert tone="error">{error} <button type="button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    {doctorError && appointments && <Alert tone="info">Không tải được danh sách bác sĩ: {doctorError}. Vẫn có thể xem lịch hẹn theo mã định danh.</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {loading && <p role="status">Đang tải lịch hẹn và hàng đợi...</p>}
    {role === 'RECEPTIONIST' && !loading && appointments && queue && <ReceptionDeskOverview date={date} today={todayKey} appointments={appointments} queue={queue}
      onBooking={openBooking} onSelect={(id) => { setSelectedId(id); setRescheduling(false); setCancelPendingId(''); }} />}
    {!loading && appointments && queue && <ReceptionAppointmentsOverview date={date} appointments={appointments} queue={queue} doctors={doctors}
      selectedId={selectedId} onDateChange={selectDate} onSelect={(id) => { setSelectedId(id); setRescheduling(false); setCancelPendingId(''); }} />}
    {selected && !loading && <dialog ref={detailDialog} className={`reception-detail-dialog${rescheduling ? ' is-rescheduling' : ''}`} aria-label="Chi tiết lịch hẹn"
      onCancel={(event) => { event.preventDefault(); closeDetail(); }}>
      {error && <div className="reception-detail-message"><Alert tone="error">{error}</Alert></div>}
      {notice && <div className="reception-detail-message"><Alert tone="info">{notice}</Alert></div>}
    {!rescheduling && <ReceptionAppointmentDetail appointment={selected} visit={selectedVisit} doctor={selectedDoctor}
      patient={detailPatient?.id === selected.patientId ? detailPatient : undefined}
      patientLoading={detailPatientLoading} patientError={detailPatientError ?? undefined}
      onClose={closeDetail} closeDisabled={busy}
      actions={!selectedVisit && ['PENDING', 'CONFIRMED'].includes(selected.status) ? <>
          {selected.status === 'PENDING' && integrations.appointmentOwnership &&
            <button type="button" disabled={busy} onClick={() => void execute(() => confirmAppointment(selected.id), 'Đã xác nhận lịch hẹn.',
              (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CONFIRMED')}>Xác nhận lịch</button>}
          <button type="button" disabled={busy} onClick={() => { setCancelPendingId(''); setRescheduling(true); setRescheduleDraft({ ...blankBooking, doctorId: selected.doctorId, patientId: selected.patientId, appointmentDate: selected.appointmentDate, startTime: '', endTime: '' }); }}>Đổi lịch</button>
          <button type="button" disabled={busy} className="soft-button danger" onClick={() => { setCancelPendingId(selected.id); setRescheduling(false); }}>Hủy lịch</button>
          {selected.status === 'CONFIRMED' && selected.appointmentDate === todayKey &&
            <button type="button" disabled={busy} onClick={() => void execute(() => checkInReceptionAppointment(selected.id), 'Đã tiếp nhận bệnh nhân.',
              (result) => (result as ReceptionVisitResponse).appointmentId === selected.id)}>Check-in bệnh nhân</button>}
        </> : undefined}
      cancellation={cancelPendingId === selected.id && !selectedVisit ? <div className="reception-desk-cancel" role="group" aria-label="Xác nhận hủy lịch">
          <p>Hủy lịch #{shortId(selected.id)}? Thao tác này chỉ được gửi khi bạn xác nhận.</p>
          <button type="button" className="soft-button danger" disabled={busy} onClick={() => void execute(() => cancelReceptionAppointment(selected.id), 'Đã hủy lịch hẹn.',
            (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CANCELLED').then((success) => { if (success) setCancelPendingId(''); })}>Xác nhận hủy lịch</button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => setCancelPendingId('')}>Giữ lịch</button>
        </div> : undefined} />}
    {rescheduling && !selectedVisit && <form className="panel settings-form reception-desk-form reception-detail-reschedule" onSubmit={(event) => void reschedule(event)}>
      <div className="reception-desk-form-head"><span className="reception-desk-section-kicker">THAY ĐỔI LỊCH</span><h3>Đổi lịch hẹn</h3><p>Không cho phép đổi lịch sau khi bệnh nhân đã check-in.</p></div>
      <div className="reception-desk-form-fields"><div className="doctor-picker-field"><span id="reschedule-doctor-label">Bác sĩ</span>{doctorInput(rescheduleDraft.doctorId, (doctorId) => setRescheduleDraft((draft) => ({ ...draft, doctorId, startTime: '', endTime: '' })), 'reschedule-doctor-label')}</div>
      <label>Ngày khám<input type="date" required min={todayKey} value={rescheduleDraft.appointmentDate} onChange={(event) => setRescheduleDraft((draft) => ({ ...draft, appointmentDate: event.target.value, startTime: '', endTime: '' }))} /></label>
      <DoctorScheduleTimeFields doctorId={rescheduleDraft.doctorId} date={rescheduleDraft.appointmentDate}
        schedules={rescheduleSchedule.schedules} loading={rescheduleSchedule.loading} error={rescheduleSchedule.error}
        start={rescheduleDraft.startTime} end={rescheduleDraft.endTime} disabled={busy}
        onStartChange={(startTime) => setRescheduleDraft((draft) => ({ ...draft, startTime, endTime: '' }))}
        onEndChange={(endTime) => setRescheduleDraft((draft) => ({ ...draft, endTime }))} /></div>
      <div className="reception-desk-form-actions"><button type="submit" disabled={busy || !!receptionSlotError(rescheduleDraft)
        || !!scheduleSlotError(rescheduleSchedule.schedules, rescheduleDraft.appointmentDate, rescheduleDraft.startTime, rescheduleDraft.endTime)}>Xác nhận đổi lịch</button>
      <button type="button" className="soft-button" disabled={busy} onClick={() => setRescheduling(false)}>Quay lại chi tiết</button></div>
    </form>}
    </dialog>}
    <section className="panel reception-desk-queue" aria-label="Hàng đợi tiếp nhận"><div className="reception-desk-queue-head"><div><span className="reception-desk-section-kicker">HÀNG ĐỢI THEO NGÀY</span><h3>Hàng đợi tiếp nhận</h3><p>Ngày {formatDate(date)} · Cập nhật theo quy trình tiếp nhận.</p></div><strong>{queue?.length ?? '—'} lượt</strong></div>
      {queue?.length === 0 && <p className="reception-desk-empty">Chưa có bệnh nhân check-in trong ngày đã chọn.</p>}
      {queue?.filter((visit) => visit.visitDate === date).sort((a, b) => a.queueNumber - b.queueNumber).map((visit) => <article className="reception-desk-queue-row" key={visit.id}>
        <span className="reception-desk-ticket">#{visit.queueNumber}</span>
        <div className="reception-desk-queue-person"><strong>{visit.patientName || `BN #${shortId(visit.patientId)}`}</strong><span>Lịch #{shortId(visit.appointmentId)}</span></div>
        <Badge tone={visit.status}>{statusLabel(visit.status)}</Badge>
        <div className="reception-desk-queue-actions">{allowedQueueTransitions(visit.status, role).map((status) => <button key={status} type="button" disabled={busy}
          onClick={() => void execute(() => updateReceptionQueue(visit.id, status), `Đã cập nhật: ${statusLabel(status)}.`,
            (result) => (result as ReceptionVisitResponse).id === visit.id && (result as ReceptionVisitResponse).status === status)}>{status === 'CALLED' ? 'Gọi bệnh nhân' : status === 'SKIPPED' ? 'Bỏ qua lượt' : status === 'WAITING' ? 'Đưa về chờ' : statusLabel(status)}</button>)}</div>
      </article>)}
      {role === 'RECEPTIONIST' && <p className="reception-desk-permission">Lễ tân gọi, bỏ qua hoặc đưa lượt về trạng thái chờ. Bác sĩ phụ trách bắt đầu và hoàn tất khám.</p>}
    </section>
    {showBooking && <dialog ref={bookingDialog} className="reception-booking-dialog" aria-labelledby="reception-booking-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) setShowBooking(false); }}>
      <section className="settings-form reception-desk-form reception-booking-content" id="reception-booking-form" aria-label="Đặt lịch cho bệnh nhân">
        <header className="reception-booking-head">
          <div className="reception-desk-form-head"><span className="reception-desk-section-kicker">ĐẶT LỊCH MỚI</span>
            <h3 id="reception-booking-title">Đặt lịch cho bệnh nhân</h3><p>Tìm bệnh nhân, chọn bác sĩ và thời gian khám.</p></div>
          <button type="button" className="soft-button reception-booking-close" disabled={busy} aria-label="Đóng biểu mẫu đặt lịch"
            onClick={() => setShowBooking(false)}><X size={18} aria-hidden="true" /></button>
        </header>
        <div className="reception-booking-step"><strong>1. Tìm bệnh nhân</strong><span>Nhập tên hoặc số điện thoại để chọn đúng hồ sơ.</span></div>
        <form className="inline-search reception-booking-search" onSubmit={(event) => void searchPatients(event)}>
          <input required aria-label="Tên hoặc số điện thoại bệnh nhân" placeholder="Tên hoặc số điện thoại bệnh nhân..."
            value={patientSearch} onChange={(event) => {
              patientSearchRequest.current += 1;
              setPatientSearch(event.target.value); setPatients(null); setSearchError(null);
              setBooking((draft) => ({ ...draft, patientId: '' }));
            }} />
          <button type="submit" disabled={busy}>{searchingPatients ? 'Đang tìm...' : 'Tìm bệnh nhân'}</button>
        </form>
        {searchError && <div className="reception-booking-error" role="alert">{searchError}</div>}
        {patients?.length === 0 && <p className="reception-desk-empty" role="status">Không tìm thấy bệnh nhân phù hợp. Thử tên khác hoặc nhập đầy đủ số điện thoại.</p>}
        {patients && patients.length > 0 && <div className="reception-patient-results" aria-label="Kết quả tìm bệnh nhân">
          <p role="status">Tìm thấy {patients.length}{patients.length === 50 ? ' (tối đa 50 kết quả, hãy nhập tên cụ thể hơn)' : ''} bệnh nhân. Chọn một người bên dưới:</p>
          <ul>{patients.map((patient) => <li key={patient.id}>
            <button type="button" className="reception-patient-choice" aria-pressed={booking.patientId === patient.id}
              onClick={() => { setBooking((draft) => ({ ...draft, patientId: patient.id })); setBookingError(null); }}>
              <span><strong>{patient.fullName}</strong><small>{patient.phone || 'Chưa có số điện thoại'} · Mã {shortId(patient.id)}</small></span>
              <span className="reception-patient-choice-state">{booking.patientId === patient.id ? 'Đã chọn ✓' : 'Chọn'}</span>
            </button>
          </li>)}</ul>
        </div>}
        <form className="reception-booking-form" onSubmit={(event) => void book(event)}>
          {booking.patientId && <p className="reception-selected-patient">Bệnh nhân đã chọn: <strong>{patients?.find((patient) => patient.id === booking.patientId)?.fullName ?? shortId(booking.patientId)}</strong></p>}
          <div className="reception-booking-step"><strong>2. Thông tin lịch khám</strong><span>Kiểm tra bác sĩ và khung giờ trước khi xác nhận.</span></div>
          <div className="reception-booking-fields">
            <div className="reception-booking-wide doctor-picker-field"><span id="booking-doctor-label">Bác sĩ</span>{doctorInput(booking.doctorId, (doctorId) => { setBooking((draft) => ({ ...draft, doctorId, startTime: '', endTime: '' })); setBookingError(null); }, 'booking-doctor-label')}</div>
            {!doctors && <p className="reception-desk-empty reception-booking-wide">{doctorError ? `Không tải được bác sĩ: ${doctorError}. Nhấn Làm mới để thử lại.` : 'Đang tải danh sách bác sĩ...'}</p>}
            <label className="reception-booking-wide">Ngày khám<input type="date" required min={todayKey} value={booking.appointmentDate} onChange={(event) => { setBooking((draft) => ({ ...draft, appointmentDate: event.target.value, startTime: '', endTime: '' })); setBookingError(null); }} /></label>
            <DoctorScheduleTimeFields doctorId={booking.doctorId} date={booking.appointmentDate}
              schedules={bookingSchedule.schedules} loading={bookingSchedule.loading} error={bookingSchedule.error}
              start={booking.startTime} end={booking.endTime} disabled={busy}
              onStartChange={(startTime) => { setBooking((draft) => ({ ...draft, startTime, endTime: '' })); setBookingError(null); }}
              onEndChange={(endTime) => { setBooking((draft) => ({ ...draft, endTime })); setBookingError(null); }} />
            <label className="reception-booking-wide">Lý do khám<textarea required maxLength={500} rows={3} value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
          </div>
          <p className="reception-booking-time-note">Lịch phải bắt đầu sau thời điểm hiện tại theo giờ Việt Nam. Bác sĩ và khung giờ vẫn được hệ thống kiểm tra khi gửi.</p>
          {bookingSlotWarning && <p className="reception-booking-error" role="status">{bookingSlotWarning}</p>}
          {bookingError && <div className="reception-booking-error" role="alert">{bookingError}</div>}
          <footer className="reception-booking-footer">
            <button type="button" className="soft-button" disabled={busy} onClick={() => setShowBooking(false)}>Để sau</button>
            <button type="submit" disabled={busy || !booking.patientId || !doctors?.some((doctor) => doctor.id === booking.doctorId)
              || !!receptionSlotError(booking) || !!scheduleSlotError(bookingSchedule.schedules, booking.appointmentDate, booking.startTime, booking.endTime)}>Tạo lịch hẹn</button>
          </footer>
        </form>
      </section>
    </dialog>}
  </div>;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể hoàn tất yêu cầu lễ tân.';
}
