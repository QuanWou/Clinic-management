import { type FormEvent, useEffect, useState } from 'react';
import {
  bookReceptionAppointment, cancelReceptionAppointment, checkInReceptionAppointment,
  confirmAppointment, getAdminDoctors, getDoctors, getReceptionAppointments, getReceptionQueue,
  getAppointmentAvailability, rescheduleReceptionAppointment, searchReceptionPatients, updateReceptionQueue
} from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
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
import { clinicToday } from '../api/staffDashboard';
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
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">Reception bookings are restricted to authorized clinic staff.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Appointments" subtitle="Reception scheduling and queue" />
    <Alert tone="info">Staff bookings, check-in, queue and rescheduling are unavailable until Task 03 is merged, running and routed.</Alert></>;
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
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [booking, setBooking] = useState(blankBooking);
  const [selectedId, setSelectedId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [cancelPendingId, setCancelPendingId] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = appointments?.find((item) => item.id === selectedId);
  const selectedVisit = queue?.find((visit) => visit.appointmentId === selected?.id);
  useEffect(() => {
    if (!preselectedPatient?.id) return;
    setPatients([preselectedPatient]);
    setPatientSearch(preselectedPatient.fullName);
    setBooking((current) => ({ ...current, patientId: preselectedPatient.id }));
    setShowBooking(true);
  }, [preselectedPatient?.id]);
  useEffect(() => {
    if (role === 'RECEPTIONIST' && showBooking) {
      document.getElementById('reception-booking-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showBooking, role]);
  useEffect(() => {
    if (role === 'RECEPTIONIST' && selectedId) {
      document.getElementById('reception-detail-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedId, role]);
  function selectDate(next: string) {
    setSelectedId('');
    setRescheduling(false);
    setCancelPendingId('');
    setDate(next);
  }

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setDoctorError(null); setDoctors(null);
    setAppointments(null); setQueue(null);
    // Only administrators call the privileged directory; receptionists use the
    // authenticated, active-doctors-only /api/doctors endpoint.
    const directory = role === 'ADMIN' && integrations.adminCatalog
      ? getAdminDoctors().then((page) => {
        if (!Array.isArray(page.content)) throw new Error('Invalid administrator doctor directory');
        return page.content.filter((doctor) => doctor.active);
      }) : getDoctors();
    void Promise.allSettled([getReceptionAppointments({ date }), getReceptionQueue({ date }), directory])
      .then(([bookings, visits, doctorList]) => {
        if (!active) return;
        if (bookings.status === 'rejected' || visits.status === 'rejected') {
          setError(message(bookings.status === 'rejected' ? bookings.reason : visits.status === 'rejected' ? visits.reason : null));
          return;
        }
        if (!Array.isArray(bookings.value) || !Array.isArray(visits.value)) {
          setError('Invalid receptionist API response');
          return;
        }
        setAppointments(bookings.value); setQueue(visits.value);
        if (doctorList.status === 'fulfilled' && Array.isArray(doctorList.value)) {
          setDoctors(doctorList.value);
        } else {
          setDoctorError(doctorList.status === 'rejected' ? message(doctorList.reason) : 'Invalid doctor directory response');
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
        throw new Error('Server did not confirm the requested state. Refresh to verify before proceeding.');
      }
      setNotice(confirmation);
      setRevision((value) => value + 1);
      return true;
    } catch (cause) { setError(message(cause)); return false; }
    finally { setBusy(false); }
  }

  async function searchPatients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setPatients(null);
    if (!patientSearch.trim()) { setError('Nhập tên hoặc số điện thoại bệnh nhân.'); return; }
    setBusy(true);
    try {
      const term = patientSearch.trim();
      const result = await searchReceptionPatients(/^[+\d\s().-]+$/.test(term)
        ? { phone: term } : { name: term });
      if (!Array.isArray(result)) throw new Error('Dữ liệu tìm kiếm bệnh nhân không hợp lệ.');
      setPatients(result);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  function validSlot() {
    return uuid.test(booking.doctorId) && booking.appointmentDate >= todayKey && booking.startTime < booking.endTime;
  }

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uuid.test(booking.patientId) || !validSlot() || !booking.reason.trim()) {
      setError('Chọn bệnh nhân, bác sĩ, khung giờ hợp lệ từ hôm nay và nhập lý do khám.'); return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      const availability = await getAppointmentAvailability(booking.doctorId, booking.appointmentDate, booking.startTime, booking.endTime);
      if (!availability.available) {
        setError('Khung giờ này không còn khả dụng. Hãy chọn thời gian khác trước khi tạo lịch.');
        return;
      }
    } catch (cause) {
      setError(message(cause));
      return;
    } finally {
      setBusy(false);
    }
    const succeeded = await execute(() => bookReceptionAppointment({ ...booking, reason: booking.reason.trim() }), 'Máy chủ đã xác nhận tạo lịch hẹn.',
      (result) => (result as AppointmentResponse).status === 'PENDING' && (result as AppointmentResponse).patientId === booking.patientId
        && (result as AppointmentResponse).doctorId === booking.doctorId);
    if (succeeded) { setShowBooking(false); setBooking(blankBooking); onPatientConsumed?.(); }
  }

  async function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !validSlot()) { setError('Chọn lịch hẹn và khung giờ hợp lệ từ hôm nay.'); return; }
    const request: ReceptionRescheduleRequest = {
      doctorId: booking.doctorId, appointmentDate: booking.appointmentDate,
      startTime: booking.startTime, endTime: booking.endTime
    };
    const succeeded = await execute(() => rescheduleReceptionAppointment(selected.id, request), 'Máy chủ đã xác nhận đổi lịch.',
      (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'PENDING'
        && (result as AppointmentResponse).appointmentDate === request.appointmentDate);
    if (succeeded) setRescheduling(false);
  }

  const doctorDirectoryAvailable = doctors !== null;
  const doctorInput = (value: string, change: (id: string) => void) => doctorDirectoryAvailable
    ? <select required value={value} onChange={(event) => change(event.target.value)}>
      <option value="">{doctors.length ? 'Chọn bác sĩ' : 'Chưa có bác sĩ đang hoạt động'}</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.specialtyName || 'Bác sĩ'} — {doctor.id.slice(0, 8)}</option>)}
    </select>
    : <input required value={value} placeholder="Mã UUID bác sĩ từ lịch phòng khám" onChange={(event) => change(event.target.value)} />;

  return <div className={`reception-workspace${role === 'RECEPTIONIST' ? ' receptionist-workspace' : ''}`}>
    <PageHeader title={role === 'RECEPTIONIST' ? 'Lịch hẹn lễ tân' : 'Lịch hẹn'} subtitle={role === 'RECEPTIONIST' ? 'Tiếp đón bệnh nhân, quản lý lịch và hàng đợi trong phạm vi lễ tân' : 'Quản lý và theo dõi lịch khám từ dữ liệu phòng khám'}
      actions={<><button type="button" disabled={busy} onClick={() => setShowBooking((value) => !value)}>{showBooking ? 'Đóng đặt lịch' : 'Đặt lịch cho bệnh nhân'}</button>
        <button type="button" disabled={loading || busy} className="soft-button" onClick={() => setRevision((value) => value + 1)}>Làm mới</button></>} />
    {error && <Alert tone="error">{error} <button type="button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    {doctorError && appointments && <Alert tone="info">Không tải được danh sách bác sĩ: {doctorError}. Vẫn có thể xem lịch hẹn theo mã định danh.</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {loading && <p role="status">Đang tải lịch hẹn và hàng đợi từ API...</p>}
    {role === 'RECEPTIONIST' && !loading && appointments && queue && <ReceptionDeskOverview date={date} today={todayKey} appointments={appointments} queue={queue}
      onBooking={() => setShowBooking(true)} onSelect={(id) => { setSelectedId(id); setRescheduling(false); setCancelPendingId(''); }} />}
    {!loading && appointments && queue && <ReceptionAppointmentsOverview date={date} appointments={appointments} queue={queue} doctors={doctors}
      selectedId={selectedId} onDateChange={selectDate} onSelect={(id) => { setSelectedId(id); setRescheduling(false); setCancelPendingId(''); }} />}
    {selected && !loading && <section className="reception-detail-grid">
      <article className="panel detail-panel reception-desk-detail" id="reception-detail-panel"><div className="reception-detail-header"><div><span className="reception-desk-section-kicker">THÔNG TIN LỊCH KHÁM</span><h3>Chi tiết lịch hẹn</h3></div><button type="button" className="soft-button" onClick={() => { setSelectedId(''); setRescheduling(false); setCancelPendingId(''); }}>Đóng chi tiết</button></div>
        <div className="reception-desk-detail-facts"><span>Mã lịch <strong>{shortId(selected.id)}</strong></span><span>Ngày khám <strong>{formatDate(selected.appointmentDate)}</strong></span><span>Khung giờ <strong>{formatTime(selected.startTime)}–{formatTime(selected.endTime)}</strong></span><span>Trạng thái <Badge tone={selectedVisit?.status ?? selected.status}>{statusLabel(selectedVisit?.status ?? selected.status)}</Badge></span></div>
        <p className="reception-desk-detail-reason">Lý do khám: {selected.reason || 'Chưa có lý do khám.'}</p>
        {selectedVisit && <p className="info-note">Lịch đã check-in. Không thể hủy hoặc đổi lịch sau tiếp nhận.</p>}
        {!selectedVisit && ['PENDING', 'CONFIRMED'].includes(selected.status) && <div className="detail-actions">
          {selected.status === 'PENDING' && integrations.appointmentOwnership &&
            <button type="button" disabled={busy} onClick={() => void execute(() => confirmAppointment(selected.id), 'Máy chủ đã xác nhận lịch hẹn.',
              (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CONFIRMED')}>Xác nhận lịch</button>}
          <button type="button" disabled={busy} onClick={() => { setCancelPendingId(''); setRescheduling(true); setBooking({ ...blankBooking, doctorId: selected.doctorId, patientId: selected.patientId, appointmentDate: selected.appointmentDate, startTime: selected.startTime, endTime: selected.endTime }); }}>Đổi lịch</button>
          <button type="button" disabled={busy} className="soft-button danger" onClick={() => { setCancelPendingId(selected.id); setRescheduling(false); }}>Hủy lịch</button>
          {selected.status === 'CONFIRMED' && selected.appointmentDate === todayKey &&
            <button type="button" disabled={busy} onClick={() => void execute(() => checkInReceptionAppointment(selected.id), 'Máy chủ đã xác nhận tiếp nhận bệnh nhân.',
              (result) => (result as ReceptionVisitResponse).appointmentId === selected.id)}>Check-in bệnh nhân</button>}
        </div>}
        {cancelPendingId === selected.id && !selectedVisit && <div className="reception-desk-cancel" role="group" aria-label="Xác nhận hủy lịch">
          <p>Hủy lịch #{shortId(selected.id)}? Thao tác này chỉ được gửi khi bạn xác nhận.</p>
          <button type="button" className="soft-button danger" disabled={busy} onClick={() => void execute(() => cancelReceptionAppointment(selected.id), 'Máy chủ đã xác nhận hủy lịch.',
            (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CANCELLED').then((success) => { if (success) setCancelPendingId(''); })}>Xác nhận hủy lịch</button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => setCancelPendingId('')}>Giữ lịch</button>
        </div>}
      </article>
    </section>}
    {rescheduling && selected && !selectedVisit && <form className="panel settings-form reception-desk-form" onSubmit={(event) => void reschedule(event)}>
      <div className="reception-desk-form-head"><span className="reception-desk-section-kicker">THAY ĐỔI LỊCH</span><h3>Đổi lịch hẹn</h3><p>Không cho phép đổi lịch sau khi bệnh nhân đã check-in.</p></div>
      <div className="reception-desk-form-fields"><label>Bác sĩ {doctorInput(booking.doctorId, (doctorId) => setBooking({ ...booking, doctorId }))}</label>
      <label>Ngày khám<input type="date" required min={todayKey} value={booking.appointmentDate} onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
      <label>Giờ bắt đầu<input type="time" required value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
      <label>Giờ kết thúc<input type="time" required value={booking.endTime} onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label></div>
      <div className="reception-desk-form-actions"><button type="submit" disabled={busy}>Xác nhận đổi lịch</button>
      <button type="button" className="soft-button" onClick={() => setRescheduling(false)}>Đóng</button></div>
    </form>}
    <section className="panel reception-desk-queue" aria-label="Hàng đợi tiếp nhận"><div className="reception-desk-queue-head"><div><span className="reception-desk-section-kicker">HÀNG ĐỢI THEO NGÀY</span><h3>Hàng đợi tiếp nhận</h3><p>Ngày {formatDate(date)} · Chỉ thay đổi trạng thái được phép theo vai trò.</p></div><strong>{queue?.length ?? '—'} lượt</strong></div>
      {queue?.length === 0 && <p className="reception-desk-empty">Chưa có bệnh nhân check-in trong ngày đã chọn.</p>}
      {queue?.filter((visit) => visit.visitDate === date).sort((a, b) => a.queueNumber - b.queueNumber).map((visit) => <article className="reception-desk-queue-row" key={visit.id}>
        <span className="reception-desk-ticket">#{visit.queueNumber}</span>
        <div className="reception-desk-queue-person"><strong>{visit.patientName || `BN #${shortId(visit.patientId)}`}</strong><span>Lịch #{shortId(visit.appointmentId)}</span></div>
        <Badge tone={visit.status}>{statusLabel(visit.status)}</Badge>
        <div className="reception-desk-queue-actions">{allowedQueueTransitions(visit.status, role).map((status) => <button key={status} type="button" disabled={busy}
          onClick={() => void execute(() => updateReceptionQueue(visit.id, status), `Máy chủ đã xác nhận: ${statusLabel(status)}.`,
            (result) => (result as ReceptionVisitResponse).id === visit.id && (result as ReceptionVisitResponse).status === status)}>{status === 'CALLED' ? 'Gọi bệnh nhân' : status === 'SKIPPED' ? 'Bỏ qua lượt' : status === 'WAITING' ? 'Đưa về chờ' : statusLabel(status)}</button>)}</div>
      </article>)}
      {role === 'RECEPTIONIST' && <p className="reception-desk-permission">Lễ tân chỉ được gọi, bỏ qua hoặc đưa lượt về trạng thái chờ. Bác sĩ phụ trách thao tác bắt đầu và hoàn tất khám.</p>}
    </section>
    {showBooking && <section className="panel settings-form reception-desk-form" id="reception-booking-form" aria-label="Đặt lịch cho bệnh nhân"><div className="reception-desk-form-head"><span className="reception-desk-section-kicker">ĐẶT LỊCH MỚI</span><h3>Tìm bệnh nhân trước khi đặt lịch</h3><p>Chọn bệnh nhân từ kết quả API; không sử dụng bệnh nhân mẫu.</p></div>
      <form className="inline-search" onSubmit={(event) => void searchPatients(event)}>
        <input required aria-label="Tên hoặc số điện thoại bệnh nhân" placeholder="Nhập tên hoặc số điện thoại..." value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
        <button type="submit" disabled={busy}>Tìm bệnh nhân</button>
      </form>
      {patients?.length === 0 && <p className="reception-desk-empty">Không tìm thấy bệnh nhân phù hợp.</p>}
      <form onSubmit={(event) => void book(event)}>
        <label>Bệnh nhân <select required value={booking.patientId} onChange={(event) => setBooking({ ...booking, patientId: event.target.value })}>
          <option value="">Chọn bệnh nhân từ kết quả tìm kiếm</option>
          {patients?.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName} — {patient.id.slice(0, 8)}</option>)}
        </select></label>
        <label>Bác sĩ {doctorInput(booking.doctorId, (doctorId) => setBooking({ ...booking, doctorId }))}</label>
        {!doctorDirectoryAvailable && <p className="reception-desk-empty">Danh sách bác sĩ chưa khả dụng. Dùng UUID bác sĩ được phòng khám cung cấp; không nhập mã mẫu.</p>}
        <label>Ngày khám<input type="date" required min={todayKey} value={booking.appointmentDate} onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
        <label>Giờ bắt đầu<input type="time" required value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
        <label>Giờ kết thúc<input type="time" required value={booking.endTime} onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label>
        <label>Lý do khám<textarea required maxLength={500} value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
        <button type="submit" disabled={busy || !booking.patientId}>Tạo lịch hẹn</button>
      </form>
    </section>}
  </div>;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Reception request failed';
}