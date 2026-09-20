import type { ReactNode } from 'react';
import { CalendarDays, FileText, HeartPulse, ReceiptText, Stethoscope, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { StaffDashboard } from '../api/staffDashboard';
import { clinicToday } from '../api/staffDashboard';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime, shortId } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';
import { roleLabel } from '../utils/locale';
import type { AppView } from '../types/view';
import type { AppointmentResponse } from '../types/domain';

export type DashboardPageProps = {
  dashboard: DashboardResponse | null;
  staffDashboard?: StaffDashboard | null;
  user: CurrentUser;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate?: (view: AppView) => void;
};

export default function DashboardPage({ dashboard, staffDashboard, user, role, error, loading, onRefresh, onNavigate }: DashboardPageProps) {
  const isPatient = role === 'PATIENT';
  const appointments = isPatient && dashboard ? getUiAppointments(dashboard.appointments) : [];
  const todayKey = clinicToday();
  const todayAppointments = appointments.filter((item) => item.appointmentDate === todayKey && item.status !== 'CANCELLED');
  const upcoming = appointments.filter((item) => item.appointmentDate >= todayKey && !['CANCELLED', 'COMPLETED'].includes(item.status))
    .sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`));
  const unpaid = dashboard?.invoices.filter((item) => item.status === 'UNPAID') ?? [];

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName || user.email}`}
        subtitle={isPatient ? 'Cổng thông tin cá nhân · Lịch khám, bệnh án và hóa đơn của bạn.' : `${roleLabel(role)} · Hoạt động trong phạm vi tài khoản được cấp quyền.`}
        actions={<><span className="soft-button dashboard-date"><CalendarDays size={17} />{formatDate(clinicToday())}</span>
          {onNavigate && <button type="button" onClick={() => onNavigate('appointments')}>Xem lịch hẹn</button>}
          <button className="soft-button" type="button" onClick={onRefresh} disabled={loading}>Làm mới</button></>} />
      {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
      {loading && <p role="status">Đang tải dữ liệu tổng quan...</p>}
      {!isPatient && staffDashboard && !loading && !error && <StaffOverview data={staffDashboard} role={role} onNavigate={onNavigate} />}
      {!isPatient && !staffDashboard && !loading && !error && <Alert tone="info">Chưa tải được lịch khám. Hãy nhấn Làm mới để thử lại.</Alert>}
      {isPatient && !dashboard && !loading && !error && <Alert tone="info">Chưa tải được dữ liệu cá nhân. Hãy nhấn Làm mới để thử lại.</Alert>}
      {isPatient && dashboard && (
        <>
          <section className="patient-preview-hero" aria-label="Lịch khám sắp tới của bạn">
            <div><span className="hero-kicker"><span className="status-dot" /> THÔNG TIN CÁ NHÂN · DỮ LIỆU THỰC</span>
              <h3>{upcoming.length ? `Bạn có ${upcoming.length} lịch khám sắp tới` : 'Bạn chưa có lịch khám sắp tới'}</h3>
              <p>{upcoming.length ? `Lịch gần nhất: ${formatDate(upcoming[0].appointmentDate)} lúc ${formatTime(upcoming[0].startTime)}.` : 'Lịch khám của bạn sẽ xuất hiện ở đây khi được tạo.'}</p>
            </div><CalendarDays size={65} strokeWidth={1.4} aria-hidden="true" />
          </section>
          <section className="overview-grid" aria-label="Thống kê cá nhân">
            <MetricCard icon={<CalendarDays />} label="Lịch khám của tôi" value={appointments.length} tone="green" />
            <MetricCard icon={<UsersRound />} label="Lịch khám sắp tới" value={upcoming.length} tone="purple" />
            <MetricCard icon={<FileText />} label="Hồ sơ bệnh án của tôi" value={dashboard.medicalRecords.length} tone="blue" />
            <MetricCard icon={<ReceiptText />} label="Hóa đơn chưa thanh toán" value={unpaid.length} tone="orange" />
          </section>
          <section className="patient-preview-layout" aria-label="Thông tin bệnh nhân">
            <article className="panel"><div className="panel-heading"><h3>Lịch hẹn của tôi</h3><span>{appointments.length} lịch</span></div>
              {appointments.length === 0 ? <p>Chưa có lịch hẹn.</p> : <div className="patient-preview-list">{appointments.map((item) => (
                <div className="patient-preview-row" key={item.id}>
                  <span className="patient-preview-date"><strong>{formatDate(item.appointmentDate)}</strong><small>{formatTime(item.startTime)}</small></span>
                  <span><strong>{item.doctorName}</strong><small>{item.reason || `Mã lịch: ${item.id}`}</small></span>
                  <Badge tone={item.status}>{item.status}</Badge>
                </div>
              ))}</div>}
            </article>
            <div className="patient-preview-side">
              <article className="panel"><div className="panel-heading"><h3>Hồ sơ sức khỏe</h3><span>{dashboard.medicalRecords.length} hồ sơ</span></div>
                <p className="patient-preview-copy">{dashboard.medicalRecords.length ? 'Hồ sơ bệnh án của bạn đã có trong hệ thống.' : 'Chưa có hồ sơ bệnh án.'}</p>
              </article>
              <article className="panel"><div className="panel-heading"><h3>Hóa đơn của tôi</h3><span>{dashboard.invoices.length} hóa đơn</span></div>
                <p className="patient-preview-copy">{dashboard.invoices.length ? `${unpaid.length} hóa đơn chưa thanh toán.` : 'Chưa có hóa đơn.'}</p>
              </article>
              <article className="panel today-panel"><div className="panel-heading"><h3>Lịch khám hôm nay</h3><span>{todayAppointments.length}</span></div>
                {todayAppointments.length === 0 ? <p>Hôm nay chưa có lịch khám.</p> : <div className="today-grid">{todayAppointments.map((item) => (
                  <div className="today-card" key={item.id}><strong>{formatTime(item.startTime)}</strong><span>{formatDate(item.appointmentDate)}</span>
                    <div><Avatar label={item.doctorAvatar} size="sm" /><p>{item.doctorName}</p></div><Badge tone={item.status}>{item.status}</Badge>
                  </div>
                ))}</div>}
              </article>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function StaffOverview({ data, role, onNavigate }: { data: StaffDashboard; role: ClinicRole; onNavigate?: (view: AppView) => void }) {
  const queue = data.queue;
  const waiting = queue.filter((visit) => visit.status === 'WAITING' || visit.status === 'CALLED').length;
  const inProgress = queue.filter((visit) => visit.status === 'IN_PROGRESS').length;
  const completed = queue.filter((visit) => visit.status === 'COMPLETED').length;
  const isDoctor = role === 'DOCTOR';
  // Defense in depth: an unexpected staff scope must never be rendered under
  // a different role, even if a previous session's state survived a refresh.
  if ((isDoctor && data.scope !== 'DOCTOR') || (!isDoctor && data.scope !== 'RECEPTION') || role === 'PATIENT') {
    return <Alert tone="error">Phạm vi dashboard không khớp với tài khoản. Vui lòng làm mới.</Alert>;
  }
  // These rows come only from the role-authorized endpoints. Never use demo charts,
  // clinic-wide revenue, or patient records to fill missing dashboard metrics.
  const appointments: AppointmentResponse[] = data.scope === 'RECEPTION' ? data.appointments : [];
  const activities = data.scope === 'RECEPTION'
    ? appointments.map((item) => ({ time: item.startTime, status: item.status }))
    : queue.map((item) => ({ time: item.checkedInAt, status: item.status }));
  const chartStatuses = data.scope === 'RECEPTION'
    ? ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']
    : ['WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];
  const history = data.history?.scope === data.scope && data.history.to === data.date ? data.history : null;
  const days = history?.days ?? [];
  const historyTotal = (key: 'appointments' | 'checkIns' | 'completedVisits' | 'cancelledAppointments') =>
    days.reduce((sum, day) => sum + day[key], 0);
  const doctors = [...new Set(appointments.map((item) => item.doctorId))];
  const todayMetrics = data.scope === 'RECEPTION' ? [
    { label: 'Lịch hẹn hôm nay', value: appointments.length, icon: <CalendarDays />, tone: 'green', statuses: chartStatuses },
    { label: 'Lượt đã check-in', value: queue.length, icon: <UsersRound />, tone: 'purple', statuses: [] },
    { label: 'Đang chờ hoặc đã gọi', value: waiting, icon: <Stethoscope />, tone: 'blue', statuses: ['WAITING', 'CALLED'] },
    { label: 'Lượt khám hoàn thành', value: completed, icon: <HeartPulse />, tone: 'orange', statuses: ['COMPLETED'] }
  ] : [
    { label: 'Lượt check-in của tôi', value: queue.length, icon: <CalendarDays />, tone: 'green', statuses: [] },
    { label: 'Đang chờ hoặc đã gọi', value: waiting, icon: <UsersRound />, tone: 'purple', statuses: ['WAITING', 'CALLED'] },
    { label: 'Đang khám', value: inProgress, icon: <Stethoscope />, tone: 'blue', statuses: ['IN_PROGRESS'] },
    { label: 'Lượt khám hoàn thành', value: completed, icon: <HeartPulse />, tone: 'orange', statuses: ['COMPLETED'] }
  ];
  const metrics = history ? (data.scope === 'RECEPTION' ? [
    { label: 'Lịch hẹn 30 ngày', value: historyTotal('appointments'), icon: <CalendarDays />, tone: 'green', statuses: [], dailyValues: days.map((day) => day.appointments) },
    { label: 'Lượt check-in 30 ngày', value: historyTotal('checkIns'), icon: <UsersRound />, tone: 'purple', statuses: [], dailyValues: days.map((day) => day.checkIns) },
    { label: 'Đã hoàn tất 30 ngày', value: historyTotal('completedVisits'), icon: <HeartPulse />, tone: 'blue', statuses: [], dailyValues: days.map((day) => day.completedVisits) },
    { label: 'Lịch hủy 30 ngày', value: historyTotal('cancelledAppointments'), icon: <FileText />, tone: 'orange', statuses: [], dailyValues: days.map((day) => day.cancelledAppointments) }
  ] : [
    { label: 'Lượt khám 30 ngày', value: historyTotal('checkIns'), icon: <CalendarDays />, tone: 'green', statuses: [], dailyValues: days.map((day) => day.checkIns) },
    { label: 'Hoàn tất 30 ngày', value: historyTotal('completedVisits'), icon: <HeartPulse />, tone: 'purple', statuses: [], dailyValues: days.map((day) => day.completedVisits) }
  ]) : todayMetrics;
  const hours = Array.from({ length: 12 }, (_, index) => index + 7);
  const hourBuckets = hours.map((hour) => chartStatuses.map((status) => activities.filter((item) =>
    hourOf(item.time) === hour && item.status === status).length));
  const maxHour = Math.max(1, ...hourBuckets.map((counts) => counts.reduce((sum, count) => sum + count, 0)));

  return <section className="dashboard-layout clinic-preview-dashboard" aria-label="Dashboard theo giao diện UI UX pro max với dữ liệu thật">
    <div className="dashboard-main">
      <div className="dashboard-history-note" role="status">
        {history ? <>Thống kê 30 ngày: <strong>{formatDate(history.from)} – {formatDate(history.to)}</strong>.
          Thống kê có thể bao gồm dữ liệu thử nghiệm đã import; không dùng làm báo cáo y tế hoặc doanh thu.
          Mục bên phải chỉ hiển thị ngày {formatDate(data.date)}.</>
          : <>Chưa tải được báo cáo 30 ngày: {data.historyError || 'Dữ liệu lịch sử không hợp lệ'}.
            Các chỉ số dưới đây chỉ tính ngày {formatDate(data.date)}.</>}
      </div>
      <section className="metric-grid" aria-label="Chỉ số theo phạm vi được cấp quyền">
        {metrics.map((metric) => <LiveMetricCard key={metric.label} {...metric}
          activities={metric.label === 'Lượt đã check-in' || metric.label === 'Đang chờ hoặc đã gọi' || metric.label === 'Lượt khám hoàn thành'
            ? queue.map((item) => ({ time: item.checkedInAt, status: item.status })) : activities} />)}
      </section>
      <section className="analytics-grid" aria-label="Hoạt động trong ngày">
        <article className="panel patient-status live-status-panel">
          <div className="panel-heading"><div><h3>{history ? 'Hoạt động 30 ngày' : isDoctor ? 'Phân bổ lượt check-in' : 'Phân bổ lịch hẹn'}</h3>
            <strong>{(history ? historyTotal(data.scope === 'RECEPTION' ? 'appointments' : 'checkIns') : activities.length).toLocaleString('vi-VN')}</strong></div>
            <span>{history ? `${formatDate(history.from)} – ${formatDate(history.to)}` : `07–18 giờ · ${formatDate(data.date)}`} · API thật</span></div>
          {history ? (days.every((day) => day.appointments === 0 && day.checkIns === 0)
            ? <p className="dashboard-unavailable">Không có hoạt động trong 30 ngày này.</p>
            : <div className="live-month-chart" role="img" aria-label="Biểu đồ số lượt theo từng ngày trong 30 ngày">
              {days.map((day) => {
                const count = data.scope === 'RECEPTION' ? day.appointments : day.checkIns;
                const max = Math.max(1, ...days.map((entry) => data.scope === 'RECEPTION' ? entry.appointments : entry.checkIns));
                return <div className="live-month-column" key={day.date} title={`${formatDate(day.date)}: ${count} lượt`}>
                  <span style={{ height: `${count ? Math.max(5, count / max * 170) : 0}px` }} />
                  <small>{day.date.slice(8)}</small>
                </div>;
              })}
            </div>) : activities.length === 0 ? <p className="dashboard-unavailable">Chưa có dữ liệu để vẽ biểu đồ hôm nay.</p> : <>
            <div className="stacked-chart live-hourly-chart" role="img" aria-label={`Phân bố ${activities.length} lượt theo từng giờ trong ngày`}>
              {hours.map((hour, index) => <div className="live-hour-column" key={hour}>
                <div className="live-hour-stack" title={`${hour}:00 — ${hourBuckets[index].reduce((sum, count) => sum + count, 0)} lượt`}>
                  {hourBuckets[index].map((count, statusIndex) => <span key={chartStatuses[statusIndex]}
                    className={`live-segment live-segment-${chartStatuses[statusIndex].toLowerCase()}`}
                    style={{ height: `${count / maxHour * 150}px` }} />)}
                </div><small>{String(hour).padStart(2, '0')}h</small>
              </div>)}
            </div>
            <div className="live-chart-legend">{chartStatuses.map((status) => <span key={status}>
              <i className={`live-segment-${status.toLowerCase()}`} /><Badge tone={status}>{status}</Badge>
            </span>)}</div>
          </>}
        </article>
        <article className="panel live-detail-panel">
          <div className="panel-heading"><h3>{isDoctor ? 'Trạng thái lượt khám' : 'Trạng thái lịch hẹn'}</h3><span>Hôm nay</span></div>
          <div className="status-list">{chartStatuses.map((status) => {
            const count = activities.filter((item) => item.status === status).length;
            return <div className="status-item" key={status}>
              <div><Badge tone={status}>{status}</Badge><strong>{count}</strong></div>
              <progress className={`status-progress progress-${status.toLowerCase()}`} value={count} max={Math.max(activities.length, 1)} />
            </div>;
          })}</div>
        </article>
      </section>
      <article className="panel live-appointments-panel">
        <div className="panel-heading"><h3>{isDoctor ? 'Hàng đợi của bác sĩ hôm nay' : 'Lịch hẹn hôm nay'}</h3><span>{isDoctor ? queue.length : appointments.length} lượt</span></div>
        {data.scope === 'RECEPTION'
          ? (appointments.length === 0 ? <p className="dashboard-unavailable">Hôm nay chưa có lịch hẹn.</p>
            : <div className="activity-list">{appointments.slice(0, 6).map((item) => <div className="activity-row" key={item.id}>
              <span className="activity-icon"><CalendarDays size={20} aria-hidden="true" /></span>
              <div><strong>{formatTime(item.startTime)} · {item.id}</strong><span>Mã bác sĩ: {shortId(item.doctorId)}</span></div>
              <span className="activity-end"><Badge tone={item.status}>{item.status}</Badge></span>
            </div>)}</div>)
          : (queue.length === 0 ? <p className="dashboard-unavailable">Chưa có lượt check-in hôm nay.</p>
            : <div className="activity-list">{queue.slice(0, 6).map((item) => <div className="activity-row" key={item.id}>
              <span className="activity-icon"><UsersRound size={20} aria-hidden="true" /></span>
              <div><strong>Số thứ tự #{item.queueNumber}</strong><span>Mã lịch hẹn: {item.appointmentId}</span></div>
              <span className="activity-end"><Badge tone={item.status}>{item.status}</Badge></span>
            </div>)}</div>)}
        {onNavigate && <button type="button" className="outline-action" onClick={() => onNavigate('appointments')}>Xem danh sách lịch hẹn</button>}
      </article>
      {data.scope === 'RECEPTION' && <article className="panel live-appointments-panel">
        <div className="panel-heading"><h3>Hàng đợi hôm nay</h3><span>{queue.length} lượt</span></div>
        {queue.length === 0 ? <p className="dashboard-unavailable">Chưa có lượt check-in hôm nay.</p>
          : <div className="activity-list">{queue.slice(0, 6).map((item) => <div className="activity-row" key={item.id}>
            <span className="activity-icon"><UsersRound size={20} aria-hidden="true" /></span>
            <div><strong>Số thứ tự #{item.queueNumber}</strong><span>Mã lịch hẹn: {item.appointmentId}</span></div>
            <span className="activity-end"><Badge tone={item.status}>{item.status}</Badge></span>
          </div>)}</div>}
      </article>}
    </div>
    <aside className="dashboard-side">
      <article className="panel schedule-panel">
        <div className="panel-heading"><h3>{isDoctor ? 'Hàng đợi được phân công' : 'Lịch bác sĩ'}</h3>
          <span>{isDoctor ? `${queue.length} lượt` : `${doctors.length} bác sĩ`}</span></div>
        {data.scope === 'RECEPTION'
          ? (doctors.length ? doctors.slice(0, 5).map((doctorId) => <div className="person-row" key={doctorId}>
              <Avatar label={shortId(doctorId)} /><div><strong>Mã bác sĩ {shortId(doctorId)}</strong>
                <span>{appointments.filter((item) => item.doctorId === doctorId).length} lịch hẹn hôm nay</span></div>
            </div>) : <p className="dashboard-unavailable">Chưa có lịch bác sĩ hôm nay.</p>)
          : (queue.length ? queue.slice(0, 5).map((item) => <div className="person-row" key={item.id}>
              <Avatar label={String(item.queueNumber)} /><div><strong>Số thứ tự #{item.queueNumber}</strong>
                <span>{shortId(item.appointmentId)}</span></div><Badge tone={item.status}>{item.status}</Badge>
            </div>) : <p className="dashboard-unavailable">Chưa có lượt khám được phân công.</p>)}
      </article>
      <article className="panel today-panel">
        <div className="panel-heading"><h3>{isDoctor ? 'Lượt khám hôm nay' : 'Bệnh nhân có lịch hôm nay'}</h3>
          <span>{isDoctor ? queue.length : appointments.length} lượt</span></div>
        {data.scope === 'RECEPTION'
          ? (appointments.length ? <div className="today-grid">{appointments.slice(0, 4).map((item) => <div className="today-card" key={item.id}>
              <strong>{formatTime(item.startTime)}</strong><span>{formatDate(item.appointmentDate)}</span>
              <div><Avatar label={shortId(item.patientId)} size="sm" /><p>Mã BN: {shortId(item.patientId)}</p></div>
              <Badge tone={item.status}>{item.status}</Badge>
            </div>)}</div> : <p className="dashboard-unavailable">Hôm nay chưa có lịch khám.</p>)
          : (queue.length ? <div className="today-grid">{queue.slice(0, 4).map((item) => <div className="today-card" key={item.id}>
              <strong>#{item.queueNumber}</strong><span>{formatTime(item.checkedInAt?.split('T')[1])}</span>
              <div><Avatar label={shortId(item.patientId)} size="sm" /><p>Mã BN: {shortId(item.patientId)}</p></div>
              <Badge tone={item.status}>{item.status}</Badge>
            </div>)}</div> : <p className="dashboard-unavailable">Chưa có lượt khám.</p>)}
      </article>
      <article className="premium-panel live-dashboard-tip">
        <div><strong>{isDoctor ? 'Không gian bác sĩ' : 'Quản lý phòng khám'}</strong>
          <p>Chỉ hiển thị dữ liệu được backend cấp quyền. Không dùng số liệu mẫu hoặc doanh thu chưa được xác minh.</p>
          {onNavigate && <button type="button" onClick={() => onNavigate('appointments')}>Mở danh sách lịch hẹn</button>}</div>
        <span aria-hidden="true">+</span>
      </article>
    </aside>
  </section>;
}

function hourOf(time?: string | null): number | null {
  if (!time) return null;
  const match = /(?:^|T)(\d{2}):\d{2}/.exec(time);
  return match ? Number(match[1]) : null;
}

function LiveMetricCard({ icon, label, value, tone, statuses, activities, dailyValues }: {
  icon: ReactNode; label: string; value: number; tone: string; statuses: string[];
  activities: Array<{ time: string | null; status: string }>;
  dailyValues?: number[];
}) {
  const values = dailyValues ?? Array.from({ length: 12 }, (_, index) => activities.filter((item) =>
    hourOf(item.time) === index + 7 && (statuses.length === 0 || statuses.includes(item.status))).length);
  const max = Math.max(1, ...values);
  const hasHourlyData = values.some((item) => item > 0);
  return <article className={`metric-card metric-${tone} live-metric-card`}>
    <div className="metric-icon">{icon}</div>
    <div><strong>{value.toLocaleString('vi-VN')}</strong><span>{label}</span></div>
    <p className="metric-availability">{dailyValues ? 'Tổng hợp theo ngày · 30 ngày' : 'Theo dữ liệu hôm nay · 07–18h'}</p>
    {hasHourlyData ? <div className={`mini-bars mini-bars-${tone} live-metric-bars`} role="img" aria-label={`Phân bổ ${dailyValues ? 'theo ngày' : 'theo giờ'} của ${label}`}>
      {values.map((count, index) => <span key={index} title={`${dailyValues ? `Ngày ${index + 1}` : `${index + 7}:00`} — ${count} lượt`}
        style={{ height: `${count === 0 ? 0 : 12 + (count / max) * 48}px` }} />)}
    </div> : <span className="metric-chart-unavailable">Chưa có lượt trong phạm vi dữ liệu.</span>}
  </article>;
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <article className={`summary-card summary-${tone}`}><span className="summary-icon">{icon}</span><span className="summary-label">{label}</span>
    <strong>{value.toLocaleString('vi-VN')}</strong><span className="summary-hint">Theo dữ liệu API đã tải</span></article>;
}
