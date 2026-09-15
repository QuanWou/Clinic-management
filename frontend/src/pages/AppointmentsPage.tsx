import { CalendarPlus, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';

type AppointmentsPageProps = {
  appointments: AppointmentResponse[] | null | undefined;
};

export default function AppointmentsPage({ appointments }: AppointmentsPageProps) {
  const rows = useMemo(() => getUiAppointments(appointments), [appointments]);
  const [selectedId, setSelectedId] = useState(rows[0]?.id);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0];

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Manage all patient appointments."
        actions={(
          <>
            <button className="soft-button" type="button"><SlidersHorizontal size={17} />Filter</button>
            <button type="button"><CalendarPlus size={17} />New Appointment</button>
          </>
        )}
      />

      <section className="split-page split-appointments">
        <article className="panel table-panel">
          <div className="tabs">
            {['All', 'Upcoming', 'Completed', 'Canceled', 'No Show'].map((tab, index) => (
              <button className={index === 0 ? 'active' : undefined} type="button" key={tab}>{tab}</button>
            ))}
          </div>
          <div className="data-table">
            <div className="table-row table-head">
              <span>Patient</span>
              <span>Doctor</span>
              <span>Date & Time</span>
              <span>Department</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {rows.map((appointment) => (
              <button className="table-row" type="button" key={appointment.id} onClick={() => setSelectedId(appointment.id)}>
                <span className="person-cell"><Avatar label={appointment.patientAvatar} size="sm" />{appointment.patientName}</span>
                <span className="person-cell"><Avatar label={appointment.doctorAvatar} size="sm" />{appointment.doctorName}</span>
                <span>{formatDate(appointment.appointmentDate)}<small>{formatTime(appointment.startTime)}</small></span>
                <span>{appointment.department}</span>
                <span><Badge tone={appointment.status}>{appointment.status}</Badge></span>
                <span><MoreHorizontal size={17} /></span>
              </button>
            ))}
          </div>
        </article>

        {selected && (
          <article className="panel detail-panel">
            <div className="panel-heading">
              <h3>Appointment Details</h3>
              <button className="soft-button" type="button">Edit Appointment</button>
            </div>
            <section className="detail-columns">
              <div>
                <h4>Patient Information</h4>
                <Avatar label={selected.patientAvatar} size="lg" />
                <strong>{selected.patientName}</strong>
                <dl className="details-list compact">
                  <div><dt>ID</dt><dd>{shortId(selected.patientId)}</dd></div>
                  <div><dt>Status</dt><dd><Badge tone={selected.status}>{selected.status}</Badge></dd></div>
                  <div><dt>Reason</dt><dd>{selected.reason ?? 'Regular consultation'}</dd></div>
                </dl>
              </div>
              <div>
                <h4>Doctor Information</h4>
                <Avatar label={selected.doctorAvatar} size="lg" />
                <strong>{selected.doctorName}</strong>
                <dl className="details-list compact">
                  <div><dt>Department</dt><dd>{selected.department}</dd></div>
                  <div><dt>Date</dt><dd>{formatDate(selected.appointmentDate)}</dd></div>
                  <div><dt>Time</dt><dd>{formatTime(selected.startTime)} - {formatTime(selected.endTime)}</dd></div>
                </dl>
              </div>
            </section>
            <div className="detail-actions">
              <button className="soft-button success" type="button">Check In</button>
              <button className="soft-button" type="button">Reschedule</button>
              <button className="soft-button danger" type="button">Cancel Appointment</button>
            </div>
          </article>
        )}
      </section>
    </>
  );
}
