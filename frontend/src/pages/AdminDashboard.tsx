import { ArrowRight, CalendarCheck2, CalendarDays, ClipboardList, Clock3, HeartPulse, Stethoscope, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { StaffDashboard } from '../api/staffDashboard';
import type { AppView } from '../types/view';
import { formatDate, formatTime, shortId } from '../utils/format';

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
  const confirmed = appointments.filter((item) => item.status === 'CONFIRMED').length;
  const doctorLoads = [...new Set(appointments.map((item) => item.doctorId))]
    .map((id) => ({ id, total: appointments.filter((item) => item.doctorId === id).length }))
    .sort((a, b) => b.total - a.total);
  const history = data.history?.scope === 'RECEPTION' && data.history.to === data.date ? data.history : null;
  const days = history?.days ?? [];
  const totalBookings = days.reduce((sum, day) => sum + day.appointments, 0);
  const totalCheckIns = days.reduce((sum, day) => sum + day.checkIns, 0);
  const chartMax = Math.max(1, ...days.flatMap((day) => [day.appointments, day.checkIns]));
  const upcoming = [...appointments]
    .filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 5);
  const activeAppointments = appointments.filter((item) => item.status !== 'CANCELLED').length;

  const metrics = [
    { label: 'Lịch hẹn hôm nay', value: appointments.length, note: `${pending} lịch chờ xác nhận`, icon: CalendarDays, tone: 'teal' },
    { label: 'Đã tiếp nhận', value: queue.length, note: 'Lượt check-in hôm nay', icon: UsersRound, tone: 'blue' },
    { label: 'Đang chờ khám', value: awaiting, note: 'Bao gồm lượt đã gọi', icon: Clock3, tone: 'amber' },
    { label: 'Khám hoàn tất', value: completed, note: 'Theo trạng thái hàng đợi', icon: CalendarCheck2, tone: 'violet' }
  ] as const;

  return <div className="admin-overview" aria-label="Tổng quan quản trị phòng khám">
    <section className="admin-hero" aria-label="Trung tâm vận hành">
      <div className="admin-hero-copy">
        <span className="admin-kicker"><span className="status-dot" /> TRUNG TÂM VẬN HÀNH · QUẢN TRỊ</span>
        <h3>Tổng quan hoạt động phòng khám</h3>
        <p>Theo dõi lịch hẹn và tiến độ tiếp nhận từ dữ liệu được hệ thống cấp quyền.</p>
        <div className="admin-hero-chips">
          <span><CalendarDays size={15} aria-hidden="true" /> {formatDate(data.date)}</span>
          <span><ClipboardList size={15} aria-hidden="true" /> {confirmed} lịch đã xác nhận</span>
        </div>
      </div>
      {onNavigate && <button className="admin-hero-action" type="button" onClick={() => onNavigate('appointments')}>
        Quản lý lịch hẹn <ArrowRight size={17} aria-hidden="true" />
      </button>}
    </section>

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
            <p>{history ? `${formatDate(history.from)} – ${formatDate(history.to)}` : 'Chưa có thống kê lịch sử được xác minh'}</p></div>
          {history && <span className="admin-source-pill">Dữ liệu API</span>}
        </div>
        {history ? <>
          <div className="admin-chart-totals">
            <div><span className="admin-chart-key bookings" /> <span>Lịch hẹn</span><strong>{totalBookings.toLocaleString('vi-VN')}</strong></div>
            <div><span className="admin-chart-key checkins" /> <span>Check-in</span><strong>{totalCheckIns.toLocaleString('vi-VN')}</strong></div>
          </div>
          {days.every((day) => day.appointments === 0 && day.checkIns === 0)
            ? <div className="admin-chart-empty">Không có lượt đặt lịch hoặc check-in trong khoảng thời gian này.</div>
            : <div className="admin-chart-scroll" tabIndex={0} aria-label="Biểu đồ 30 ngày, có thể cuộn ngang trên màn hình nhỏ">
              <div className="admin-chart" role="img" aria-label={`Từ ${formatDate(history.from)} đến ${formatDate(history.to)}: ${totalBookings} lịch hẹn, ${totalCheckIns} lượt check-in`}>
                {days.map((day, index) => <div className="admin-chart-day" key={day.date} title={`${formatDate(day.date)}: ${day.appointments} lịch hẹn, ${day.checkIns} check-in`}>
                  <div className="admin-chart-bars" aria-hidden="true">
                    <span className="admin-bar-bookings" style={{ height: `${day.appointments ? Math.max(3, day.appointments / chartMax * 100) : 0}%` }} />
                    <span className="admin-bar-checkins" style={{ height: `${day.checkIns ? Math.max(3, day.checkIns / chartMax * 100) : 0}%` }} />
                  </div><small>{index % 5 === 0 || index === days.length - 1 ? day.date.slice(8) : ''}</small>
                </div>)}
              </div>
            </div>}
          <p className="admin-data-note">Số liệu phản ánh dữ liệu API, có thể bao gồm bản ghi thử nghiệm đã import; không dùng làm báo cáo y tế hoặc doanh thu.</p>
        </> : <div className="admin-chart-empty" role="status">{data.historyError ? `Không tải được báo cáo 30 ngày: ${data.historyError}` : 'Thống kê lịch sử chưa khả dụng.'} Các chỉ số hôm nay vẫn được hiển thị từ API.</div>}
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
          <div><span className="admin-section-kicker">ĐIỀU HƯỚNG NHANH</span><h3>Tiếp tục công việc</h3><p>Mở các chức năng theo quyền tài khoản.</p></div>
          <div className="admin-shortcut-buttons">
            {onNavigate && <><button type="button" onClick={() => onNavigate('appointments')}><CalendarDays size={18} aria-hidden="true" /> Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>
              <button type="button" onClick={() => onNavigate('patients')}><UsersRound size={18} aria-hidden="true" /> Bệnh nhân <ArrowRight size={16} aria-hidden="true" /></button></>}
          </div>
        </article>
      </div>
    </section>
  </div>;
}
