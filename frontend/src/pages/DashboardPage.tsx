import { CalendarDays, FileText, ReceiptText, Stethoscope, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DashboardResponse, DoctorProfileResponse, PatientProfileResponse } from '../types/domain';
import { formatDate, formatMoney, formatTime, shortId } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';

export type DashboardPageProps = {
  dashboard: DashboardResponse | null;
  doctors: DoctorProfileResponse[] | null;
  patients: PatientProfileResponse[] | null;
  user: CurrentUser;
  error?: string;
  loading: boolean;
};

export default function DashboardPage({ dashboard, doctors, patients, user, error, loading }: DashboardPageProps) {
  const appointments = getUiAppointments(dashboard?.appointments, { user, patients, doctors });
  const invoiceTotal = dashboard?.invoices.reduce((total, invoice) => total + Number(invoice.totalAmount ?? 0), 0);
  const today = new Date();
  const localDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayAppointments = appointments.filter((appointment) => appointment.appointmentDate === localDate);

  return (
    <>
      {error && <Alert tone="error">Some live data could not be loaded: {error}</Alert>}
      <PageHeader
        title={`Welcome, ${user.fullName ?? user.email}`}
        subtitle="Live information available to your account. Counts are not clinic-wide unless stated."
      />
      {!dashboard && !loading && <Alert>Personal appointments, medical records and billing are currently available only through the patient APIs. Other roles can use the doctor and patient directories permitted to them.</Alert>}
      <section className="dashboard-layout">
        <div className="dashboard-main">
          <section className="metric-grid">
            <article className="metric-card metric-green">
              <div className="metric-icon"><UsersRound /></div>
              <div><strong>{patients === null ? '—' : patients.length.toLocaleString()}</strong><span>Visible patient profiles</span></div>
              <p>Based on access rights</p>
            </article>
            <article className="metric-card metric-purple">
              <div className="metric-icon"><Stethoscope /></div>
              <div><strong>{doctors === null ? '—' : doctors.length.toLocaleString()}</strong><span>Doctors in directory</span></div>
              <p>From doctor service</p>
            </article>
            <article className="metric-card metric-blue">
              <div className="metric-icon"><CalendarDays /></div>
              <div><strong>{dashboard ? appointments.length.toLocaleString() : '—'}</strong><span>My appointments</span></div>
              <p>From appointment service</p>
            </article>
            <article className="metric-card metric-orange">
              <div className="metric-icon"><ReceiptText /></div>
              <div><strong>{invoiceTotal === undefined ? '—' : formatMoney(invoiceTotal)}</strong><span>My invoice total</span></div>
              <p>All statuses, not revenue</p>
            </article>
          </section>
          <section className="analytics-grid">
            <article className="panel">
              <div className="panel-heading"><h3>My medical records</h3><FileText size={20} /></div>
              <strong>{dashboard ? dashboard.medicalRecords.length.toLocaleString() : 'Not available'}</strong>
              <p className="muted">Records returned for your account.</p>
            </article>
            <article className="panel">
              <div className="panel-heading"><h3>Appointment status</h3><CalendarDays size={20} /></div>
              {dashboard ? (
                <div className="treatment-list">
                  {(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const).map((status) => (
                    <div key={status}><div><strong>{status}</strong><span>{appointments.filter((appointment) => appointment.status === status).length}</span></div></div>
                  ))}
                </div>
              ) : <p className="muted">Not available for this account.</p>}
            </article>
          </section>
        </div>
        <aside className="dashboard-side">
          <article className="panel schedule-panel">
            <div className="panel-heading"><h3>Doctor directory</h3><span>{doctors === null ? 'Unavailable' : `${doctors.length} profiles`}</span></div>
            {doctors?.slice(0, 5).map((doctor) => (
              <div className="person-row" key={doctor.id}>
                <Avatar label={doctor.userId === user.id ? user.fullName ?? user.email : 'DR'} />
                <div>
                  <strong>{doctor.userId === user.id ? user.fullName ?? user.email : `Doctor ${shortId(doctor.id)}`}</strong>
                  <span>{doctor.specialtyName ?? 'Specialty not provided'}</span>
                </div>
              </div>
            ))}
            {doctors?.length === 0 && <p className="muted">No doctor profiles found.</p>}
          </article>
          <article className="panel today-panel">
            <div className="panel-heading"><h3>My appointments today</h3><span>{dashboard ? todayAppointments.length : 'Unavailable'}</span></div>
            {dashboard && todayAppointments.length === 0 && <p className="muted">No appointments today.</p>}
            <div className="today-grid">
              {todayAppointments.slice(0, 4).map((appointment) => (
                <div className="today-card" key={appointment.id}>
                  <strong>{formatTime(appointment.startTime)}</strong>
                  <span>{formatDate(appointment.appointmentDate)}</span>
                  <div><Avatar label={appointment.patientAvatar} size="sm" /><p>{appointment.patientName}</p></div>
                  <Badge tone={appointment.status}>{appointment.status}</Badge>
                </div>
              ))}
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}
