import { ArrowRight, CalendarCheck2, CalendarDays, ClipboardList, Clock3, HeartPulse, Stethoscope, UserRound, UsersRound } from 'lucide-react';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { StaffDashboard } from '../api/staffDashboard';
import type { ReceptionVisitResponse, QueueStatus } from '../types/domain';
import type { AppView } from '../types/view';
import { integrations } from '../config/integrations.config';
import { formatDate, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './doctor-dashboard.css';

type DoctorData = Extract<StaffDashboard, { scope: 'DOCTOR' }>;
type Props = { data: StaffDashboard; onNavigate?: (view: AppView) => void; onOpenEncounter?: (visit: ReceptionVisitResponse) => void };

const statuses: { code: QueueStatus; label: string; className: string }[] = [
  { code: 'WAITING', label: 'Đang chờ', className: 'waiting' },
  { code: 'CALLED', label: 'Đã gọi', className: 'called' },
  { code: 'IN_PROGRESS', label: 'Đang khám', className: 'progress' },
  { code: 'COMPLETED', label: 'Hoàn thành', className: 'completed' },
  { code: 'SKIPPED', label: 'Đã bỏ qua', className: 'skipped' }
];

const priority: Record<QueueStatus, number> = {
  IN_PROGRESS: 0, CALLED: 1, WAITING: 2, COMPLETED: 3, SKIPPED: 4
};

function checkInTime(value: string | null): string {
  // The queue API's LocalDateTime records clinic-local clock time.
  return value?.match(/T(\d{2}:\d{2})/)?.[1] ?? '--:--';
}

export default function DoctorDashboard({ data, onNavigate, onOpenEncounter }: Props) {
  // Do not show a receptionist's clinic-wide queue if state survives a role switch.
  if (data.scope !== 'DOCTOR') {
    return <Alert tone="error">Phạm vi dashboard không khớp với tài khoản bác sĩ. Vui lòng làm mới.</Alert>;
  }
  if (!Array.isArray(data.queue) || data.queue.some((visit) => visit.visitDate !== data.date)) {
    return <Alert tone="error">Hàng đợi không khớp ngày khám. Vui lòng làm mới.</Alert>;
  }
  return <DoctorOverview data={data} onNavigate={onNavigate} onOpenEncounter={onOpenEncounter} />;
}

function DoctorOverview({ data, onNavigate, onOpenEncounter }: { data: DoctorData; onNavigate?: (view: AppView) => void; onOpenEncounter?: (visit: ReceptionVisitResponse) => void }) {
  const queue = [...data.queue].sort((a, b) => priority[a.status] - priority[b.status] || a.queueNumber - b.queueNumber);
  const count = (status: QueueStatus) => queue.filter((visit) => visit.status === status).length;
  const waiting = count('WAITING') + count('CALLED');
  const working = count('IN_PROGRESS');
  const completed = count('COMPLETED');
  const next = queue.find((visit) => visit.status === 'IN_PROGRESS')
    ?? queue.find((visit) => visit.status === 'CALLED')
    ?? queue.find((visit) => visit.status === 'WAITING');
  const history = data.history?.scope === 'DOCTOR' && data.history.to === data.date && data.history.days.length === 30
    ? data.history : null;
  const checkIns = history?.days.reduce((sum, day) => sum + day.checkIns, 0) ?? 0;
  const completedHistory = history?.days.reduce((sum, day) => sum + day.completedVisits, 0) ?? 0;
  const maxDay = Math.max(1, ...(history?.days.map((day) => Math.max(day.checkIns, day.completedVisits)) ?? []));
  const cards = [
    { label: 'Lượt check-in của tôi', value: queue.length, note: 'Lượt khám đã tiếp nhận hôm nay', icon: UsersRound, color: 'teal' },
    { label: 'Đang chờ khám', value: waiting, note: `${count('CALLED')} lượt đã được gọi`, icon: Clock3, color: 'amber' },
    { label: 'Đang khám', value: working, note: 'Lượt đang thực hiện khám', icon: Stethoscope, color: 'blue' },
    { label: 'Đã hoàn thành', value: completed, note: 'Theo trạng thái hàng đợi', icon: CalendarCheck2, color: 'violet' }
  ] as const;

  return <div className="doctor-dashboard" aria-label="Tổng quan làm việc của bác sĩ">
    <section className="doctor-dashboard-hero" aria-label="Ca khám hôm nay">
      <div className="doctor-dashboard-hero-content">
        <span className="doctor-dashboard-eyebrow"><HeartPulse size={15} aria-hidden="true" /> KHÔNG GIAN BÁC SĨ · DỮ LIỆU CÁ NHÂN</span>
        <h3>Ca khám của bạn hôm nay</h3>
        <p>Tiến độ tiếp nhận và khám bệnh trong phạm vi được hệ thống phân công. Danh sách chỉ bao gồm bệnh nhân đã check-in.</p>
        <div className="doctor-dashboard-hero-tags"><span><CalendarDays size={15} aria-hidden="true" /> {formatDate(data.date)}</span>
          <span><ClipboardList size={15} aria-hidden="true" /> {queue.length} lượt trong hàng đợi</span></div>
      </div>
      {onNavigate && <button className="doctor-dashboard-hero-action" type="button" onClick={() => onNavigate('doctor-profile')}>
        Hồ sơ bác sĩ <ArrowRight size={17} aria-hidden="true" />
      </button>}
    </section>

    <section className="doctor-dashboard-metrics" aria-label="Chỉ số ca khám hôm nay">
      {cards.map(({ label, value, note, icon: Icon, color }) => <article className={`doctor-dashboard-metric doctor-dashboard-metric-${color}`} key={label}>
        <div className="doctor-dashboard-metric-top"><span className="doctor-dashboard-metric-icon"><Icon size={21} aria-hidden="true" /></span><span className="doctor-dashboard-period">HÔM NAY</span></div>
        <strong>{value.toLocaleString('vi-VN')}</strong><h4>{label}</h4><p>{note}</p>
      </article>)}
    </section>

    <section className="doctor-dashboard-insights" aria-label="Tiến độ khám và lịch sử">
      <article className="panel doctor-dashboard-chart-panel">
        <div className="doctor-dashboard-heading"><div><span className="doctor-dashboard-section-tag">PHÂN TÍCH CA KHÁM</span><h3>Hoạt động 30 ngày của tôi</h3>
          <p>{history ? `${formatDate(history.from)} – ${formatDate(history.to)}` : 'Chưa có báo cáo lịch sử được xác minh'}</p></div>
          {history && <span className="doctor-dashboard-source">Dữ liệu API</span>}
        </div>
        {history ? <>
          <div className="doctor-dashboard-chart-summary"><div><span className="doctor-dashboard-chart-dot checkins" /> Lượt check-in <strong>{checkIns.toLocaleString('vi-VN')}</strong></div>
            <div><span className="doctor-dashboard-chart-dot finished" /> Khám hoàn tất <strong>{completedHistory.toLocaleString('vi-VN')}</strong></div></div>
          {history.days.every((day) => day.checkIns === 0 && day.completedVisits === 0)
            ? <div className="doctor-dashboard-empty" role="status">Không có lượt khám được ghi nhận trong khoảng thời gian này.</div>
            : <div className="doctor-dashboard-chart-scroll" tabIndex={0} aria-label="Biểu đồ 30 ngày, cuộn ngang để xem toàn bộ">
              <div className="doctor-dashboard-chart" role="img" aria-label={`Từ ${formatDate(history.from)} đến ${formatDate(history.to)}: ${checkIns} lượt check-in và ${completedHistory} lượt khám hoàn tất`}>
                {history.days.map((day, index) => <div className="doctor-dashboard-chart-day" key={day.date} title={`${formatDate(day.date)}: ${day.checkIns} lượt check-in, ${day.completedVisits} hoàn tất`}>
                  <div className="doctor-dashboard-chart-bars" aria-hidden="true">
                    <span className="checkins" style={{ height: `${day.checkIns ? Math.max(3, day.checkIns / maxDay * 100) : 0}%` }} />
                    <span className="finished" style={{ height: `${day.completedVisits ? Math.max(3, day.completedVisits / maxDay * 100) : 0}%` }} />
                  </div><small>{index % 5 === 0 || index === history.days.length - 1 ? day.date.slice(8) : ''}</small>
                </div>)}
              </div>
            </div>}
          <p className="doctor-dashboard-data-note">Thống kê theo phạm vi bác sĩ được backend cấp quyền; có thể bao gồm dữ liệu thử nghiệm đã nhập.</p>
        </> : <div className="doctor-dashboard-empty" role="status">{data.historyError
          ? `Không tải được báo cáo 30 ngày: ${data.historyError}` : 'Báo cáo 30 ngày chưa khả dụng.'} Các chỉ số hôm nay vẫn lấy từ API hàng đợi.</div>}
      </article>

      <article className="panel doctor-dashboard-status-panel">
        <div className="doctor-dashboard-heading"><div><span className="doctor-dashboard-section-tag">TIẾN ĐỘ HÔM NAY</span><h3>Trạng thái lượt khám</h3><p>{queue.length} lượt · {formatDate(data.date)}</p></div></div>
        <div className="doctor-dashboard-status-list">{statuses.map(({ code, label, className }) => <div className="doctor-dashboard-status" key={code}>
          <div><span className={`doctor-dashboard-status-dot ${className}`} /><span>{label}</span><strong>{count(code)}</strong></div>
          <progress className={`doctor-dashboard-progress ${className}`} value={count(code)} max={Math.max(queue.length, 1)} aria-label={`${label}: ${count(code)} trên ${queue.length} lượt`} />
        </div>)}</div>
        <p className="doctor-dashboard-status-note"><HeartPulse size={18} aria-hidden="true" /> {waiting} lượt đang chờ hoặc đã gọi vào khám</p>
      </article>
    </section>

    <section className="doctor-dashboard-work" aria-label="Hàng đợi và công việc tiếp theo">
      <article className="panel doctor-dashboard-queue-panel">
        <div className="doctor-dashboard-heading"><div><span className="doctor-dashboard-section-tag">LỊCH KHÁM HÔM NAY</span><h3>Hàng đợi của bác sĩ hôm nay</h3><p>Sắp xếp theo trạng thái và số thứ tự, chỉ hiển thị lượt đã check-in.</p></div>
          <span className="doctor-dashboard-count">{queue.length} lượt</span></div>
        {queue.length ? <div className="doctor-dashboard-queue-list">{queue.slice(0, 6).map((visit) => <QueueRow key={visit.id} visit={visit} onOpenEncounter={onOpenEncounter} />)}</div>
          : <p className="doctor-dashboard-empty-queue">Chưa có lượt check-in hôm nay. Lịch chưa check-in không nằm trong danh sách này.</p>}
        {queue.length > 6 && <p className="doctor-dashboard-more">Đang hiển thị 6/{queue.length} lượt.{integrations.appointmentOwnership ? ' Mở danh sách để xem đầy đủ.' : ''}</p>}
        {onNavigate && integrations.appointmentOwnership && <button className="doctor-dashboard-list-action" type="button" onClick={() => onNavigate('appointments')}>
          Xem danh sách lịch hẹn <ArrowRight size={16} aria-hidden="true" />
        </button>}
        {!integrations.appointmentOwnership && <p className="doctor-dashboard-hint">Danh sách chi tiết đang chờ xác minh quyền truy cập của API lịch hẹn.</p>}
      </article>

      <div className="doctor-dashboard-work-side">
        <article className="panel doctor-dashboard-next-panel">
          <div className="doctor-dashboard-heading"><div><span className="doctor-dashboard-section-tag">THEO DÕI CA KHÁM</span><h3>Lượt cần chú ý</h3><p>Ưu tiên lượt đang khám hoặc đã gọi.</p></div></div>
          {next ? <div className="doctor-dashboard-next-visit"><span className="doctor-dashboard-next-number">#{next.queueNumber}</span>
            <div><strong>{next.patientName || `Bệnh nhân ${shortId(next.patientId)}`}</strong><span>Mã lịch {shortId(next.appointmentId)}</span>
              <small>Check-in: {checkInTime(next.checkedInAt)}</small></div><Badge tone={next.status}>{statusLabel(next.status)}</Badge></div>
            : <p className="doctor-dashboard-empty-queue">Hiện không có lượt đang khám hoặc chờ khám.</p>}
          {next?.status === 'WAITING' && <p className="doctor-dashboard-hint">Lượt này đang chờ lễ tân gọi trước khi bác sĩ bắt đầu khám.</p>}
          {next && onOpenEncounter && (next.status === 'CALLED' || next.status === 'IN_PROGRESS') && <button type="button" className="doctor-dashboard-list-action" onClick={() => onOpenEncounter(next)}>Mở không gian khám <ArrowRight size={16} /></button>}
        </article>
        <article className="doctor-dashboard-shortcuts" aria-label="Truy cập nhanh dành cho bác sĩ">
          <span className="doctor-dashboard-section-tag">TIẾP TỤC CÔNG VIỆC</span><h3>Truy cập nhanh</h3><p>Mở các chức năng theo quyền tài khoản.</p>
          {onNavigate && <div className="doctor-dashboard-shortcut-links">
            {integrations.appointmentOwnership && <button type="button" onClick={() => onNavigate('appointments')}><CalendarDays size={18} aria-hidden="true" /> Hàng đợi / Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>}
            <button type="button" onClick={() => onNavigate('medical-records')}><ClipboardList size={18} aria-hidden="true" /> Hồ sơ bệnh án <ArrowRight size={16} aria-hidden="true" /></button>
            <button type="button" onClick={() => onNavigate('doctor-profile')}><UserRound size={18} aria-hidden="true" /> Hồ sơ bác sĩ <ArrowRight size={16} aria-hidden="true" /></button>
          </div>}
        </article>
      </div>
    </section>
  </div>;
}

function QueueRow({ visit, onOpenEncounter }: { visit: ReceptionVisitResponse; onOpenEncounter?: (visit: ReceptionVisitResponse) => void }) {
  const canOpen = visit.status === 'CALLED' || visit.status === 'IN_PROGRESS';
  return <div className="doctor-dashboard-queue-row">
    <span className="doctor-dashboard-queue-number">#{visit.queueNumber}</span>
    <div className="doctor-dashboard-queue-info"><strong>{visit.patientName || `Bệnh nhân ${shortId(visit.patientId)}`}</strong>
      <span>Mã lịch {shortId(visit.appointmentId)} · Check-in {checkInTime(visit.checkedInAt)}</span></div>
    <Badge tone={visit.status}>{statusLabel(visit.status)}</Badge>
    {canOpen && onOpenEncounter && <button type="button" className="soft-button" onClick={() => onOpenEncounter(visit)}>Khám</button>}
  </div>;
}
