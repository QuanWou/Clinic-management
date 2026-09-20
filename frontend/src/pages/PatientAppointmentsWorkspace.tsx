import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CalendarDays, CalendarPlus, Clock3, RefreshCw, ShieldCheck, Stethoscope } from 'lucide-react';
import { cancelAppointment, createAppointment, getAppointmentAvailability, getDoctors } from '../api/clinic';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { AppointmentResponse, CreateAppointmentRequest, DoctorProfileResponse } from '../types/domain';
import { formatDate, formatTime, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './patientPortal.css';

type Filter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
const blank: CreateAppointmentRequest = { doctorId: '', appointmentDate: '', startTime: '', endTime: '', reason: '' };
const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' }, { key: 'UPCOMING', label: 'Sắp tới' }, { key: 'COMPLETED', label: 'Hoàn thành' }, { key: 'CANCELLED', label: 'Đã hủy' }
];

export default function PatientAppointmentsWorkspace({ appointments, error, loading, onRefresh }: {
  appointments: AppointmentResponse[] | null | undefined; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  const [localRows, setLocalRows] = useState<AppointmentResponse[] | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [booking, setBooking] = useState<CreateAppointmentRequest>(blank);
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState('');
  const today = clinicToday();
  useEffect(() => { setLocalRows(null); setSelectedId(''); setConfirmCancel(''); }, [appointments]);
  useEffect(() => {
    if (!showBooking || !integrations.appointmentOwnership) return;
    let active = true;
    setDoctors(null); setDirectoryError(null);
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((doctor) => !doctor?.id)) throw new Error('Danh sách bác sĩ không hợp lệ.');
      setDoctors(result);
    }).catch((cause: unknown) => { if (active) setDirectoryError(cause instanceof Error ? cause.message : 'Không tải được bác sĩ.'); });
    return () => { active = false; };
  }, [showBooking]);
  const rows = useMemo(() => [...(localRows ?? appointments ?? [])].sort((a, b) => `${b.appointmentDate}${b.startTime}`.localeCompare(`${a.appointmentDate}${a.startTime}`)), [localRows, appointments]);
  const upcoming = rows.filter((item) => item.appointmentDate >= today && ['PENDING', 'CONFIRMED'].includes(item.status)).length;
  const filtered = rows.filter((item) => filter === 'ALL' || filter === 'UPCOMING' && item.appointmentDate >= today && ['PENDING', 'CONFIRMED'].includes(item.status)
    || filter === 'COMPLETED' && item.status === 'COMPLETED' || filter === 'CANCELLED' && item.status === 'CANCELLED');
  const selected = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;

  async function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !integrations.appointmentOwnership) return;
    setActionError(null); setNotice(null);
    if (!doctors?.some((doctor) => doctor.id === booking.doctorId) || !booking.appointmentDate || booking.appointmentDate < today
      || !booking.startTime || booking.endTime <= booking.startTime || !booking.reason.trim()) {
      setActionError('Chọn bác sĩ đang hoạt động, ngày và giờ hợp lệ, kèm lý do khám.'); return;
    }
    setBusy(true);
    try {
      const available = await getAppointmentAvailability(booking.doctorId, booking.appointmentDate, booking.startTime, booking.endTime);
      if (!available.available || available.doctorId !== booking.doctorId || available.date !== booking.appointmentDate
        || available.startTime?.slice(0, 5) !== booking.startTime || available.endTime?.slice(0, 5) !== booking.endTime) throw new Error('Khung giờ này không còn trống. Vui lòng chọn giờ khác.');
      const created = await createAppointment({ ...booking, reason: booking.reason.trim() });
      if (!created?.id || created.doctorId !== booking.doctorId || created.appointmentDate !== booking.appointmentDate || created.status !== 'PENDING') throw new Error('Máy chủ chưa xác nhận lịch mới; vui lòng tải lại trước khi thử tiếp.');
      setLocalRows((previous) => [created, ...(previous ?? appointments ?? []).filter((item) => item.id !== created.id)]);
      setSelectedId(created.id); setFilter('ALL'); setBooking(blank); setShowBooking(false);
      setNotice('Máy chủ đã ghi nhận yêu cầu đặt lịch. Vui lòng chờ xác nhận.');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Không thể đặt lịch.'); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (!selected || selected.id !== confirmCancel || busy || !integrations.appointmentOwnership) return;
    const id = selected.id;
    setBusy(true); setActionError(null); setNotice(null);
    try {
      const result = await cancelAppointment(id);
      if (result.id !== id || result.status !== 'CANCELLED') throw new Error('Máy chủ chưa xác nhận hủy lịch. Hãy tải lại để kiểm tra.');
      setLocalRows((previous) => (previous ?? appointments ?? []).map((item) => item.id === id ? result : item));
      setConfirmCancel(''); setNotice('Máy chủ đã xác nhận hủy lịch.');
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Không thể hủy lịch.'); }
    finally { setBusy(false); }
  }

  return <div className="patient-portal" aria-label="Lịch hẹn bệnh nhân"><PageHeader title="Lịch hẹn của tôi" subtitle="Xem, đặt mới và quản lý lịch khám cá nhân"
    actions={<><button type="button" className="soft-button" disabled={loading || busy} onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>
      {integrations.appointmentOwnership && <button type="button" disabled={busy} onClick={() => setShowBooking((value) => !value)}><CalendarPlus size={17} /> {showBooking ? 'Đóng đặt lịch' : 'Đặt lịch mới'}</button>}</>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> LỊCH KHÁM CÁ NHÂN</span><h3>Sắp xếp lịch khám dễ dàng.</h3>
      <p>Kiểm tra lịch và yêu cầu khung giờ với bác sĩ đang hoạt động. Trạng thái đặt lịch chỉ cập nhật theo xác nhận của máy chủ.</p><div className="patient-hero-tags"><span><CalendarDays size={15} /> {appointments == null && localRows == null ? 'Đang tải lịch' : `${rows.length} lịch của tôi`}</span><span><Clock3 size={15} /> {appointments == null && localRows == null ? '—' : upcoming} sắp tới</span></div></div><CalendarCheck2 size={60} aria-hidden="true" /></section>
    {!integrations.appointmentOwnership && <Alert tone="info">Chức năng đặt/hủy lịch chưa bật vì kiểm tra quyền và chống trùng lịch chưa được xác nhận. Bạn vẫn có thể xem lịch hiện có.</Alert>}
    {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Thử lại</button></Alert>}
    {actionError && <Alert tone="error">{actionError}</Alert>}{notice && <Alert tone="info">{notice}</Alert>}
    {showBooking && integrations.appointmentOwnership && <form className="panel patient-panel patient-form" onSubmit={(event) => void book(event)}>
      <div className="patient-section-head"><div><span>YÊU CẦU ĐẶT LỊCH</span><h3>Chọn bác sĩ và thời gian</h3><p>Phòng khám sẽ xác nhận yêu cầu của bạn.</p></div><Stethoscope size={22} /></div>
      {directoryError && <Alert tone="error">{directoryError}</Alert>}
      <div className="patient-form-fields"><label>Bác sĩ<select required disabled={!doctors?.length || busy} value={booking.doctorId} onChange={(event) => setBooking({ ...booking, doctorId: event.target.value })}>
        <option value="">{doctors === null ? 'Đang tải bác sĩ...' : doctors.length ? 'Chọn bác sĩ' : 'Chưa có bác sĩ khả dụng'}</option>
        {doctors?.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.specialtyName || 'Bác sĩ'} · #{shortId(doctor.id)}</option>)}</select></label>
        <label>Ngày khám<input type="date" min={today} required disabled={busy} value={booking.appointmentDate} onChange={(event) => setBooking({ ...booking, appointmentDate: event.target.value })} /></label>
        <label>Giờ bắt đầu<input type="time" required disabled={busy} value={booking.startTime} onChange={(event) => setBooking({ ...booking, startTime: event.target.value })} /></label>
        <label>Giờ kết thúc<input type="time" required disabled={busy} value={booking.endTime} onChange={(event) => setBooking({ ...booking, endTime: event.target.value })} /></label>
      </div><label>Lý do khám<textarea required maxLength={500} disabled={busy} value={booking.reason} onChange={(event) => setBooking({ ...booking, reason: event.target.value })} /></label>
      <div className="patient-form-actions"><button type="submit" disabled={busy || !doctors?.length}>{busy ? 'Đang gửi...' : 'Gửi yêu cầu đặt lịch'}</button><button type="button" className="soft-button" disabled={busy} onClick={() => setShowBooking(false)}>Đóng</button></div>
      <p className="patient-note"><ShieldCheck size={16} /> Hệ thống kiểm tra khả dụng trước khi đặt; máy chủ vẫn là nơi quyết định lịch có hợp lệ hay không.</p>
    </form>}
    {loading && <p role="status">Đang tải lịch khám cá nhân...</p>}
    <div className="patient-two-columns"><section className="panel patient-panel"><div className="patient-section-head"><div><span>DANH SÁCH</span><h3>Lịch hẹn của tôi</h3><p>{filtered.length}/{rows.length} lịch theo bộ lọc.</p></div></div>
      <div className="patient-filters" role="group" aria-label="Lọc lịch hẹn">{filters.map(({ key, label }) => <button key={key} type="button" className={filter === key ? 'is-active' : ''} aria-pressed={filter === key}
        onClick={() => { setFilter(key); setSelectedId(''); setConfirmCancel(''); }}>{label}</button>)}</div>
      {!loading && !error && !appointments && !localRows && <p>Chưa tải được dữ liệu lịch hẹn.</p>}
      {!loading && (appointments != null || localRows != null) && filtered.length === 0 && <div className="patient-empty"><CalendarDays size={26} /><strong>Không có lịch hẹn phù hợp.</strong><p>Thử đổi bộ lọc hoặc yêu cầu đặt lịch mới.</p></div>}
      <div className="patient-worklist">{filtered.map((item) => <button key={item.id} type="button" className={selected?.id === item.id ? 'is-active' : ''} aria-pressed={selected?.id === item.id} onClick={() => { setSelectedId(item.id); setConfirmCancel(''); }}>
        <span className="patient-row-icon"><CalendarDays size={19} /></span><div><strong>{formatDate(item.appointmentDate)} · {formatTime(item.startTime)}</strong><small>Bác sĩ #{shortId(item.doctorId)} · Lịch #{shortId(item.id)}</small></div><Badge tone={item.status}>{statusLabel(item.status)}</Badge></button>)}</div>
    </section><aside className="panel patient-panel"><div className="patient-section-head"><div><span>CHI TIẾT</span><h3>Thông tin lịch hẹn</h3><p>Dữ liệu của lịch được chọn.</p></div></div>
      {!selected ? <div className="patient-empty"><CalendarDays size={26} /><strong>Chọn lịch để xem chi tiết</strong></div> : <><dl className="patient-fields"><div><dt>Mã lịch hẹn</dt><dd>{selected.id}</dd></div><div><dt>Trạng thái</dt><dd><Badge tone={selected.status}>{statusLabel(selected.status)}</Badge></dd></div>
        <div><dt>Ngày khám</dt><dd>{formatDate(selected.appointmentDate)}</dd></div><div><dt>Khung giờ</dt><dd>{formatTime(selected.startTime)}–{formatTime(selected.endTime)}</dd></div>
        <div><dt>Bác sĩ</dt><dd>#{shortId(selected.doctorId)}</dd></div><div className="patient-field-wide"><dt>Lý do khám</dt><dd>{selected.reason || 'Chưa cung cấp'}</dd></div></dl>
        {integrations.appointmentOwnership && ['PENDING', 'CONFIRMED'].includes(selected.status) && <div className="patient-form-actions" style={{ marginTop: '1rem' }}>
          <button className="soft-button danger" type="button" disabled={busy} onClick={() => setConfirmCancel(selected.id)}>Yêu cầu hủy lịch</button></div>}
        {confirmCancel === selected.id && <div className="patient-note"><div><strong>Xác nhận hủy lịch #{shortId(selected.id)}?</strong><p>Không thể hủy lịch đã check-in; máy chủ sẽ kiểm tra trạng thái trước khi thực hiện.</p>
          <div className="patient-form-actions"><button type="button" className="soft-button danger" disabled={busy} onClick={() => void cancel()}>Xác nhận hủy</button><button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmCancel('')}>Giữ lịch</button></div></div></div>}
      </>}
    </aside></div>
  </div>;
}