import { useMemo, useState } from 'react';
import { cancelAppointment } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { getUiAppointments, type Lookup } from '../utils/uiData';

type AppointmentsPageProps = {
  appointments: AppointmentResponse[] | null | undefined;
  lookup: Lookup;
  error?: string;
  supported: boolean;
  loading: boolean;
  onChanged: () => Promise<void>;
};

type Tab = 'All' | 'Upcoming' | 'Completed' | 'Canceled';

export default function AppointmentsPage({ appointments, lookup, error, supported, loading, onChanged }: AppointmentsPageProps) {
  const [tab, setTab] = useState<Tab>('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const rows = useMemo(() => getUiAppointments(appointments, lookup), [appointments, lookup.user, lookup.patients, lookup.doctors]);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const visible = rows.filter((appointment) => {
    if (tab === 'Completed') return appointment.status === 'COMPLETED';
    if (tab === 'Canceled') return appointment.status === 'CANCELLED';
    if (tab === 'Upcoming') return appointment.appointmentDate >= localDate && (appointment.status === 'PENDING' || appointment.status === 'CONFIRMED');
    return true;
  });
  const selected = visible.find((appointment) => appointment.id === selectedId) ?? visible[0];

  async function handleCancel() {
    if (!selected || !window.confirm('Cancel this appointment?')) return;
    setActionError(null);
    setActionMessage(null);
    setSubmitting(true);
    try {
      await cancelAppointment(selected.id);
      setActionMessage('Appointment cancelled successfully.');
      await onChanged();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to cancel appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader title="Appointments" subtitle="Appointments available to your account." />
      {error && <Alert tone="error">Unable to load appointments: {error}</Alert>}
      {actionError && <Alert tone="error">{actionError}</Alert>}
      {actionMessage && <Alert>{actionMessage}</Alert>}
      {!supported && <Alert>The backend currently exposes a patient appointment list only. Staff appointment lists are not available yet.</Alert>}
      {supported && !loading && !error && rows.length === 0 && <Alert>No appointments found for your account.</Alert>}
      {supported && rows.length > 0 && (
        <section className="split-page split-appointments">
          <article className="panel table-panel">
            <div className="tabs">
              {(['All', 'Upcoming', 'Completed', 'Canceled'] as Tab[]).map((item) => (
                <button className={tab === item ? 'active' : undefined} aria-pressed={tab === item} type="button" key={item} onClick={() => setTab(item)}>{item}</button>
              ))}
            </div>
            <div className="data-table">
              <div className="table-row table-head">
                <span>Patient</span><span>Doctor</span><span>Date &amp; Time</span><span>Specialty</span><span>Status</span><span>Details</span>
              </div>
              {visible.map((appointment) => (
                <button className="table-row" type="button" key={appointment.id} aria-pressed={selected?.id === appointment.id} onClick={() => setSelectedId(appointment.id)}>
                  <span className="person-cell"><Avatar label={appointment.patientAvatar} size="sm" />{appointment.patientName}</span>
                  <span className="person-cell"><Avatar label={appointment.doctorAvatar} size="sm" />{appointment.doctorName}</span>
                  <span>{formatDate(appointment.appointmentDate)}<small>{formatTime(appointment.startTime)}</small></span>
                  <span>{appointment.department}</span>
                  <span><Badge tone={appointment.status}>{appointment.status}</Badge></span>
                  <span>View</span>
                </button>
              ))}
            </div>
            {visible.length === 0 && <p className="muted">No appointments in this category.</p>}
          </article>
          {selected && (
            <article className="panel detail-panel">
              <div className="panel-heading"><h3>Appointment Details</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
              <section className="detail-columns">
                <div>
                  <h4>Patient Information</h4>
                  <Avatar label={selected.patientAvatar} size="lg" />
                  <strong>{selected.patientName}</strong>
                  <dl className="details-list compact">
                    <div><dt>ID</dt><dd>{shortId(selected.patientId)}</dd></div>
                    <div><dt>Reason</dt><dd>{selected.reason ?? 'Not provided'}</dd></div>
                  </dl>
                </div>
                <div>
                  <h4>Doctor Information</h4>
                  <Avatar label={selected.doctorAvatar} size="lg" />
                  <strong>{selected.doctorName}</strong>
                  <dl className="details-list compact">
                    <div><dt>Specialty</dt><dd>{selected.department}</dd></div>
                    <div><dt>Date</dt><dd>{formatDate(selected.appointmentDate)}</dd></div>
                    <div><dt>Time</dt><dd>{formatTime(selected.startTime)} - {formatTime(selected.endTime)}</dd></div>
                  </dl>
                </div>
              </section>
              {(selected.status === 'PENDING' || selected.status === 'CONFIRMED') && (
                <div className="detail-actions"><button className="soft-button danger" type="button" disabled={submitting} onClick={() => void handleCancel()}>{submitting ? 'Cancelling...' : 'Cancel appointment'}</button></div>
              )}
            </article>
          )}
        </section>
      )}
    </>
  );
}
