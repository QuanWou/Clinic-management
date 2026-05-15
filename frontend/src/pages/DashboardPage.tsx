import type { ReactNode } from 'react';
import { CalendarDays, HeartPulse, TrendingDown, TrendingUp, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import DonutChart from '../components/charts/DonutChart';
import MiniBars from '../components/charts/MiniBars';
import Sparkline from '../components/charts/Sparkline';
import PageHeader from '../components/PageHeader';
import { chartSeries, demoDoctors, demoPatients } from '../data/demoClinicData';
import type { DashboardResponse } from '../types/domain';
import { formatDate, formatMoney, formatTime } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';

export type DashboardPageProps = {
  dashboard: DashboardResponse | null;
  error: string | null;
};

export default function DashboardPage({ dashboard, error }: DashboardPageProps) {
  const appointments = getUiAppointments(dashboard?.appointments);
  const patientCount = demoPatients.length + (dashboard?.medicalRecords.length ?? 0);
  const invoiceTotal = (dashboard?.invoices ?? []).reduce((total, invoice) => total + Number(invoice.totalAmount ?? 0), 0);

  return (
    <>
      {error && <Alert tone="error">{error}</Alert>}

      <PageHeader
        title="Good morning, Olivia"
        subtitle="Here's what's happening with your clinic today."
        actions={(
          <>
            <button className="soft-button" type="button"><CalendarDays size={17} />8-12 December</button>
            <button type="button">Export Report</button>
          </>
        )}
      />

      <section className="dashboard-layout">
        <div className="dashboard-main">
          <section className="metric-grid">
            <MetricCard
              icon={<UsersRound />}
              label="Overall Visitors"
              value="748,839"
              trend="24.8%"
              direction="up"
              tone="green"
              chart={<MiniBars values={chartSeries.visitors} />}
            />
            <MetricCard
              icon={<UsersRound />}
              label="Total Patients"
              value={patientCount.toLocaleString()}
              trend="18.2%"
              direction="down"
              tone="purple"
              chart={<Sparkline values={chartSeries.patients} tone="purple" />}
            />
            <MetricCard
              icon={<CalendarDays />}
              label="Appointments"
              value={appointments.length.toLocaleString()}
              trend="40.3%"
              direction="up"
              tone="blue"
              chart={<Sparkline values={chartSeries.appointments} tone="blue" />}
            />
            <MetricCard
              icon={<HeartPulse />}
              label="Revenue"
              value={formatMoney(invoiceTotal || 48258)}
              trend="28.4%"
              direction="up"
              tone="orange"
              chart={<MiniBars values={[10, 15, 8, 11, 18, 20, 13, 9, 16, 21, 15, 26]} tone="orange" />}
            />
          </section>

          <section className="analytics-grid">
            <article className="panel patient-status">
              <div className="panel-heading">
                <div>
                  <h3>Patient Status</h3>
                  <strong>421,748 <span>+6.45%</span></strong>
                </div>
                <span>Monthly</span>
              </div>
              <div className="stacked-chart">
                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                  <div key={month}>
                    <span style={{ height: `${38 + chartSeries.patients[index]}px` }} />
                    <i style={{ height: `${10 + index * 2}px` }} />
                    <b style={{ height: `${5 + (index % 4) * 5}px` }} />
                    <small>{month}</small>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h3>Top Treatment</h3>
                <span>Monthly</span>
              </div>
              <div className="treatment-list">
                {[
                  ['Cardiology Patients', 92, 'green'],
                  ['Neurology Patients', 32, 'yellow'],
                  ['Oncology Patients', 24, 'orange']
                ].map(([label, value, tone]) => (
                  <div key={label}>
                    <div><strong>{label}</strong><span>{value}%</span></div>
                    <progress value={Number(value)} max="100" className={`progress-${tone}`} />
                  </div>
                ))}
              </div>
            </article>

            <article className="panel">
              <div className="panel-heading">
                <h3>Total Visitors</h3>
                <span>Monthly</span>
              </div>
              <DonutChart value={83842} label="Total Visitors" />
              <div className="legend-list">
                <span><i className="dot-green" />Total Male <b>56%</b></span>
                <span><i className="dot-yellow" />Total Female <b>44%</b></span>
                <span><i className="dot-gray" />Total Children <b>24%</b></span>
              </div>
            </article>
          </section>
        </div>

        <aside className="dashboard-side">
          <article className="panel schedule-panel">
            <div className="panel-heading">
              <h3>Doctor's Schedule</h3>
              <span>See all ({demoDoctors.length})</span>
            </div>
            {demoDoctors.map((doctor) => (
              <div className="person-row" key={doctor.id}>
                <Avatar label={doctor.avatar} />
                <div>
                  <strong>{doctor.name}</strong>
                  <span>{doctor.specialtyName}</span>
                </div>
                <Badge tone={doctor.status}>{doctor.status}</Badge>
              </div>
            ))}
          </article>

          <article className="panel today-panel">
            <div className="panel-heading">
              <h3>Today Patient's</h3>
              <span>See all ({appointments.length})</span>
            </div>
            <div className="today-grid">
              {appointments.slice(0, 4).map((appointment) => (
                <div className="today-card" key={appointment.id}>
                  <strong>{formatTime(appointment.startTime)}</strong>
                  <span>{formatDate(appointment.appointmentDate)}</span>
                  <div>
                    <Avatar label={appointment.patientAvatar} size="sm" />
                    <p>{appointment.patientName}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="premium-panel">
            <div>
              <strong>Upgrade your plan</strong>
              <button type="button">Go Premium</button>
            </div>
            <span>UP</span>
          </article>
        </aside>
      </section>
    </>
  );
}

type MetricCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  trend: string;
  direction: 'up' | 'down';
  tone: 'green' | 'purple' | 'blue' | 'orange';
  chart: ReactNode;
};

function MetricCard({ icon, label, value, trend, direction, tone, chart }: MetricCardProps) {
  const TrendIcon = direction === 'up' ? TrendingUp : TrendingDown;

  return (
    <article className={`metric-card metric-${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
      <p className={direction}>
        <TrendIcon size={15} />
        {trend}
        <small>vs last month</small>
      </p>
      {chart}
    </article>
  );
}
