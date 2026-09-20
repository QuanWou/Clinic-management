import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  ClipboardList, Clock3, RefreshCw, Search, ShieldCheck, Stethoscope, UserRoundCheck
} from 'lucide-react';
import { confirmAppointment, getAppointment, getReceptionQueue, updateReceptionQueue } from '../api/clinic';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { AppointmentResponse, QueueStatus, ReceptionVisitResponse } from '../types/domain';
import { doctorQueueCounts, filterDoctorVisits, shiftClinicDay, type DoctorQueueFilter } from '../utils/doctorAppointments';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { allowedQueueTransitions } from './ReceptionAppointmentsPage';
import { calendarDays } from './ReceptionAppointmentsOverview';

const PAGE_SIZE = 10;
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const weekDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const queueStates: DoctorQueueFilter[] = ['ALL', 'WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'];

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể tải dữ liệu từ máy chủ.';
}

function shiftMonth(month: string, offset: number) {
  const [year, index] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, index - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** No staff-wide booking API is called here. Queue is ownership-scoped by the backend. */
export default function DoctorAppointmentsWorkspace() {
  const [date, setDate] = useState(clinicToday());
  const [month, setMonth] = useState(date.slice(0, 7));
  const [visits, setVisits] = useState<ReceptionVisitResponse[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DoctorQueueFilter>('ALL');
  const [page, setPage] = useState(1);
  const [selectedVisitId, setSelectedVisitId] = useState('');
  const [appointment, setAppointment] = useState<AppointmentResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [manualDetail, setManualDetail] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const detailRequest = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setVisits(null);
    void getReceptionQueue({ date }).then((result) => {
      if (!Array.isArray(result) || result.some((visit) => visit.visitDate !== date ||
        !Number.isInteger(visit.queueNumber) || visit.queueNumber < 1)) {
        throw new Error('Dữ liệu hàng đợi không hợp lệ hoặc không đúng ngày được chọn.');
      }
      if (active) setVisits(result);
    }).catch((cause: unknown) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, revision]);

  function selectDay(next: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || busy) return;
    detailRequest.current += 1;
    setDate(next); setMonth(next.slice(0, 7)); setSearch(''); setStatus('ALL'); setPage(1);
    setSelectedVisitId(''); setAppointment(null); setDetailError(null); setDetailLoading(false);
    setManualDetail(false); setConfirmFinish(false); setNotice(null);
  }

  async function loadDetail(id: string, visit?: ReceptionVisitResponse) {
    const request = ++detailRequest.current;
    setAppointment(null); setDetailError(null); setDetailLoading(true); setConfirmFinish(false);
    try {
      const result = await getAppointment(id);
      if (result.id !== id || (visit && (result.patientId !== visit.patientId || result.doctorId !== visit.doctorId ||
          result.appointmentDate !== visit.visitDate))) {
        throw new Error('Thông tin lịch hẹn không khớp lượt khám đang chọn.');
      }
      if (request === detailRequest.current) setAppointment(result);
    } catch (cause) { if (request === detailRequest.current) setDetailError(errorMessage(cause)); }
    finally { if (request === detailRequest.current) setDetailLoading(false); }
  }

  function selectVisit(visit: ReceptionVisitResponse) {
    if (busy) return;
    setSelectedVisitId(visit.id); setManualDetail(false); setNotice(null);
    void loadDetail(visit.appointmentId, visit);
  }

  async function lookUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = lookupId.trim().toLowerCase();
    if (!uuid.test(id) || busy) { setDetailError('Nhập UUID lịch hẹn hợp lệ.'); return; }
    setSelectedVisitId(''); setManualDetail(true); setNotice(null);
    await loadDetail(id);
  }

  async function confirmPending() {
    if (busy || !appointment || appointment.status !== 'PENDING' || !manualDetail) return;
    const id = appointment.id;
    setBusy(true); setDetailError(null); setNotice(null);
    try {
      const response = await confirmAppointment(id);
      if (response.id !== id || response.doctorId !== appointment.doctorId ||
        response.patientId !== appointment.patientId || response.status !== 'CONFIRMED') {
        throw new Error('Máy chủ chưa xác nhận lịch hẹn được phân công.');
      }
      setAppointment(response); setNotice('Lịch hẹn đã được hệ thống xác nhận.');
    } catch (cause) { setDetailError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function changeStatus(visit: ReceptionVisitResponse, target: QueueStatus) {
    if (busy || !allowedQueueTransitions(visit.status, 'DOCTOR').includes(target)
        || (target === 'COMPLETED' && !confirmFinish)) return;
    setBusy(true); setError(null); setNotice(null); setDetailError(null);
    try {
      const updated = await updateReceptionQueue(visit.id, target);
      if (updated.id !== visit.id || updated.appointmentId !== visit.appointmentId ||
          updated.patientId !== visit.patientId || updated.doctorId !== visit.doctorId ||
          updated.visitDate !== visit.visitDate || updated.status !== target) {
        throw new Error('Máy chủ chưa xác nhận thay đổi trạng thái đúng lượt khám.');
      }
      setVisits((previous) => previous?.map((item) => item.id === updated.id ? updated : item) ?? null);
      setConfirmFinish(false);
      setNotice(`Đã cập nhật lượt #${visit.queueNumber}: ${statusLabel(target)}. Kết quả do máy chủ xác nhận.`);
      // Appointment and visit completion are atomic in the backend; reload details, not local success guesses.
      if (appointment?.id === updated.appointmentId) {
        setAppointment(null);
        try {
          const refreshed = await getAppointment(updated.appointmentId);
          if (refreshed.id === updated.appointmentId && refreshed.doctorId === updated.doctorId)
            setAppointment(refreshed);
          else setDetailError('Thông tin lịch hẹn sau cập nhật không khớp, hãy làm mới.');
        } catch (cause) { setDetailError(`Không tải lại được chi tiết: ${errorMessage(cause)}`); }
      }
    } catch (cause) {
      setError(errorMessage(cause));
      setRevision((value) => value + 1);
    } finally { setBusy(false); }
  }

  const rows = visits ?? [];
  const counts = doctorQueueCounts(rows);
  const filtered = filterDoctorVisits(rows, search, status);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedVisit = rows.find((visit) => visit.id === selectedVisitId) ?? null;
  const monthDays = calendarDays(month);
  const monthLabel = new Intl.DateTimeFormat('vi-VN', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`));

  return <div className="doctor-appointments-workspace">
    <PageHeader title="Lịch hẹn của tôi" subtitle="Lịch khám và hàng đợi dành riêng cho bác sĩ đang đăng nhập"
      actions={<button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Làm mới</button>} />
    <section className="doctor-appointments-hero" aria-label="Giới thiệu lịch khám bác sĩ">
      <div><span className="doctor-appointments-kicker"><ShieldCheck size={15} /> LỊCH KHÁM CÁ NHÂN</span>
        <h3>Theo dõi lượt khám, chăm sóc đúng lịch.</h3>
        <p>Xem các bệnh nhân đã check-in, gọi lượt, bắt đầu và hoàn tất khám theo trạng thái được server cho phép.</p>
        <span className="doctor-appointments-chip"><CalendarDays size={15} /> {formatDate(date)} · Phạm vi bác sĩ hiện tại</span>
      </div><span className="doctor-appointments-hero-icon" aria-hidden="true"><Stethoscope size={69} strokeWidth={1.35} /></span>
    </section>
    {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {loading && <p className="doctor-appointments-loading" role="status">Đang tải hàng đợi đã check-in của ngày đã chọn...</p>}
    {visits && <section className="doctor-appointments-metrics" aria-label={`Thống kê hàng đợi ngày ${formatDate(date)}`}>
      {[
        { name: 'Lượt đã check-in', count: counts.checkedIn, hint: 'Theo ngày đang chọn', icon: UserRoundCheck, tone: 'blue' },
        { name: 'Đang chờ / đã gọi', count: counts.waiting, hint: 'Cần tiếp nhận khám', icon: Clock3, tone: 'orange' },
        { name: 'Đang khám', count: counts.inProgress, hint: 'Đã bắt đầu khám', icon: Stethoscope, tone: 'purple' },
        { name: 'Đã hoàn tất', count: counts.completed, hint: 'Được máy chủ ghi nhận', icon: CheckCircle2, tone: 'green' }
      ].map(({ name, count, hint, icon: Icon, tone }) => <article className={`doctor-appointments-metric doctor-appointments-metric-${tone}`} key={name}>
        <span className="doctor-appointments-metric-icon"><Icon size={22} /></span><strong>{count.toLocaleString('vi-VN')}</strong><h3>{name}</h3><p>{hint}</p>
      </article>)}
    </section>}
    <section className="doctor-appointments-content">
      <aside className="panel doctor-appointments-calendar" aria-label="Chọn ngày khám">
        <div className="doctor-appointments-calendar-head"><h3>{monthLabel}</h3><div>
          <button type="button" aria-label="Tháng trước" disabled={busy} onClick={() => setMonth((value) => shiftMonth(value, -1))}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Tháng sau" disabled={busy} onClick={() => setMonth((value) => shiftMonth(value, 1))}><ChevronRight size={18} /></button>
        </div></div>
        <div className="doctor-appointments-calendar-grid" role="group" aria-label={`Chọn ngày trong ${monthLabel}`}>
          {weekDays.map((day) => <span key={day} className="doctor-appointments-weekday">{day}</span>)}
          {monthDays.map((day, index) => day ? <button type="button" key={day} disabled={busy} aria-pressed={date === day} aria-label={formatDate(day)} className={date === day ? 'selected' : undefined} onClick={() => selectDay(day)}>{Number(day.slice(-2))}</button>
            : <span key={`blank-${index}`} aria-hidden="true" />)}
        </div>
        <div className="doctor-appointments-date-actions"><button type="button" className="soft-button" disabled={busy} onClick={() => selectDay(shiftClinicDay(date, -1))}><ChevronLeft size={16} /> Ngày trước</button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => selectDay(clinicToday())}>Hôm nay</button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => selectDay(shiftClinicDay(date, 1))}>Ngày sau <ChevronRight size={16} /></button></div>
        <label className="doctor-appointments-date-input"><CalendarDays size={17} /> <span className="doctor-appointments-sr-only">Ngày khám</span>
          <input type="date" aria-label="Ngày khám" value={date} disabled={busy} onChange={(event) => selectDay(event.target.value)} /></label>
        <p className="doctor-appointments-calendar-note">Lịch tháng chỉ dùng để chọn ngày. Không suy luận số lượng lịch đặt trước từ API hàng đợi.</p>
      </aside>
      <section className="panel doctor-appointments-directory" aria-label="Hàng đợi của bác sĩ">
        <div className="doctor-appointments-section-heading"><div><span>HÀNG ĐỢI ĐƯỢC PHÂN CÔNG</span><h3>Lượt khám ngày {formatDate(date)}</h3>
          <p>Chỉ gồm lượt đã check-in · {filtered.length} / {rows.length} lượt phù hợp</p></div><span className="doctor-appointments-source"><ShieldCheck size={15} /> API theo quyền bác sĩ</span></div>
        <div className="doctor-appointments-filters"><label><Search size={17} /><span className="doctor-appointments-sr-only">Tìm lượt khám</span>
          <input type="search" aria-label="Tìm lượt khám" placeholder="Số thứ tự, mã lịch hoặc mã bệnh nhân..." disabled={busy || loading} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
          <label><span className="doctor-appointments-sr-only">Lọc trạng thái lượt khám</span><select aria-label="Lọc trạng thái lượt khám" value={status} disabled={busy || loading} onChange={(event) => { setStatus(event.target.value as DoctorQueueFilter); setPage(1); }}>
            {queueStates.map((state) => <option key={state} value={state}>{state === 'ALL' ? 'Tất cả trạng thái' : statusLabel(state)}</option>)}</select></label></div>
        {visits && <><div className="doctor-appointments-table-scroll" tabIndex={0} aria-label="Bảng hàng đợi có thể cuộn ngang"><table className="doctor-appointments-table">
          <thead><tr><th scope="col">Số thứ tự</th><th scope="col">Bệnh nhân</th><th scope="col">Mã lịch hẹn</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{visible.map((visit) => <tr key={visit.id} className={selectedVisitId === visit.id ? 'selected' : undefined}>
            <td><strong className="doctor-appointments-queue-number">#{visit.queueNumber}</strong></td>
            <td>BN #{shortId(visit.patientId)}</td><td className="doctor-appointments-id">{visit.appointmentId}</td>
            <td><Badge tone={visit.status}>{visit.status}</Badge></td>
            <td><button type="button" className="doctor-appointments-row-action" disabled={busy} onClick={() => selectVisit(visit)}>Chi tiết <ArrowRight size={14} /></button></td>
          </tr>)}</tbody></table></div>
          {filtered.length === 0 && <p className="doctor-appointments-empty" role="status">{rows.length ? 'Không có lượt khám phù hợp bộ lọc.' : 'Chưa có lượt check-in trong ngày đã chọn.'}</p>}
          {filtered.length > PAGE_SIZE && <nav className="doctor-appointments-pagination" aria-label="Phân trang hàng đợi"><span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span><div>
            <button type="button" disabled={busy || currentPage === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={15} /> Trước</button><span>Trang {currentPage}/{pages}</span>
            <button type="button" disabled={busy || currentPage >= pages} onClick={() => setPage((value) => value + 1)}>Sau <ChevronRight size={15} /></button>
          </div></nav>}
        </>}
        <p className="doctor-appointments-data-note"><CircleAlert size={16} /> API chưa cấp danh sách lịch hẹn chưa check-in cho bác sĩ; đây không phải toàn bộ lịch đặt trước trong ngày.</p>
      </section>
    </section>
    <section className="panel doctor-appointments-lookup" aria-label="Tìm lịch được phân công theo mã">
      <div className="doctor-appointments-section-heading"><div><span>TRA CỨU CÁ NHÂN</span><h3>Kiểm tra lịch hẹn bằng mã</h3>
        <p>Backend chỉ cho phép bác sĩ xem lịch được phân công; lịch khác sẽ bị từ chối.</p></div><ClipboardList size={24} /></div>
      <form onSubmit={(event) => void lookUp(event)}><label><Search size={17} /><span className="doctor-appointments-sr-only">UUID lịch hẹn</span>
        <input aria-label="Appointment UUID" required placeholder="Nhập UUID lịch hẹn do phòng khám cung cấp" value={lookupId} disabled={busy} onChange={(event) => setLookupId(event.target.value)} /></label>
        <button type="submit" disabled={busy || detailLoading || !lookupId.trim()}>Tra cứu</button></form>
    </section>
    {(detailLoading || detailError || appointment || selectedVisit) && <section className="panel doctor-appointments-detail" aria-label="Chi tiết lịch hẹn của bác sĩ">
      <div className="doctor-appointments-section-heading"><div><span>THÔNG TIN LỊCH KHÁM</span><h3>{appointment ? `Lịch #${shortId(appointment.id)}` : 'Chi tiết lượt khám'}</h3>
        <p>{selectedVisit ? `Số thứ tự #${selectedVisit.queueNumber}` : manualDetail ? 'Tra cứu theo mã lịch hẹn' : 'Lượt đã check-in'}</p></div>
        <button type="button" className="soft-button" disabled={busy} onClick={() => { detailRequest.current += 1; setSelectedVisitId(''); setAppointment(null); setDetailError(null); setDetailLoading(false); setManualDetail(false); setConfirmFinish(false); }}>Đóng</button></div>
      {detailLoading && <p role="status">Đang tải chi tiết lịch được phân công...</p>}
      {detailError && <Alert tone="error">{detailError}</Alert>}
      {appointment && <><dl className="doctor-appointments-detail-grid">
        <div><dt>Mã lịch hẹn</dt><dd>{appointment.id}</dd></div><div><dt>Mã bệnh nhân</dt><dd>{appointment.patientId}</dd></div>
        <div><dt>Ngày khám</dt><dd>{formatDate(appointment.appointmentDate)}</dd></div>
        <div><dt>Khung giờ khám</dt><dd>{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</dd></div>
        <div><dt>Trạng thái lịch hẹn</dt><dd><Badge tone={appointment.status}>{appointment.status}</Badge></dd></div>
        <div><dt>Lý do khám</dt><dd>{appointment.reason || 'Không có thông tin'}</dd></div>
      </dl>
        {manualDetail && appointment.status === 'PENDING' && <div className="doctor-appointments-action"><p>Chỉ xác nhận lịch được phân công. Nếu cần đổi lịch hoặc hủy, liên hệ lễ tân.</p>
          <button type="button" disabled={busy} onClick={() => void confirmPending()}>{busy ? 'Đang xác nhận...' : 'Xác nhận lịch hẹn'}</button></div>}
      </>}
      {selectedVisit && <div className="doctor-appointments-action"><div><strong>Tiến trình lượt khám #{selectedVisit.queueNumber}</strong>
        <Badge tone={selectedVisit.status}>{selectedVisit.status}</Badge></div>
        <p>Chỉ chuyển trạng thái theo thứ tự được backend kiểm tra; bác sĩ không có quyền check-in, đổi hoặc hủy lịch ở đây.</p>
        {selectedVisit.status === 'IN_PROGRESS' && <label className="doctor-appointments-check"><input type="checkbox" checked={confirmFinish} disabled={busy}
          onChange={(event) => setConfirmFinish(event.target.checked)} /> Tôi xác nhận đã hoàn tất khám cho bệnh nhân này.</label>}
        <div className="doctor-appointments-actions">{allowedQueueTransitions(selectedVisit.status, 'DOCTOR').map((target) =>
          <button key={target} type="button" disabled={busy || (target === 'COMPLETED' && !confirmFinish)}
            onClick={() => void changeStatus(selectedVisit, target)}>{statusLabel(target)}</button>)}
          {selectedVisit.status === 'COMPLETED' && <span className="doctor-appointments-complete"><CheckCircle2 size={16} /> Đã hoàn tất theo xác nhận từ máy chủ.</span>}
        </div>
      </div>}
    </section>}
  </div>;
}
