import { type FormEvent, useEffect, useState } from 'react';
import {
  bookReceptionAppointment, cancelReceptionAppointment, checkInReceptionAppointment,
  confirmAppointment, getAdminDoctors, getDoctors, getReceptionAppointments, getReceptionQueue,
  rescheduleReceptionAppointment, searchReceptionPatients, updateReceptionQueue
} from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type {
  DoctorProfileResponse, AppointmentResponse, QueueStatus, ReceptionPatientResponse,
  ReceptionRescheduleRequest, ReceptionVisitResponse
} from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime } from '../utils/format';
import { clinicToday } from '../api/staffDashboard';

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

export default function ReceptionAppointmentsPage({ role }: { role: ClinicRole }) {
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">Reception bookings are restricted to authorized clinic staff.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Appointments" subtitle="Reception scheduling and queue" />
    <Alert tone="info">Staff bookings, check-in, queue and rescheduling are unavailable until Task 03 is merged, running and routed.</Alert></>;
  return <ActiveReceptionAppointmentsPage role={role} />;
}

function ActiveReceptionAppointmentsPage({ role }: { role: ClinicRole }) {
  const todayKey = clinicToday();
  const [date, setDate] = useState(todayKey);
  const [appointments, setAppointments] = useState<AppointmentResponse[] | null>(null);
  const [queue, setQueue] = useState<ReceptionVisitResponse[] | null>(null);
  const [patients, setPatients] = useState<ReceptionPatientResponse[] | null>(null);
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [booking, setBooking] = useState(blankBooking);
  const [selectedId, setSelectedId] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selected = appointments?.find((item) => item.id === selectedId) ?? appointments?.[0];

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    // Only administrators call the privileged directory; receptionists use the
    // authenticated, active-doctors-only /api/doctors endpoint.
    const directory = role === 'ADMIN' && integrations.adminCatalog
      ? getAdminDoctors().then((page) => {
        if (!Array.isArray(page.content)) throw new Error('Invalid administrator doctor directory');
        return page.content.filter((doctor) => doctor.active);
      }) : getDoctors();
    void Promise.all([getReceptionAppointments({ date }), getReceptionQueue({ date }), directory])
      .then(([bookings, visits, doctorList]) => {
        if (!active) return;
        if (!Array.isArray(bookings) || !Array.isArray(visits) || !Array.isArray(doctorList)) {
          throw new Error('Invalid receptionist API response');
        }
        setAppointments(bookings); setQueue(visits);
        setDoctors(doctorList);
      }).catch((cause: unknown) => { if (active) { setAppointments(null); setQueue(null); setError(message(cause)); } })
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
    if (!patientSearch.trim()) { setError('Enter a patient name or phone.'); return; }
    setBusy(true);
    try {
      const result = await searchReceptionPatients({ name: patientSearch.trim() });
      if (!Array.isArray(result)) throw new Error('Invalid patient directory response');
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
      setError('Select a registered patient, supply a valid doctor ID, future slot and reason.'); return;
    }
    const succeeded = await execute(() => bookReceptionAppointment({ ...booking, reason: booking.reason.trim() }), 'Booking request created by the server.',
      (result) => (result as AppointmentResponse).status === 'PENDING' && (result as AppointmentResponse).patientId === booking.patientId
        && (result as AppointmentResponse).doctorId === booking.doctorId);
    if (succeeded) { setShowBooking(false); setBooking(blankBooking); }
  }

  async function reschedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !validSlot()) { setError('Select an appointment and valid future slot.'); return; }
    const request: ReceptionRescheduleRequest = {
      doctorId: booking.doctorId, appointmentDate: booking.appointmentDate,
      startTime: booking.startTime, endTime: booking.endTime
    };
    const succeeded = await execute(() => rescheduleReceptionAppointment(selected.id, request), 'Reschedule confirmed by the server.',
      (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'PENDING'
        && (result as AppointmentResponse).appointmentDate === request.appointmentDate);
    if (succeeded) setRescheduling(false);
  }

  const doctorDirectoryAvailable = doctors !== null;
  const doctorInput = (value: string, change: (id: string) => void) => doctorDirectoryAvailable
    ? <select required value={value} onChange={(event) => change(event.target.value)}>
      <option value="">{doctors.length ? 'Choose a doctor' : 'No active doctors available'}</option>{doctors.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.specialtyName || 'Doctor'} — {doctor.id.slice(0, 8)}</option>)}
    </select>
    : <input required value={value} placeholder="Doctor UUID from clinic schedule" onChange={(event) => change(event.target.value)} />;

  return <>
    <PageHeader title="Appointments" subtitle="Authorized staff bookings and daily queue"
      actions={<button type="button" disabled={loading} className="soft-button" onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    {error && <Alert tone="error">{error} <button type="button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    <label>Day <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    {loading && <p role="status">Loading staff appointments and queue...</p>}
    {!loading && appointments?.length === 0 && <p>No appointments on this date.</p>}
    {appointments && appointments.length > 0 && <section className="split-page">
      <article className="panel table-panel"><h3>Daily appointments</h3>
        {appointments.map((item) => <button type="button" key={item.id} className="table-row"
          aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setRescheduling(false); }}>
          {formatTime(item.startTime)} — {item.patientId.slice(0, 8)} / {item.doctorId.slice(0, 8)} <Badge tone={item.status}>{item.status}</Badge>
        </button>)}
      </article>
      {selected && <article className="panel detail-panel"><h3>Selected appointment</h3>
        <p>{selected.id} — {formatDate(selected.appointmentDate)}</p>
        <p>{selected.reason || 'No reason supplied'}</p>
        {['PENDING', 'CONFIRMED'].includes(selected.status) && <div className="detail-actions">
          {selected.status === 'PENDING' && integrations.appointmentOwnership &&
            <button type="button" disabled={busy} onClick={() => void execute(() => confirmAppointment(selected.id), 'Appointment confirmation recorded by the server.',
              (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CONFIRMED')}>Confirm appointment</button>}
          <button type="button" disabled={busy} onClick={() => { setRescheduling(true); setBooking({ ...blankBooking, doctorId: selected.doctorId, patientId: selected.patientId, appointmentDate: selected.appointmentDate, startTime: selected.startTime, endTime: selected.endTime }); }}>Reschedule</button>
          <button type="button" disabled={busy} className="soft-button danger" onClick={() => void execute(() => cancelReceptionAppointment(selected.id), 'Cancellation confirmed by the server.',
            (result) => (result as AppointmentResponse).id === selected.id && (result as AppointmentResponse).status === 'CANCELLED')}>Cancel booking</button>
          {selected.status === 'CONFIRMED' && selected.appointmentDate === todayKey &&
            <button type="button" disabled={busy} onClick={() => void execute(() => checkInReceptionAppointment(selected.id), 'Check-in confirmed by the server.',
              (result) => (result as ReceptionVisitResponse).appointmentId === selected.id)}>Check in</button>}
        </div>}
      </article>}
    </section>}
    {rescheduling && selected && <form className="panel settings-form" onSubmit={(event) => void reschedule(event)}>
      <h3>Reschedule appointment</h3>
      <label>Doctor {doctorInput(booking.doctorId, (doctorId) => setBooking({ ...booking, doctorId }))}</label>
      <label>Date<input type="date" required min={todayKey} value={booking.appointmentDate} onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
      <label>Start<input type="time" required value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
      <label>End<input type="time" required value={booking.endTime} onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label>
      <button type="submit" disabled={busy}>Confirm reschedule</button>
      <button type="button" className="soft-button" onClick={() => setRescheduling(false)}>Close</button>
    </form>}
    <section className="panel"><h3>Queue</h3>
      {queue?.length === 0 && <p>No checked-in visits on this date.</p>}
      {queue?.map((visit) => <div className="person-row" key={visit.id}>
        <strong>#{visit.queueNumber} — {visit.patientId.slice(0, 8)}</strong><Badge tone={visit.status}>{visit.status}</Badge>
        {allowedQueueTransitions(visit.status, role).map((status) => <button key={status} type="button" disabled={busy}
          onClick={() => void execute(() => updateReceptionQueue(visit.id, status), `Queue status ${status} confirmed by the server.`,
            (result) => (result as ReceptionVisitResponse).id === visit.id && (result as ReceptionVisitResponse).status === status)}>{status}</button>)}
      </div>)}
    </section>
    <button type="button" disabled={busy} onClick={() => setShowBooking((value) => !value)}>{showBooking ? 'Close booking' : 'Book for a patient'}</button>
    {showBooking && <section className="panel settings-form"><h3>Find a patient before booking</h3>
      <form className="inline-search" onSubmit={(event) => void searchPatients(event)}>
        <input required aria-label="Patient name" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} />
        <button type="submit" disabled={busy}>Find patient</button>
      </form>
      {patients?.length === 0 && <p>No matching patient found.</p>}
      <form onSubmit={(event) => void book(event)}>
        <label>Patient <select required value={booking.patientId} onChange={(event) => setBooking({ ...booking, patientId: event.target.value })}>
          <option value="">Select a patient from search results</option>
          {patients?.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName} — {patient.id.slice(0, 8)}</option>)}
        </select></label>
        <label>Doctor {doctorInput(booking.doctorId, (doctorId) => setBooking({ ...booking, doctorId }))}</label>
        {!doctorDirectoryAvailable && <p>No role-authorized doctor directory is available. Use the clinician ID supplied by the clinic; never use sample doctors.</p>}
        <label>Date<input type="date" required min={todayKey} value={booking.appointmentDate} onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
        <label>Start<input type="time" required value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
        <label>End<input type="time" required value={booking.endTime} onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label>
        <label>Reason<textarea required maxLength={500} value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
        <button type="submit" disabled={busy || !booking.patientId}>Submit reception booking</button>
      </form>
    </section>}
  </>;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Reception request failed';
}