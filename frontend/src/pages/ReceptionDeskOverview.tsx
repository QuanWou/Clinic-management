import { ArrowRight, CalendarCheck2, CalendarDays, ClipboardCheck, Clock3, ShieldCheck, UserRoundCheck } from 'lucide-react';
import type { AppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';

type Props = {
  date: string;
  today: string;
  appointments: AppointmentResponse[];
  queue: ReceptionVisitResponse[];
  onSelect: (appointmentId: string) => void;
  onBooking: () => void;
};

/** Reception worklist is derived only from the selected day's staff-authorized APIs. */
export default function ReceptionDeskOverview({ date, today, appointments, queue, onSelect, onBooking }: Props) {
  const todayView = date === today;
  const bookings = appointments.filter((item) => item.appointmentDate === date);
  const visits = queue.filter((visit) => visit.visitDate === date);
  const checkedIn = new Set(visits.map((visit) => visit.appointmentId));
  const pending = bookings.filter((item) => item.status === 'PENDING' && !checkedIn.has(item.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const arriving = bookings.filter((item) => item.status === 'CONFIRMED' && !checkedIn.has(item.id))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const waiting = visits.filter((visit) => visit.status === 'WAITING' || visit.status === 'CALLED').length;

  return <section className="reception-desk" aria-label="Bàn tiếp đón lễ tân">
    <div className="reception-desk-hero">
      <div className="reception-desk-intro">
        <span className="reception-desk-kicker"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN LỄ TÂN · TIẾP ĐÓN</span>
        <h3>Điều phối lịch khám trong ngày</h3>
        <p>Kiểm tra lịch chờ xác nhận, tiếp nhận bệnh nhân đến khám và theo dõi hàng đợi. Chỉ hiển thị dữ liệu của ngày đã chọn.</p>
        <div className="reception-desk-tags"><span><CalendarDays size={15} aria-hidden="true" /> {formatDate(date)}</span><span><ClipboardCheck size={15} aria-hidden="true" /> {bookings.length} lịch hẹn</span></div>
      </div>
      <button type="button" className="reception-desk-new" onClick={onBooking}>Đặt lịch cho bệnh nhân <ArrowRight size={17} aria-hidden="true" /></button>
    </div>

    <div className="reception-desk-kpis" aria-label="Công việc lễ tân theo ngày">
      <article><span className="reception-desk-kpi-icon amber"><Clock3 size={20} aria-hidden="true" /></span><strong>{pending.length}</strong><h4>Chờ xác nhận</h4><p>Lịch cần kiểm tra</p></article>
      <article><span className="reception-desk-kpi-icon blue"><UserRoundCheck size={20} aria-hidden="true" /></span><strong>{arriving.length}</strong><h4>Chưa check-in</h4><p>Lịch đã xác nhận</p></article>
      <article><span className="reception-desk-kpi-icon teal"><CalendarCheck2 size={20} aria-hidden="true" /></span><strong>{visits.length}</strong><h4>Đã tiếp nhận</h4><p>Lượt có mặt trong hàng đợi</p></article>
      <article><span className="reception-desk-kpi-icon violet"><ClipboardCheck size={20} aria-hidden="true" /></span><strong>{waiting}</strong><h4>Đang chờ khám</h4><p>Bao gồm lượt đã gọi</p></article>
    </div>

    <div className="reception-desk-priorities">
      <article className="panel reception-desk-priority" aria-label="Lịch chờ xác nhận">
        <div className="reception-desk-priority-head"><div><span>CÔNG VIỆC ƯU TIÊN</span><h3>Lịch chờ xác nhận</h3><p>Mở chi tiết để xác nhận lịch hoặc liên hệ bệnh nhân.</p></div><strong>{pending.length}</strong></div>
        {pending.length === 0 && <p className="reception-desk-empty">Không có lịch chờ xác nhận trong ngày.</p>}
        {pending.slice(0, 4).map((item) => <button type="button" className="reception-desk-priority-row" key={item.id} onClick={() => onSelect(item.id)}>
          <span className="reception-desk-time">{formatTime(item.startTime)}</span><span><strong>BN #{shortId(item.patientId)}</strong><small>Lịch #{shortId(item.id)}</small></span><ArrowRight size={16} aria-hidden="true" />
        </button>)}
        {pending.length > 4 && <p className="reception-desk-more">Hiển thị 4/{pending.length} lịch; xem toàn bộ trong bảng lịch hẹn.</p>}
      </article>
      <article className="panel reception-desk-priority" aria-label="Lịch sẵn sàng tiếp nhận">
        <div className="reception-desk-priority-head"><div><span>QUẦY TIẾP NHẬN</span><h3>Lịch đã xác nhận</h3><p>{todayView ? 'Chọn bệnh nhân đã có mặt để mở thao tác check-in.' : 'Chỉ có thể check-in cho lịch diễn ra hôm nay.'}</p></div><strong>{arriving.length}</strong></div>
        {arriving.length === 0 && <p className="reception-desk-empty">Không có lịch đã xác nhận đang chờ tiếp nhận.</p>}
        {arriving.slice(0, 4).map((item) => <button type="button" className="reception-desk-priority-row" key={item.id} onClick={() => onSelect(item.id)}>
          <span className="reception-desk-time">{formatTime(item.startTime)}</span><span><strong>BN #{shortId(item.patientId)}</strong><small>Lịch #{shortId(item.id)}</small></span><ArrowRight size={16} aria-hidden="true" />
        </button>)}
        {arriving.length > 4 && <p className="reception-desk-more">Hiển thị 4/{arriving.length} lịch; xem toàn bộ trong bảng lịch hẹn.</p>}
      </article>
    </div>
  </section>;
}