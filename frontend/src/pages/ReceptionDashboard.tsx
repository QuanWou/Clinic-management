import {
  ArrowRight, CalendarCheck2, CalendarDays, ClipboardCheck, Clock3,
  HeartPulse, Stethoscope, UserRoundCheck, UsersRound
} from 'lucide-react';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { StaffDashboard } from '../api/staffDashboard';
import type { AppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import type { AppView } from '../types/view';
import { integrations } from '../config/integrations.config';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './reception-dashboard.css';

type ReceptionData = Extract<StaffDashboard, { scope: 'RECEPTION' }>;
type Props = { data: StaffDashboard; onNavigate?: (view: AppView) => void };

const appointmentStatuses = [
  { status: 'PENDING', label: 'Chờ xác nhận', tone: 'amber' },
  { status: 'CONFIRMED', label: 'Đã xác nhận', tone: 'teal' },
  { status: 'COMPLETED', label: 'Đã hoàn thành', tone: 'blue' },
  { status: 'CANCELLED', label: 'Đã hủy', tone: 'red' }
] as const;
const queuePriority: Record<ReceptionVisitResponse['status'], number> = {
  WAITING: 0, CALLED: 1, IN_PROGRESS: 2, COMPLETED: 3, SKIPPED: 4
};

/** Show only date-scoped, role-authorized data. Never substitute patient or doctor data. */
export default function ReceptionDashboard({ data, onNavigate }: Props) {
  if (data.scope !== 'RECEPTION') {
    return <Alert tone="error">Phạm vi dashboard không khớp với tài khoản lễ tân. Vui lòng làm mới.</Alert>;
  }
  if (!Array.isArray(data.appointments) || !Array.isArray(data.queue)
    || data.appointments.some((item) => item.appointmentDate !== data.date)
    || data.queue.some((item) => item.visitDate !== data.date)) {
    return <Alert tone="error">Dữ liệu lịch hẹn hoặc hàng đợi không khớp ngày tiếp nhận. Vui lòng làm mới.</Alert>;
  }
  return <ReceptionOverview data={data} onNavigate={onNavigate} />;
}

function ReceptionOverview({ data, onNavigate }: { data: ReceptionData; onNavigate?: (view: AppView) => void }) {
  const appointments = data.appointments;
  const queue = data.queue;
  const checkedInIds = new Set(queue.map((visit) => visit.appointmentId));
  const pending = appointments.filter((item) => item.status === 'PENDING' && !checkedInIds.has(item.id))
    .sort(byStartTime);
  const arriving = appointments.filter((item) => item.status === 'CONFIRMED' && !checkedInIds.has(item.id))
    .sort(byStartTime);
  const appointmentsToday = appointments.filter((item) => item.status !== 'CANCELLED').sort(byStartTime);
  const waiting = queue.filter((item) => item.status === 'WAITING' || item.status === 'CALLED').length;
  const queueToday = [...queue].sort((a, b) => queuePriority[a.status] - queuePriority[b.status] || a.queueNumber - b.queueNumber);
  const doctors = [...new Set(appointmentsToday.map((item) => item.doctorId))]
    .map((doctorId) => ({ id: doctorId, total: appointmentsToday.filter((item) => item.doctorId === doctorId).length }))
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  const history = data.history?.scope === 'RECEPTION' && data.history.to === data.date
    && Array.isArray(data.history.days) && data.history.days.length === 30 ? data.history : null;
  const days = history?.days ?? [];
  const historyBookings = days.reduce((sum, day) => sum + day.appointments, 0);
  const historyCheckins = days.reduce((sum, day) => sum + day.checkIns, 0);
  const chartMax = Math.max(1, ...days.map((day) => Math.max(day.appointments, day.checkIns)));
  const metrics = [
    { label: 'Lịch hẹn hôm nay', value: appointments.length, detail: `${pending.length} lịch cần xác nhận`, icon: CalendarDays, tone: 'teal' },
    { label: 'Chờ xác nhận', value: pending.length, detail: 'Chưa được tiếp nhận', icon: Clock3, tone: 'amber' },
    { label: 'Chờ check-in', value: arriving.length, detail: 'Lịch đã xác nhận', icon: UserRoundCheck, tone: 'blue' },
    { label: 'Đã tiếp nhận', value: queue.length, detail: `${waiting} lượt đang chờ hoặc đã gọi`, icon: ClipboardCheck, tone: 'violet' }
  ] as const;

  return <div className="reception-dashboard" aria-label="Dashboard tiếp đón lễ tân">
    <section className="reception-dashboard-hero" aria-label="Tổng quan quầy lễ tân">
      <div className="reception-dashboard-hero-copy">
        <span className="reception-dashboard-eyebrow"><HeartPulse size={15} aria-hidden="true" /> KHÔNG GIAN LỄ TÂN · DỮ LIỆU NGÀY KHÁM</span>
        <h3>Trung tâm tiếp đón bệnh nhân</h3>
        <p>Theo dõi lịch cần xác nhận, bệnh nhân sắp đến và hàng đợi khám từ dữ liệu được API cấp quyền.</p>
        <div className="reception-dashboard-hero-tags"><span><CalendarDays size={15} aria-hidden="true" /> {formatDate(data.date)}</span>
          <span><CalendarCheck2 size={15} aria-hidden="true" /> {appointmentsToday.length} lịch chưa hủy</span></div>
      </div>
      {onNavigate && <button type="button" className="reception-dashboard-hero-action" onClick={() => onNavigate('appointments')}>
        Mở bàn tiếp đón <ArrowRight size={17} aria-hidden="true" />
      </button>}
    </section>

    <section className="reception-dashboard-metrics" aria-label="Chỉ số tiếp nhận hôm nay">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => <article className={`reception-dashboard-metric reception-dashboard-metric-${tone}`} key={label}>
        <div className="reception-dashboard-metric-top"><span className="reception-dashboard-metric-icon"><Icon size={21} aria-hidden="true" /></span><small>HÔM NAY</small></div>
        <strong>{value.toLocaleString('vi-VN')}</strong><h4>{label}</h4><p>{detail}</p>
      </article>)}
    </section>

    <section className="reception-dashboard-work" aria-label="Công việc cần xử lý tại quầy">
      <article className="panel reception-dashboard-worklist">
        <div className="reception-dashboard-heading"><div><span className="reception-dashboard-kicker">ƯU TIÊN TẠI QUẦY</span><h3>Việc cần xử lý</h3>
          <p>Các lịch chưa check-in, sắp xếp theo giờ khám.</p></div><span className="reception-dashboard-count">{pending.length + arriving.length} lịch</span></div>
        {pending.length === 0 && arriving.length === 0
          ? <div className="reception-dashboard-empty" role="status"><CalendarCheck2 size={27} aria-hidden="true" />
            <strong>Không có lịch đang chờ tiếp nhận</strong><p>Chưa có lịch chờ xác nhận hoặc chờ check-in trong ngày.</p></div>
          : <div className="reception-dashboard-priorities">
            {pending.slice(0, 3).map((item) => <PriorityRow key={item.id} appointment={item} stage="Cần xác nhận" />)}
            {arriving.slice(0, 3).map((item) => <PriorityRow key={item.id} appointment={item} stage="Chờ check-in" />)}
          </div>}
        {(pending.length > 3 || arriving.length > 3) && <p className="reception-dashboard-more">Đang hiển thị tối đa 3 lịch mỗi nhóm. Mở Lịch hẹn để xem đầy đủ.</p>}
        {onNavigate && <button type="button" className="reception-dashboard-panel-action" onClick={() => onNavigate('appointments')}>
          Xử lý tại trang Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>}
      </article>
      <article className="panel reception-dashboard-queue">
        <div className="reception-dashboard-heading"><div><span className="reception-dashboard-kicker">TIẾN ĐỘ KHÁM</span><h3>Hàng đợi hôm nay</h3>
          <p>Chỉ bao gồm lượt đã check-in.</p></div><span className="reception-dashboard-count">{queue.length} lượt</span></div>
        {queueToday.length === 0 ? <div className="reception-dashboard-empty"><UsersRound size={27} aria-hidden="true" /><strong>Chưa có lượt check-in hôm nay</strong>
          <p>Hàng đợi sẽ xuất hiện sau khi tiếp nhận bệnh nhân.</p></div>
          : <div className="reception-dashboard-queue-list">{queueToday.slice(0, 5).map((visit) => <div className="reception-dashboard-queue-row" key={visit.id}>
            <span className="reception-dashboard-ticket">#{visit.queueNumber}</span>
            <div><strong>Bệnh nhân {shortId(visit.patientId)}</strong><small>Mã lịch {shortId(visit.appointmentId)} · BS {shortId(visit.doctorId)}</small></div>
            <Badge tone={visit.status}>{statusLabel(visit.status)}</Badge>
          </div>)}</div>}
        {queue.length > 5 && <p className="reception-dashboard-more">Đang hiển thị 5/{queue.length} lượt.</p>}
        <p className="reception-dashboard-permission">Lễ tân không tự hoàn tất khám; thao tác chuyển trạng thái thực hiện theo quyền trên trang Lịch hẹn.</p>
      </article>
    </section>

    <section className="reception-dashboard-bottom" aria-label="Lịch sử và thông tin điều phối">
      <article className="panel reception-dashboard-history">
        <div className="reception-dashboard-heading"><div><span className="reception-dashboard-kicker">HOẠT ĐỘNG GẦN ĐÂY</span><h3>Xu hướng tiếp nhận 30 ngày</h3>
          <p>{history ? `${formatDate(history.from)} – ${formatDate(history.to)}` : 'Báo cáo lịch sử chưa được xác minh'}</p></div>
          {history && <span className="reception-dashboard-count">Dữ liệu API</span>}</div>
        {history ? <><div className="reception-dashboard-chart-summary"><span><i className="reception-dashboard-dot bookings" /> Lịch hẹn <strong>{historyBookings.toLocaleString('vi-VN')}</strong></span>
          <span><i className="reception-dashboard-dot checkins" /> Check-in <strong>{historyCheckins.toLocaleString('vi-VN')}</strong></span></div>
          {days.every((day) => day.appointments === 0 && day.checkIns === 0)
            ? <div className="reception-dashboard-empty">Chưa có hoạt động ghi nhận trong 30 ngày này.</div>
            : <div className="reception-dashboard-chart-scroll" tabIndex={0} aria-label="Biểu đồ lịch hẹn và check-in 30 ngày, cuộn ngang để xem toàn bộ">
              <div className="reception-dashboard-chart" role="img" aria-label={`Từ ${formatDate(history.from)} đến ${formatDate(history.to)}: ${historyBookings} lịch hẹn, ${historyCheckins} check-in`}>
                {days.map((day, index) => <div className="reception-dashboard-chart-day" key={day.date} title={`${formatDate(day.date)}: ${day.appointments} lịch, ${day.checkIns} check-in`}>
                  <div className="reception-dashboard-chart-bars" aria-hidden="true"><span className="bookings" style={{ height: `${day.appointments ? Math.max(3, day.appointments / chartMax * 100) : 0}%` }} />
                    <span className="checkins" style={{ height: `${day.checkIns ? Math.max(3, day.checkIns / chartMax * 100) : 0}%` }} /></div>
                  <small>{index % 5 === 0 || index === days.length - 1 ? day.date.slice(8) : ''}</small>
                </div>)}</div></div>}
          <p className="reception-dashboard-note">Thống kê lấy từ API; có thể bao gồm dữ liệu thử nghiệm đã nhập. Không dùng làm báo cáo doanh thu.</p></>
          : <div className="reception-dashboard-empty" role="status"><Clock3 size={24} aria-hidden="true" />
            <strong>Báo cáo 30 ngày chưa khả dụng</strong><p>{data.historyError || 'Không có dữ liệu lịch sử được xác minh.'} Chỉ số trong ngày phía trên vẫn được giữ nguyên.</p></div>}
      </article>
      <div className="reception-dashboard-side">
        <article className="panel reception-dashboard-doctors">
          <div className="reception-dashboard-heading"><div><span className="reception-dashboard-kicker">PHÂN BỔ CA KHÁM</span><h3>Bác sĩ có lịch hôm nay</h3>
            <p>Chỉ tính bác sĩ có lịch hẹn chưa hủy.</p></div><span className="reception-dashboard-count">{doctors.length}</span></div>
          {doctors.length ? doctors.slice(0, 4).map((doctor) => <div className="reception-dashboard-doctor-row" key={doctor.id}>
            <span><Stethoscope size={18} aria-hidden="true" /></span><div><strong>BS {shortId(doctor.id)}</strong><small>{doctor.total} lịch hẹn</small></div><b>{doctor.total}</b>
          </div>) : <p className="reception-dashboard-simple-empty">Chưa có lịch bác sĩ hôm nay.</p>}
          {onNavigate && <button className="reception-dashboard-panel-action" type="button" onClick={() => onNavigate('appointments')}>Xem phân bổ trong Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>}
        </article>
        <article className="reception-dashboard-shortcuts" aria-label="Truy cập nhanh cho lễ tân">
          <span className="reception-dashboard-kicker">CÔNG CỤ TIẾP ĐÓN</span><h3>Truy cập nhanh</h3><p>Chuyển đến nghiệp vụ đúng quyền tài khoản.</p>
          <div>{onNavigate && <><button type="button" onClick={() => onNavigate('appointments')}><CalendarDays size={18} aria-hidden="true" /> Lịch hẹn & check-in <ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigate('patients')}><UsersRound size={18} aria-hidden="true" /> Tìm bệnh nhân <ArrowRight size={16} aria-hidden="true" /></button>
            {integrations.billing && <button type="button" onClick={() => onNavigate('invoices')}><ClipboardCheck size={18} aria-hidden="true" /> Tra cứu hóa đơn <ArrowRight size={16} aria-hidden="true" /></button>}</>}</div>
        </article>
      </div>
    </section>
  </div>;
}

function byStartTime(a: AppointmentResponse, b: AppointmentResponse): number {
  return a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id);
}

function PriorityRow({ appointment, stage }: { appointment: AppointmentResponse; stage: string }) {
  return <div className="reception-dashboard-priority-row">
    <span className="reception-dashboard-priority-time">{formatTime(appointment.startTime)}</span>
    <div><strong>BN {shortId(appointment.patientId)}</strong><small>Lịch #{shortId(appointment.id)} · BS {shortId(appointment.doctorId)}</small></div>
    <span className="reception-dashboard-stage">{stage}</span>
  </div>;
}
