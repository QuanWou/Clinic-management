import type { ReactNode } from 'react';
import { CalendarDays, FileText, ReceiptText, Stethoscope, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DashboardResponse } from '../types/domain';
import type { StaffDashboard } from '../api/staffDashboard';
import { clinicToday } from '../api/staffDashboard';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatTime } from '../utils/format';
import { getUiAppointments } from '../utils/uiData';
import { roleLabel } from '../utils/locale';

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
  const todayKey = clinicToday();
  const todayAppointments = appointments.filter((item) => item.appointmentDate === todayKey && item.status !== 'CANCELLED');
  const upcoming = appointments.filter((item) => item.appointmentDate >= todayKey && !['CANCELLED', 'COMPLETED'].includes(item.status))
    .sort((a, b) => `${a.appointmentDate}${a.startTime}`.localeCompare(`${b.appointmentDate}${b.startTime}`));
  const unpaid = dashboard?.invoices.filter((item) => item.status === 'UNPAID') ?? [];

  return (
    <>
      <PageHeader title={`Xin chào, ${user.fullName || user.email}`}
        subtitle={isPatient ? 'Cổng thông tin cá nhân · Lịch khám, bệnh án và hóa đơn của bạn.' : `${roleLabel(role)} · Hoạt động trong phạm vi tài khoản được cấp quyền.`}
        actions={<button className="soft-button" type="button" onClick={onRefresh} disabled={loading}><CalendarDays size={17} />Làm mới</button>} />
      {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
      {loading && <p role="status">Đang tải dữ liệu tổng quan...</p>}
      {!isPatient && staffDashboard && !loading && !error && <StaffOverview data={staffDashboard} role={role} />}
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

function StaffOverview({ data, role }: { data: StaffDashboard; role: ClinicRole }) {
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
  return <>
    <section className="dashboard-hero" aria-label="Tổng quan hoạt động">
      <div><span className="hero-kicker"><span className="status-dot" /> {isDoctor ? 'LỊCH KHÁM CỦA BẠN' : 'HOẠT ĐỘNG TIẾP ĐÓN'} · DỮ LIỆU THỰC</span>
        <h3>{isDoctor ? 'Danh sách bệnh nhân đã check-in' : 'Tổng quan lịch khám hôm nay'}</h3>
        <p>{isDoctor ? 'Chỉ hiển thị hàng đợi khám được phân công cho tài khoản bác sĩ của bạn.' : 'Lịch hẹn và hàng đợi được lấy từ API dành cho quản trị viên hoặc lễ tân.'}</p>
      </div>
      <span className="hero-date"><CalendarDays size={23} aria-hidden="true" /><span>Ngày làm việc<strong>{formatDate(data.date)}</strong></span></span>
    </section>
    <section className="overview-grid" aria-label={isDoctor ? 'Tổng quan hàng đợi bác sĩ' : 'Tổng quan lịch hẹn và hàng đợi'}>
      {data.scope === 'RECEPTION'
        ? <MetricCard icon={<CalendarDays />} label="Lịch hẹn hôm nay" value={data.appointments.length} tone="green" />
        : <MetricCard icon={<Stethoscope />} label="Lượt check-in của tôi" value={queue.length} tone="green" />}
      <MetricCard icon={<UsersRound />} label="Đang chờ hoặc đã gọi" value={waiting} tone="purple" />
      <MetricCard icon={<Stethoscope />} label="Đang khám" value={inProgress} tone="blue" />
      <MetricCard icon={<FileText />} label="Lượt khám hoàn thành" value={completed} tone="orange" />
    </section>
    <section className="operations-grid" aria-label="Chi tiết hoạt động trong ngày">
      <div className="operations-main">
        <article className="panel operations-panel">
          <div className="panel-heading"><h3>{isDoctor ? 'Hàng đợi của bác sĩ hôm nay' : 'Hàng đợi hôm nay'}</h3><span>{queue.length} lượt</span></div>
          {queue.length === 0 ? <p className="dashboard-unavailable">Chưa có lượt check-in hôm nay.</p> : <div className="activity-list">{queue.map((visit) =>
            <div className="activity-row" key={visit.id}>
              <span className="activity-icon"><UsersRound size={20} aria-hidden="true" /></span>
              <div><strong>Số thứ tự #{visit.queueNumber}</strong><span>Mã lịch hẹn: {visit.appointmentId}</span></div>
              <span className="activity-end"><Badge tone={visit.status}>{visit.status}</Badge></span>
            </div>
          )}</div>}
        </article>
        {data.scope === 'RECEPTION' && <article className="panel operations-panel">
          <div className="panel-heading"><h3>Lịch hẹn hôm nay</h3><span>{data.appointments.length} lịch</span></div>
          {data.appointments.length === 0 ? <p className="dashboard-unavailable">Hôm nay chưa có lịch hẹn.</p> : <div className="activity-list">{data.appointments.map((appointment) =>
            <div className="activity-row" key={appointment.id}>
              <span className="activity-icon"><CalendarDays size={20} aria-hidden="true" /></span>
              <div><strong>{formatTime(appointment.startTime)} · {appointment.id}</strong><span>{formatDate(appointment.appointmentDate)}</span></div>
              <span className="activity-end"><Badge tone={appointment.status}>{appointment.status}</Badge></span>
            </div>
          )}</div>}
        </article>}
      </div>
      <aside className="operations-side">
        <article className="workspace-tip"><span className="section-kicker">PHẠM VI DỮ LIỆU</span>
          <h3>{isDoctor ? 'Không gian bác sĩ' : 'Không gian tiếp đón'}</h3>
          <p>{isDoctor ? 'Danh sách chỉ bao gồm lượt khám được backend xác thực là thuộc bác sĩ này. Không hiển thị lịch hẹn toàn phòng khám hoặc doanh thu.' : 'Các số liệu chỉ phản ánh lịch hẹn và lượt check-in của ngày đang xem. Không suy đoán doanh thu hay truy cập bệnh án.'}</p>
        </article>
      </aside>
    </section>
  </>;
}

function MetricCard({ icon, label, value, tone }: { icon: ReactNode; label: string; value: number; tone: string }) {
  return <article className={`summary-card summary-${tone}`}><span className="summary-icon">{icon}</span><span className="summary-label">{label}</span>
    <strong>{value.toLocaleString('vi-VN')}</strong><span className="summary-hint">Theo dữ liệu API đã tải</span></article>;
}
