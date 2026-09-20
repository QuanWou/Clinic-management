import { useEffect, useState } from 'react';
import { ArrowRight, CalendarClock, CalendarDays, RefreshCw, Search, ShieldCheck, Stethoscope } from 'lucide-react';
import { getDoctors, getDoctorSchedules } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { DoctorProfileResponse, DoctorSchedule } from '../types/domain';
import { formatMoney, formatTime, shortId } from '../utils/format';
import './patientPortal.css';

const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

/** Only public active directory/schedules; never requests Identity details or admin profile APIs. */
export default function PatientDoctorsWorkspace({ onAppointments }: { onAppointments?: () => void }) {
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [schedules, setSchedules] = useState<DoctorSchedule[] | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setDoctors(null); setError(null); setLoading(true); setSelectedId('');
    void getDoctors().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !item?.id || !item.userId)) throw new Error('Danh sách bác sĩ không hợp lệ.');
      setDoctors(result);
    }).catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải bác sĩ.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);
  const filtered = (doctors ?? []).filter((item) => `${item.id} ${item.specialtyName ?? ''}`.toLocaleLowerCase('vi-VN').includes(search.trim().toLocaleLowerCase('vi-VN')));
  const selected = doctors?.find((item) => item.id === selectedId);
  useEffect(() => {
    if (!selected) { setSchedules(null); setScheduleError(null); return; }
    let active = true;
    setSchedules(null); setScheduleError(null); setScheduleLoading(true);
    void getDoctorSchedules(selected.id).then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 7
        || typeof item.startTime !== 'string' || typeof item.endTime !== 'string' || item.startTime >= item.endTime
        || ('doctorId' in item && item.doctorId && item.doctorId !== selected.id))) throw new Error('Lịch làm việc không hợp lệ.');
      setSchedules([...result].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    }).catch((cause: unknown) => { if (active) setScheduleError(cause instanceof Error ? cause.message : 'Không tải được lịch làm việc.'); })
      .finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [selected?.id]);

  return <div className="patient-portal" aria-label="Danh sách bác sĩ bệnh nhân"><PageHeader title="Bác sĩ phòng khám" subtitle="Tìm chuyên khoa và tham khảo lịch làm việc trước khi đặt lịch"
    actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Làm mới</button>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> BÁC SĨ ĐANG HOẠT ĐỘNG</span><h3>Tìm bác sĩ phù hợp với lịch của bạn.</h3>
      <p>Tra cứu danh sách và ca làm việc công khai. Lịch làm việc không bảo đảm khung giờ còn trống; hãy kiểm tra khi đặt lịch.</p><div className="patient-hero-tags"><span><Stethoscope size={15} /> {doctors ? `${doctors.length} bác sĩ` : 'Đang tải danh sách'}</span></div></div>
      {onAppointments && <button type="button" className="patient-hero-action" onClick={onAppointments}>Đến Lịch hẹn <ArrowRight size={17} /></button>}</section>
    {error && <Alert tone="error">{error} <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    <section className="panel patient-panel"><div className="patient-section-head"><div><span>DANH BẠ BÁC SĨ</span><h3>Tra cứu theo mã hoặc chuyên khoa</h3><p>{doctors ? `${filtered.length}/${doctors.length} bác sĩ phù hợp` : 'Chỉ tải bác sĩ đang hoạt động từ API.'}</p></div></div>
      <label className="patient-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Tìm bác sĩ</span><input type="search" aria-label="Tìm bác sĩ" placeholder="Nhập mã bác sĩ hoặc chuyên khoa..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      {loading && <p role="status">Đang tải danh sách bác sĩ...</p>}
      {!loading && doctors?.length === 0 && <div className="patient-empty"><Stethoscope size={29} /><strong>Chưa có bác sĩ đang hoạt động.</strong></div>}
      {!loading && doctors && !filtered.length && doctors.length > 0 && <div className="patient-empty"><Search size={28} /><strong>Không tìm thấy bác sĩ phù hợp.</strong></div>}
      <div className="patient-directory-grid" style={{ marginTop: '1rem' }}>{filtered.map((doctor) => <article className="patient-doctor-card" key={doctor.id}>
        <div className="patient-doctor-card-header"><span><Stethoscope size={21} /></span><div><strong>{doctor.specialtyName || 'Chưa cập nhật chuyên khoa'}</strong><small>Bác sĩ #{shortId(doctor.id)}</small></div></div>
        <p>Giá khám tham khảo: {doctor.consultationFee == null ? 'Chưa cung cấp' : `${formatMoney(doctor.consultationFee)} (đơn vị tiền tệ chưa cung cấp)`}</p>
        <button type="button" className="soft-button" onClick={() => setSelectedId((previous) => previous === doctor.id ? '' : doctor.id)}>{selectedId === doctor.id ? 'Ẩn ca làm việc' : 'Xem ca làm việc'} <ArrowRight size={15} /></button>
      </article>)}</div>
    </section>
    {selected && <section className="panel patient-panel" aria-label="Lịch làm việc bác sĩ"><div className="patient-section-head"><div><span>CA LÀM VIỆC CÔNG KHAI</span><h3>Bác sĩ #{shortId(selected.id)}</h3><p>{selected.specialtyName || 'Chưa cập nhật chuyên khoa'}</p></div><CalendarClock size={22} /></div>
      {scheduleLoading && <p role="status">Đang tải ca làm việc...</p>}{scheduleError && <Alert tone="error">{scheduleError}</Alert>}
      {!scheduleLoading && schedules?.length === 0 && <div className="patient-empty"><CalendarDays size={26} /><strong>Chưa có ca làm việc được công bố.</strong></div>}
      <div className="patient-worklist">{schedules?.map((item, index) => <div key={item.id || `${item.dayOfWeek}-${index}`} className="patient-compact-row"><span className="patient-row-icon"><CalendarClock size={18} /></span><div><strong>{weekdays[item.dayOfWeek - 1]}</strong><small>{formatTime(item.startTime)}–{formatTime(item.endTime)}</small></div></div>)}</div>
      <p className="patient-note"><ShieldCheck size={16} /> Ca làm việc chỉ để tham khảo; khung giờ đặt lịch được kiểm tra riêng theo API khả dụng.</p>
      {onAppointments && <button type="button" onClick={onAppointments}>Đến trang đặt lịch <ArrowRight size={16} /></button>}
    </section>}
  </div>;
}