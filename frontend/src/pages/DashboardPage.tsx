import type { ReactNode } from 'react';
import { CalendarDays, FileText, ReceiptText, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { StaffDashboard } from '../api/staffDashboard';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';

export type DashboardPageProps = {
  dashboard: DashboardResponse | null;
  staffDashboard?: StaffDashboard | null;
  user: CurrentUser;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

export default function DashboardPage({ dashboard, staffDashboard, user, role, error, loading, onRefresh }: DashboardPageProps) {
  const isPatient = role === 'PATIENT';
  const appointments = isPatient && dashboard ? getUiAppointments(dashboard.appointments) : [];
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayAppointments = appointments.filter((item) => item.appointmentDate === todayKey && item.status !== 'CANCELLED');
  const upcoming = appointments.filter((item) => item.appointmentDate >= todayKey && !['CANCELLED', 'COMPLETED'].includes(item.status));
  const unpaid = dashboard?.invoices.filter((item) => item.status === 'UNPAID') ?? [];

  return (
    <>
      <PageHeader title={`Welcome, ${user.fullName || user.email}`}
        subtitle={isPatient ? 'Your personal clinic information.' : `${role} workspace — data is limited to available role-authorized APIs.`}
        actions={<button className="soft-button" type="button" onClick={onRefresh} disabled={loading}><CalendarDays size={17} />Refresh</button>} />
      {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
      {loading && <p role="status">Loading dashboard...</p>}
      {!isPatient && staffDashboard && !loading && !error && <StaffOverview data={staffDashboard} role={role} />}
      {!isPatient && !staffDashboard && !loading && !error && <Alert tone="info">No schedule data loaded. Refresh to try again.</Alert>}
      {isPatient && !dashboard && !loading && !error && <Alert tone="info">No dashboard data has been loaded. Refresh to try again.</Alert>}
      {isPatient && dashboard && (
        <section className="dashboard-layout">
          <div className="dashboard-main">
            <section className="metric-grid">
              <MetricCard icon={<CalendarDays />} label="My appointments" value={appointments.length} tone="green" />
              <MetricCard icon={<UsersRound />} label="Upcoming appointments" value={upcoming.length} tone="purple" />
              <MetricCard icon={<FileText />} label="My medical records" value={dashboard.medicalRecords.length} tone="blue" />
              <MetricCard icon={<ReceiptText />} label="Unpaid invoices" value={unpaid.length} tone="orange" />
            </section>
            <section className="analytics-grid">
              <article className="panel"><div className="panel-heading"><h3>My appointments</h3></div>
                {appointments.length === 0 ? <p>No appointments found.</p> : <p>{upcoming.length} upcoming out of {appointments.length} appointments.</p>}
              </article>
              <article className="panel"><div className="panel-heading"><h3>Medical records</h3></div>
                <p>{dashboard.medicalRecords.length === 0 ? 'No medical records found.' : `${dashboard.medicalRecords.length} records available in your account.`}</p>
              </article>
              <article className="panel"><div className="panel-heading"><h3>Billing</h3></div>
                <p>{dashboard.invoices.length === 0 ? 'No invoices found.' : `${unpaid.length} unpaid of ${dashboard.invoices.length} invoices.`}</p>
              </article>
            </section>
          </div>
          <aside className="dashboard-side">
            <article className="panel today-panel">
              <div className="panel-heading"><h3>My appointments today</h3><span>{todayAppointments.length}</span></div>
              {todayAppointments.length === 0 ? <p>No appointments scheduled for today.</p> : (
                <div className="today-grid">{todayAppointments.map((appointment) => (
                  <div className="today-card" key={appointment.id}>
                    <strong>{formatTime(appointment.startTime)}</strong><span>{formatDate(appointment.appointmentDate)}</span>
                    <div><Avatar label={appointment.doctorAvatar} size="sm" /><p>{appointment.doctorName}</p></div>
                    <Badge tone={appointment.status}>{appointment.status}</Badge>
                  </div>
                ))}</div>
              )}
            </article>
          </aside>
        </section>
      )}
    </>
  );
}

function StaffOverview({ data, role }: { data: StaffDashboard; role: ClinicRole }) {
  const queue = data.queue;
  const waiting = queue.filter((visit) => visit.status === 'WAITING' || visit.status === 'CALLED').length;
  const inProgress = queue.filter((visit) => visit.status === 'IN_PROGRESS').length;
  const completed = queue.filter((visit) => visit.status === 'COMPLETED').length;
  const isDoctor = role === 'DOCTOR';
  // Defense in depth: an unexpected staff scope must never be rendered under
  // a different role, even if a previous session's state survived a refresh.
  if ((isDoctor && data.scope !== 'DOCTOR') || (!isDoctor && data.scope !== 'RECEPTION') || role === 'PATIENT') {
    return <Alert tone="error">Dashboard scope does not match your account. Refresh to reload.</Alert>;
  }
  return <section className="dashboard-layout">
    <div className="dashboard-main">
      <p>Clinic date: {formatDate(data.date)} · {isDoctor ? 'Your assigned queue' : 'Reception scheduling and check-in'}.</p>
      <section className="metric-grid">
        {data.scope === 'RECEPTION' && <MetricCard icon={<CalendarDays />} label="Appointments today" value={data.appointments.length} tone="green" />}
        <MetricCard icon={<UsersRound />} label="Waiting or called" value={waiting} tone="purple" />
        <MetricCard icon={<CalendarDays />} label="In progress" value={inProgress} tone="blue" />
        <MetricCard icon={<FileText />} label="Completed visits" value={completed} tone="orange" />
      </section>
      <article className="panel">
        <div className="panel-heading"><h3>{isDoctor ? 'My queue today' : 'Queue today'}</h3><span>{queue.length}</span></div>
        {queue.length === 0 ? <p>No checked-in visits today.</p> : <ul>{queue.map((visit) =>
          <li key={visit.id}>Ticket #{visit.queueNumber} · {visit.status}</li>
        )}</ul>}
      </article>
      {data.scope === 'RECEPTION' && <article className="panel">
        <div className="panel-heading"><h3>Appointments today</h3><span>{data.appointments.length}</span></div>
        {data.appointments.length === 0 ? <p>No appointments scheduled today.</p> : <ul>{data.appointments.map((appointment) =>
          <li key={appointment.id}>{formatTime(appointment.startTime)} · {appointment.status} · Appointment {appointment.id}</li>
        )}</ul>}
      </article>}
    </div>
  </section>;
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-icon">{icon}</div><div><strong>{value.toLocaleString()}</strong><span>{label}</span></div></article>;
}
