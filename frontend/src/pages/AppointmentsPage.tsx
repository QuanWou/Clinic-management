import { CalendarPlus, Search } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
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

export default function AppointmentsPage({ appointments, role, error, loading, onRefresh }: AppointmentsPageProps) {
  if (role === 'ADMIN' || role === 'RECEPTIONIST') return <ReceptionAppointmentsPage role={role} />;
  if (role === 'PATIENT') return <PatientAppointmentsWorkspace appointments={appointments} error={error} loading={loading} onRefresh={onRefresh} />;
  if (role === 'DOCTOR' && !integrations.appointmentOwnership) {
    return <><PageHeader title="Appointments" subtitle="Your assigned appointments" />
      <Alert tone="info">Doctor appointment access is unavailable until Task 01 ownership checks are merged and verified.</Alert></>;
  }
  if (role === 'DOCTOR') return <DoctorAppointmentsWorkspace />;
  return <PersonalAppointmentsPage appointments={appointments} role={role} error={error} loading={loading} onRefresh={onRefresh} />;
}

function PersonalAppointmentsPage({ appointments, role, error, loading, onRefresh }: AppointmentsPageProps) {
  const [localRows, setLocalRows] = useState<AppointmentResponse[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [booking, setBooking] = useState(initialBooking);
  const [showBooking, setShowBooking] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [doctorOptions, setDoctorOptions] = useState<DoctorProfileResponse[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const isPatient = role === 'PATIENT';
  useEffect(() => { if (isPatient) setLocalRows(null); }, [appointments, isPatient]);
  useEffect(() => {
    if (!isPatient || !showBooking) return;
    let active = true;
    setDirectoryError(null); setDoctorOptions(null);
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result)) throw new Error('Invalid doctor directory');
      setDoctorOptions(result);
    }).catch((cause: unknown) => {
      if (active) setDirectoryError(cause instanceof Error ? cause.message : 'Doctor directory unavailable');
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
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Action failed'); return false; }
    finally { setBusy(false); }
  }

  async function handleBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uuidPattern.test(booking.doctorId.trim()) || booking.endTime <= booking.startTime || booking.appointmentDate < todayKey || !booking.reason.trim()) {
      setActionError('Enter a valid doctor UUID, a future date, an end time after the start time, and a reason.');
      return;
    }
    const succeeded = await runAction(async () => {
      const available = await getAppointmentAvailability(booking.doctorId, booking.appointmentDate, booking.startTime, booking.endTime);
      if (!available.available || available.doctorId !== booking.doctorId || available.date !== booking.appointmentDate) {
        throw new Error('This doctor is unavailable for the selected time. Choose another slot.');
      }
      return createAppointment({ ...booking, doctorId: booking.doctorId.trim(), reason: booking.reason.trim() });
    }, 'Appointment requested.');
    if (succeeded) { setShowBooking(false); setBooking(initialBooking); }
  }

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!uuidPattern.test(lookupId.trim())) { setActionError('Enter a valid appointment UUID.'); return; }
    await runAction(() => getAppointment(lookupId.trim()), 'Appointment loaded.');
  }

  return (
    <>
      <PageHeader title="Appointments" subtitle={isPatient ? 'View and manage your appointments.' : 'Look up an appointment by its ID. Staff-wide listing is not yet available.'}
        actions={isPatient && integrations.appointmentOwnership ? <button type="button" onClick={() => setShowBooking((value) => !value)}><CalendarPlus size={17} />New Appointment</button> : undefined} />
      {isPatient && !integrations.appointmentOwnership && <Alert tone="info">Appointment changes are unavailable until Task 01 booking integrity and ownership checks are verified. Your existing appointments remain viewable.</Alert>}
      {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {notice && <Alert tone="info">{notice}</Alert>}
      {loading && <p role="status">Loading appointments...</p>}
      {isPatient && integrations.appointmentOwnership && showBooking && <form className="panel settings-form" onSubmit={(event) => void handleBooking(event)}>
        <h3>Request an appointment</h3>
        <p>Chọn bác sĩ đang hoạt động từ API phòng khám; hệ thống kiểm tra lịch trống trước khi gửi.</p>
        {directoryError && <Alert tone="error">{directoryError}</Alert>}
        <label>Doctor <select value={booking.doctorId} required disabled={!doctorOptions?.length}
          onChange={(event) => setBooking({ ...booking, doctorId: event.target.value })}>
          <option value="">{doctorOptions?.length ? 'Chọn bác sĩ' : 'Chưa có bác sĩ khả dụng'}</option>
          {doctorOptions?.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.specialtyName || 'Bác sĩ'} · {doctor.id.slice(0, 8)}</option>)}
        </select></label>
        <label>Date<input type="date" min={todayKey} value={booking.appointmentDate} required onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
        <label>Start time<input type="time" value={booking.startTime} required onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
        <label>End time<input type="time" value={booking.endTime} required onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label>
        <label>Reason<textarea value={booking.reason} maxLength={500} required onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
        <button type="submit" disabled={busy || !doctorOptions?.length || !booking.doctorId}>Submit booking</button>
      </form>}
      {!isPatient && <form className="inline-search" onSubmit={(event) => void handleLookup(event)}>
        <Search size={16} /><input aria-label="Appointment UUID" placeholder="Appointment UUID" value={lookupId} onChange={(event) => setLookupId(event.target.value)} required />
        <button type="submit" disabled={busy}>Look up</button>
      </form>}
      <section className="split-page split-appointments">
        <article className="panel table-panel">
          <div className="tabs">{(['All', 'Upcoming', 'Completed', 'Canceled'] as Filter[]).map((tab) => (
            <button className={filter === tab ? 'active' : undefined} type="button" key={tab} onClick={() => setFilter(tab)} aria-pressed={filter === tab}>{tab}</button>
          ))}</div>
          {filtered.length === 0 && <p>{loading ? 'Loading...' : isPatient && !appointments && !localRows ? 'No appointment data loaded.' : 'No appointments found.'}</p>}
          {filtered.length > 0 && <div className="data-table"><div className="table-row table-head">
            <span>Patient ID</span><span>Doctor ID</span><span>Date & Time</span><span>Department</span><span>Status</span><span>Actions</span>
          </div>{filtered.map((item) => (
            <button className="table-row" type="button" key={item.id} onClick={() => setSelectedId(item.id)} aria-pressed={selected?.id === item.id}>
              <span className="person-cell"><Avatar label={item.patientAvatar} size="sm" />{item.patientName}</span>
              <span className="person-cell"><Avatar label={item.doctorAvatar} size="sm" />{item.doctorName}</span>
              <span>{formatDate(item.appointmentDate)}<small>{formatTime(item.startTime)}</small></span>
              <span>{item.department}</span><span><Badge tone={item.status}>{item.status}</Badge></span><span>View</span>
            </button>
          ))}</div>}
        </article>
        {selected && <article className="panel detail-panel">
          <div className="panel-heading"><h3>Appointment Details</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
          <dl className="details-list compact">
            <div><dt>Appointment ID</dt><dd>{selected.id}</dd></div>
            <div><dt>Patient ID</dt><dd>{shortId(selected.patientId)}</dd></div>
            <div><dt>Doctor ID</dt><dd>{shortId(selected.doctorId)}</dd></div>
            <div><dt>Date</dt><dd>{formatDate(selected.appointmentDate)}</dd></div>
            <div><dt>Time</dt><dd>{formatTime(selected.startTime)} – {formatTime(selected.endTime)}</dd></div>
            <div><dt>Reason</dt><dd>{selected.reason ?? 'Not provided'}</dd></div>
          </dl>
          <div className="detail-actions">
            {isPatient && integrations.appointmentOwnership && ['PENDING', 'CONFIRMED'].includes(selected.status) && <button type="button" className="soft-button danger" disabled={busy} onClick={() => void runAction(() => cancelAppointment(selected.id), 'Appointment cancelled.')}>Cancel Appointment</button>}
            {role === 'DOCTOR' && integrations.appointmentOwnership && selected.status === 'PENDING' && <button type="button" className="soft-button success" disabled={busy} onClick={() => void runAction(() => confirmAppointment(selected.id), 'Appointment confirmed.')}>Confirm Appointment</button>}
            {role === 'DOCTOR' && selected.status === 'CONFIRMED' && <p>Đối với lịch đã check-in, sử dụng Hàng đợi của tôi ở phía trên để hoàn tất đúng thứ tự.</p>}
          </div>
        </article>}
      </section>
    </>
  );
}
