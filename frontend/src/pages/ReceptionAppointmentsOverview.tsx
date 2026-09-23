import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Clock3, Search, Stethoscope, UsersRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/Badge';
import type { AppointmentResponse, DoctorProfileResponse, ReceptionAppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { doctorName as verifiedDoctorName } from '../utils/doctorNames';

type Props = {
  date: string;
  appointments: ReceptionAppointmentResponse[];
  queue: ReceptionVisitResponse[];
  doctors: DoctorProfileResponse[] | null;
  selectedId: string;
  onDateChange: (date: string) => void;
  onSelect: (id: string) => void;
};

type StatusFilter = 'ALL' | AppointmentResponse['status'] | ReceptionVisitResponse['status'];
const PAGE_SIZE = 10;
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

/** Calendar grid is only navigation. No monthly counts are inferred from daily API data. */
export function calendarDays(month: string): Array<string | null> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return [];
  const [year, part] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, part - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, part, 0)).getUTCDate();
  const cells = Array<string | null>(offset).fill(null);
  for (let day = 1; day <= length; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function appointmentQueueStatus(
  appointment: AppointmentResponse, queue: ReceptionVisitResponse[]
): string {
  // Queue state takes precedence only when the visit actually belongs to this appointment.
  return queue.find((visit) => visit.appointmentId === appointment.id)?.status ?? appointment.status;
}

export function filterReceptionAppointments(
  appointments: ReceptionAppointmentResponse[], queue: ReceptionVisitResponse[],
  doctorId: string, status: StatusFilter, search: string
): ReceptionAppointmentResponse[] {
  const term = search.trim().toLocaleLowerCase('vi-VN');
  return appointments.filter((appointment) => {
    if (doctorId && appointment.doctorId !== doctorId) return false;
    if (status !== 'ALL' && appointmentQueueStatus(appointment, queue) !== status) return false;
    return !term || [appointment.id, appointment.patientId, appointment.patientName, appointment.doctorId, appointment.reason ?? '']
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(term));
  }).sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
}

