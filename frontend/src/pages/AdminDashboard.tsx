import { ArrowRight, CalendarCheck2, CalendarDays, Clock3, HeartPulse, Stethoscope, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { StaffDashboard } from '../api/staffDashboard';
import type { AppView } from '../types/view';
import { formatDate, formatTime, shortId } from '../utils/format';
import AdminTrendChart from './AdminTrendChart';
import './admin-dashboard.css';

type ReceptionData = Extract<StaffDashboard, { scope: 'RECEPTION' }>;
type AdminDashboardProps = {
  data: StaffDashboard;
  onNavigate?: (view: AppView) => void;
};

const appointmentStatuses = [
  { value: 'PENDING', label: 'Chờ xác nhận' },
  { value: 'CONFIRMED', label: 'Đã xác nhận' },
  { value: 'COMPLETED', label: 'Đã hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' }
] as const;

export default function AdminDashboard({ data, onNavigate }: AdminDashboardProps) {
  // The admin overview must never display a doctor's scoped queue or data from
  // patient-only endpoints if stale state from another session is passed in.
  if (data.scope !== 'RECEPTION') {
    return <Alert tone="error">Phạm vi dashboard không khớp với tài khoản quản trị. Vui lòng làm mới.</Alert>;
  }
  return <AdminOverview data={data} onNavigate={onNavigate} />;
}

function AdminOverview({ data, onNavigate }: { data: ReceptionData; onNavigate?: (view: AppView) => void }) {
  const appointments = data.appointments;
  const queue = data.queue;
  const awaiting = queue.filter((item) => item.status === 'WAITING' || item.status === 'CALLED').length;
  const completed = queue.filter((item) => item.status === 'COMPLETED').length;
  const pending = appointments.filter((item) => item.status === 'PENDING').length;
  const doctorLoads = [...new Set(appointments.map((item) => item.doctorId))]
    .map((id) => ({ id, total: appointments.filter((item) => item.doctorId === id).length }))
    .sort((a, b) => b.total - a.total);
  const history = data.history?.scope === 'RECEPTION' && data.history.to === data.date ? data.history : null;
  const days = history?.days ?? [];
  const totalBookings = days.reduce((sum, day) => sum + day.appointments, 0);
  const totalCheckIns = days.reduce((sum, day) => sum + day.checkIns, 0);
  const upcoming = [...appointments]
    .filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 5);
  const activeAppointments = appointments.filter((item) => item.status !== 'CANCELLED').length;

  const metrics = [
    { label: 'Lịch hẹn', value: appointments.length, note: `${pending} chờ xác nhận`, icon: CalendarDays, tone: 'teal' },
    { label: 'Đã tiếp nhận', value: queue.length, note: 'Lượt check-in trong ngày', icon: UsersRound, tone: 'blue' },
    { label: 'Đang chờ khám', value: awaiting, note: 'Đang chờ hoặc đã gọi', icon: Clock3, tone: 'amber' },
    { label: 'Khám hoàn tất', value: completed, note: 'Lượt hoàn thành', icon: CalendarCheck2, tone: 'violet' }
  ] as const;

  return <div className="admin-overview" aria-label="Tổng quan quản trị phòng khám">
    <section className="admin-metrics" aria-label="Các chỉ số hôm nay">
      {metrics.map(({ label, value, note, icon: Icon, tone }) => <article className={`admin-metric admin-metric-${tone}`} key={label}>
        <div className="admin-metric-top"><span className="admin-metric-icon"><Icon size={21} strokeWidth={2} aria-hidden="true" /></span><span className="admin-metric-period">HÔM NAY</span></div>
        <strong>{value.toLocaleString('vi-VN')}</strong>
        <h4>{label}</h4>
        <p>{note}</p>
      </article>)}
    </section>

    <section className="admin-insights" aria-label="Phân tích hoạt động">
      <article className="panel admin-chart-panel">
        <div className="admin-section-heading">
          <div><span className="admin-section-kicker">THỐNG KÊ HOẠT ĐỘNG</span><h3>Xu hướng 30 ngày</h3>
            <p>{history ? `${formatDate(history.from)} – ${formatDate(history.to)}` : 'Chưa có thống kê trong khoảng thời gian này'}</p></div>
          {history && <span className="admin-source-pill">30 ngày</span>}
        </div>
        {history ? <>
        <div className="admin-chart-totals">
            <div><span className="admin-chart-key bookings" /> <span>Lịch hẹn</span><strong>{totalBookings.toLocaleString('vi-VN')}</strong></div>
            <div><span className="admin-chart-key checkins" /> <span>Check-in</span><strong>{totalCheckIns.toLocaleString('vi-VN')}</strong></div>
          </div>
          {days.every((day) => day.appointments === 0 && day.checkIns === 0)
            ? <div className="admin-chart-empty">Không có lượt đặt lịch hoặc check-in trong khoảng thời gian này.</div>
            : <AdminTrendChart days={days} from={history.from} to={history.to} />}
            <p className="admin-data-note">{days.every((day) => day.appointments === 0 && day.checkIns === 0)
              ? 'Số liệu được tổng hợp theo từng ngày; khoảng thời gian này không ghi nhận hoạt động.'
              : 'Mặc định so sánh tổng lượt theo từng nhóm 5 ngày. Chọn “Từng ngày” để xem chi tiết hoặc mở bảng số liệu đầy đủ.'}</p>
        </> : <div className="admin-chart-empty" role="status">{data.historyError ? `Không tải được báo cáo 30 ngày: ${data.historyError}` : 'Thống kê lịch sử chưa khả dụng.'} Các chỉ số hôm nay vẫn được hiển thị.</div>}
      </article>

      <article className="panel admin-status-panel">
        <div className="admin-section-heading"><div><span className="admin-section-kicker">THEO DÕI HÔM NAY</span><h3>Trạng thái lịch hẹn</h3><p>{appointments.length} lịch · {formatDate(data.date)}</p></div></div>
        <div className="admin-status-list">
          {appointmentStatuses.map(({ value, label }) => {
            const count = appointments.filter((item) => item.status === value).length;
            return <div className="admin-status-item" key={value}>
              <div><span className={`admin-status-dot admin-status-${value.toLowerCase()}`} /> <span>{label}</span><strong>{count}</strong></div>
              <progress className={`status-progress progress-${value.toLowerCase()}`} value={count} max={Math.max(appointments.length, 1)} aria-label={`${label}: ${count} trên ${appointments.length} lịch`} />
            </div>;
          })}
        </div>
        <div className="admin-status-footer"><HeartPulse size={18} aria-hidden="true" /><span>{awaiting} lượt đang chờ hoặc đã gọi vào khám</span></div>
      </article>
    </section>

    <section className="admin-operations" aria-label="Thông tin vận hành hôm nay">
      <article className="panel admin-appointments-panel">
        <div className="admin-section-heading"><div><span className="admin-section-kicker">LỊCH LÀM VIỆC</span><h3>Lịch hẹn trong ngày</h3><p>Các lịch chưa bị hủy, sắp xếp theo giờ</p></div>
          <span className="admin-count-pill">{activeAppointments} lịch</span></div>
        {upcoming.length ? <div className="admin-appointment-list">{upcoming.map((item) => <div className="admin-appointment" key={item.id}>
          <div className="admin-appointment-time"><strong>{formatTime(item.startTime)}</strong><span>{formatTime(item.endTime)}</span></div>
          <div className="admin-appointment-details"><strong>Lịch #{shortId(item.id)}</strong><span>BN {shortId(item.patientId)} · BS {shortId(item.doctorId)}</span></div>
          <Badge tone={item.status}>{appointmentStatuses.find(({ value }) => value === item.status)?.label ?? item.status}</Badge>
        </div>)}</div> : <p className="admin-empty-state">Hôm nay chưa có lịch hẹn đang hoạt động.</p>}
        {onNavigate && <button type="button" className="admin-list-action" onClick={() => onNavigate('appointments')}>Xem tất cả lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>}
      </article>

      <div className="admin-operations-side">
        <article className="panel admin-doctors-panel">
          <div className="admin-section-heading"><div><span className="admin-section-kicker">PHÂN BỔ LỊCH</span><h3>Bác sĩ có lịch hôm nay</h3><p>Chỉ tính bác sĩ có lịch hẹn trong ngày</p></div><span className="admin-count-pill">{doctorLoads.length}</span></div>
          {doctorLoads.length ? <div className="admin-doctor-list">{doctorLoads.slice(0, 4).map((doctor) => <div className="admin-doctor-row" key={doctor.id}>
            <span className="admin-doctor-avatar"><Stethoscope size={19} aria-hidden="true" /></span><div><strong>BS {shortId(doctor.id)}</strong><span>{doctor.total} lịch hẹn</span></div>
            <span className="admin-doctor-count">{doctor.total}</span>
          </div>)}</div> : <p className="admin-empty-state">Chưa có lịch bác sĩ trong ngày.</p>}
          {onNavigate && <button className="admin-list-action" type="button" onClick={() => onNavigate('doctors')}>Đến danh sách bác sĩ <ArrowRight size={16} aria-hidden="true" /></button>}
        </article>
        <article className="admin-shortcuts" aria-label="Truy cập nhanh">
          <div><span className="admin-section-kicker">ĐIỀU HƯỚNG NHANH</span><h3>Tiếp tục công việc</h3><p>Lịch hẹn và tìm bệnh nhân, mở ngay.</p></div>
          <div className="admin-shortcut-buttons">
            {onNavigate && <><button type="button" onClick={() => onNavigate('appointments')}><CalendarDays size={18} aria-hidden="true" /> Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => onNavigate('patients')}><UsersRound size={18} aria-hidden="true" /> Bệnh nhân <ArrowRight size={16} aria-hidden="true" /></button></>}
          </div>
        </article>
      </div>
    </section>
  </div>;
}