function changeMonth(month: string, offset: number): string {
  const [year, part] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, part - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function doctorName(id: string, doctors: DoctorProfileResponse[] | null) {
  const doctor = doctors?.find((item) => item.id === id);
  return { name: verifiedDoctorName(doctor), specialty: doctor?.specialtyName || 'Chưa có chuyên khoa' };
}

export default function ReceptionAppointmentsOverview({ date, appointments, queue, doctors, selectedId, onDateChange, onSelect }: Props) {
  const [month, setMonth] = useState(date.slice(0, 7));
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    setMonth(date.slice(0, 7));
    setDoctorFilter('');
    setStatusFilter('ALL');
    setSearch('');
    setPage(1);
  }, [date]);
  useEffect(() => { setPage(1); }, [doctorFilter, statusFilter, search]);

  const visitsByAppointment = useMemo(() => new Map(queue.map((visit) => [visit.appointmentId, visit])), [queue]);
  const filtered = filterReceptionAppointments(appointments, queue, doctorFilter, statusFilter, search);
  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const schedule = appointments.filter((item) => item.status !== 'CANCELLED')
    .sort((a, b) => a.startTime.localeCompare(b.startTime)).slice(0, 4);
  const checkedIn = new Set(queue.map((visit) => visit.appointmentId)).size;
  const pending = appointments.filter((item) => item.status === 'PENDING').length;
  const completed = appointments.filter((item) => item.status === 'COMPLETED').length;
  const days = calendarDays(month);
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`));
  const metrics = [
    { label: 'Lịch hẹn trong ngày', count: appointments.length, hint: 'Theo ngày đang chọn', icon: CalendarDays, tone: 'blue' },
    { label: 'Đã tiếp nhận', count: checkedIn, hint: 'Lịch có lượt check-in', icon: UsersRound, tone: 'green' },
    { label: 'Chờ xác nhận', count: pending, hint: 'Cần xử lý lịch hẹn', icon: Clock3, tone: 'purple' },
    { label: 'Đã hoàn thành', count: completed, hint: 'Trạng thái lịch hẹn', icon: CheckCircle2, tone: 'orange' }
  ] as const;

  return <div className="reception-overview" aria-label="Tổng quan và danh sách lịch hẹn">
    <section className="reception-primary">
      <div className="reception-filters" aria-label="Bộ lọc lịch hẹn">
        <label className="reception-filter reception-date"><CalendarDays size={17} aria-hidden="true" /><span className="sr-only">Ngày lịch hẹn</span>
          <input aria-label="Ngày lịch hẹn" type="date" value={date} onChange={(event) => { if (event.target.value) onDateChange(event.target.value); }} /></label>
        <label className="reception-filter"><Stethoscope size={17} aria-hidden="true" /><span className="sr-only">Lọc theo bác sĩ</span>
          <select aria-label="Lọc theo bác sĩ" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
            <option value="">Tất cả bác sĩ</option>
            {[...new Set(appointments.map((item) => item.doctorId))].map((id) => <option key={id} value={id}>{doctorName(id, doctors).name} · {doctorName(id, doctors).specialty}</option>)}
          </select></label>
        <label className="reception-filter"><span className="sr-only">Lọc theo trạng thái</span>
          <select aria-label="Lọc theo trạng thái" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
            <option value="ALL">Tất cả trạng thái</option>
            {(['PENDING', 'CONFIRMED', 'WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED'] as const)
              .map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
          </select></label>
        <label className="reception-filter reception-search"><Search size={17} aria-hidden="true" />
          <span className="sr-only">Tìm mã lịch hẹn, mã bệnh nhân, bác sĩ hoặc lý do</span>
          <input aria-label="Tìm lịch hẹn" type="search" placeholder="Tìm mã lịch, bệnh nhân, bác sĩ, lý do..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      <section className="reception-metrics" aria-label={`Thống kê ngày ${formatDate(date)}`}>
        {metrics.map(({ label, count, hint, icon: Icon, tone }) => <article className={`reception-metric reception-metric-${tone}`} key={label}>
          <span className="reception-metric-icon"><Icon size={22} aria-hidden="true" /></span>
          <strong>{count.toLocaleString('vi-VN')}</strong><h3>{label}</h3><p>{hint}</p>
        </article>)}
      </section>
    </section>

    <aside className="reception-calendar panel" aria-label="Lịch và lịch hẹn theo ngày">
      <div className="reception-calendar-header"><h3>{monthLabel}</h3><div>
        <button type="button" className="reception-icon-button" aria-label="Tháng trước" onClick={() => setMonth((previous) => changeMonth(previous, -1))}><ChevronLeft size={18} /></button>
        <button type="button" className="reception-icon-button" aria-label="Tháng sau" onClick={() => setMonth((previous) => changeMonth(previous, 1))}><ChevronRight size={18} /></button>
      </div></div>
      <div className="reception-calendar-grid" role="group" aria-label={`Chọn ngày trong ${monthLabel}`}>
        {weekdays.map((day) => <span className="reception-weekday" key={day}>{day}</span>)}
        {days.map((day, index) => day
          ? <button type="button" key={day} className={day === date ? 'selected' : ''} aria-label={formatDate(day)} aria-pressed={day === date} onClick={() => onDateChange(day)}>{Number(day.slice(-2))}</button>
          : <span className="reception-calendar-empty" key={`empty-${index}`} aria-hidden="true" />)}
      </div>
      <div className="reception-schedule">
        <div className="reception-schedule-heading"><h3>Lịch ngày đã chọn</h3><span>{formatDate(date)}</span></div>
        {!schedule.length && <p className="reception-no-schedule">Không có lịch hẹn đang hoạt động trong ngày.</p>}
        {schedule.map((item) => {
          const visit = visitsByAppointment.get(item.id);
          const doctor = doctorName(item.doctorId, doctors);
          return <button type="button" className="reception-schedule-item" key={item.id} onClick={() => onSelect(item.id)} aria-label={`Xem chi tiết lịch ${shortId(item.id)}`}>
            <span className="reception-schedule-time">{formatTime(item.startTime)}</span>
            <span className="reception-schedule-body"><strong>{item.patientName}</strong><small>{doctor.name} · {doctor.specialty}</small></span>
            <Badge tone={visit?.status ?? item.status}>{visit?.status ?? item.status}</Badge>
          </button>;
        })}
        {appointments.filter((item) => item.status !== 'CANCELLED').length > schedule.length && <p className="reception-schedule-more">Hiển thị 4 lịch đầu tiên; xem thêm trong bảng bên dưới.</p>}
      </div>
    </aside>

    <section className="panel reception-table-panel" aria-label="Danh sách lịch hẹn trong ngày">
      <div className="reception-table-heading"><div><h3>Tất cả lịch hẹn</h3><p>Ngày {formatDate(date)} · {filtered.length} trên {appointments.length} lịch phù hợp</p></div>
        <span className="reception-table-source">Theo ngày đang chọn</span></div>
      <div className="reception-table-scroll" tabIndex={0} aria-label="Bảng lịch hẹn, cuộn ngang trên màn hình nhỏ">
        <table className="reception-table"><thead><tr><th scope="col">Bệnh nhân</th><th scope="col">Bác sĩ</th><th scope="col">Chuyên khoa</th><th scope="col">Ngày</th><th scope="col">Giờ</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{visible.map((item) => {
            const doctor = doctorName(item.doctorId, doctors);
            const visit = visitsByAppointment.get(item.id);
            return <tr key={item.id} className={selectedId === item.id ? 'is-selected' : ''}>
              <td><div className="reception-person"><span className="reception-initial">BN</span><div><strong>{item.patientName}</strong><small>Lịch #{shortId(item.id)}</small></div></div></td>
              <td><div className="reception-person"><span className="reception-initial doctor"><Stethoscope size={16} /></span><strong>{doctor.name}</strong></div></td>
              <td>{doctor.specialty}</td><td><span className="reception-no-wrap">{formatDate(item.appointmentDate)}</span></td>
              <td><span className="reception-no-wrap">{formatTime(item.startTime)}</span></td>
              <td><Badge tone={visit?.status ?? item.status}>{visit?.status ?? item.status}</Badge></td>
              <td><button className="reception-row-action" type="button" onClick={() => onSelect(item.id)} aria-label={`Xem chi tiết lịch ${shortId(item.id)}`}>Chi tiết</button></td>
            </tr>;
          })}</tbody></table>
      </div>
      {!filtered.length && <p className="reception-no-results" role="status">{appointments.length ? 'Không có lịch hẹn phù hợp với bộ lọc.' : 'Không có lịch hẹn trong ngày đã chọn.'}</p>}
      {filtered.length > PAGE_SIZE && <nav className="reception-pagination" aria-label="Phân trang lịch hẹn">
        <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
        <div><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Trước</button><span>Trang {currentPage}/{maxPage}</span>
          <button type="button" disabled={currentPage >= maxPage} onClick={() => setPage((value) => Math.min(maxPage, value + 1))}>Sau</button></div>
      </nav>}
      <p className="reception-data-note">Tên bệnh nhân được xác minh từ Patient Service. Danh sách và số liệu thuộc ngày đang chọn.</p>
    </section>
  </div>;
}
