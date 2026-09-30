import { useEffect, useState } from 'react';
import {
  ArrowRight, BookOpen, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardList, Clock3, IdCard, RefreshCw, Search, ShieldCheck, Stethoscope,
  UserRound, UsersRound, X
} from 'lucide-react';
import { getDoctors, getDoctorSchedules, getSpecialties } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type { DoctorProfileResponse, DoctorSchedule, SpecialtyResponse } from '../types/domain';
import { formatTime, formatVnd, shortId } from '../utils/format';
import { filterReceptionDoctors } from '../utils/receptionDoctorDirectory';
import { doctorName } from '../utils/doctorNames';
import './receptionDoctors.css';

const PAGE_SIZE = 8;
const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];

function apiMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể tải dữ liệu từ hệ thống.';
}

/** Reception uses only the active doctor directory and its read-only public schedule route. */
export default function ReceptionDoctorsWorkspace({ onAppointments }: { onAppointments?: () => void }) {
  const [doctors, setDoctors] = useState<DoctorProfileResponse[] | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [specialtyError, setSpecialtyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState('');
  const [specialtyId, setSpecialtyId] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');
  const [schedules, setSchedules] = useState<DoctorSchedule[] | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setDoctors(null); setSpecialties(null); setError(null); setSpecialtyError(null);
    setSelectedId(''); setSchedules(null); setScheduleError(null);
    // Directory and specialty failures are independent, so one cannot mask the other.
    void Promise.allSettled([getDoctors(), getSpecialties()]).then(([directory, categories]) => {
      if (!active) return;
      if (directory.status === 'fulfilled' && Array.isArray(directory.value) && directory.value.every((doctor) =>
        doctor && typeof doctor.id === 'string' && doctor.id.length > 0 && typeof doctor.userId === 'string')) {
        setDoctors(directory.value);
      } else {
        setError(directory.status === 'rejected' ? apiMessage(directory.reason) : 'Danh sách bác sĩ không hợp lệ.');
      }
      if (categories.status === 'fulfilled' && Array.isArray(categories.value) && categories.value.every((item) =>
        item && typeof item.id === 'string' && typeof item.name === 'string')) {
        setSpecialties(categories.value);
      } else {
        setSpecialtyError(categories.status === 'rejected' ? apiMessage(categories.reason) : 'Danh mục chuyên khoa không hợp lệ.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  const filtered = filterReceptionDoctors(doctors ?? [], search, specialtyId);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = doctors?.find((doctor) => doctor.id === selectedId);
  const specialtyChoices = specialties ?? [...new Map((doctors ?? []).filter((doctor) => doctor.specialtyId).map((doctor) =>
    [doctor.specialtyId!, { id: doctor.specialtyId!, name: doctor.specialtyName || `Chuyên khoa #${shortId(doctor.specialtyId)}` }])).values()];
  const specialtyCount = doctors == null ? null : new Set(doctors.map((doctor) => doctor.specialtyId).filter(Boolean)).size;

  useEffect(() => {
    const id = selected?.id;
    if (!id) { setSchedules(null); setScheduleError(null); setScheduleLoading(false); return; }
    let active = true;
    setSchedules(null); setScheduleError(null); setScheduleLoading(true);
    void getDoctorSchedules(id).then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !item || !Number.isInteger(item.dayOfWeek)
        || item.dayOfWeek < 1 || item.dayOfWeek > 7 || typeof item.startTime !== 'string'
        || typeof item.endTime !== 'string' || item.startTime >= item.endTime
        || ('doctorId' in item && item.doctorId != null && item.doctorId !== id))) {
        throw new Error('Dữ liệu lịch làm việc không hợp lệ hoặc không thuộc bác sĩ đã chọn.');
      }
      setSchedules([...result].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    }).catch((cause: unknown) => { if (active) setScheduleError(apiMessage(cause)); })
      .finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [selected?.id, revision]);

  function changeFilters(nextSearch: string, nextSpecialty: string) {
    setSearch(nextSearch); setSpecialtyId(nextSpecialty); setPage(1); setSelectedId('');
  }

  return <div className="reception-doctors" aria-label="Danh sách bác sĩ dành cho lễ tân">
    <PageHeader title="Bác sĩ" subtitle="Tra cứu bác sĩ đang hoạt động và lịch làm việc để hỗ trợ tiếp nhận"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Làm mới</button>} />

    <section className="reception-doctors-hero" aria-label="Tổng quan bác sĩ lễ tân">
      <div><span className="reception-doctors-kicker"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN LỄ TÂN · TRA CỨU</span>
        <h3>Đúng bác sĩ, đúng chuyên khoa.</h3>
        <p>Tìm bác sĩ đang hoạt động và xem lịch làm việc công bố trong hệ thống. Kiểm tra khung giờ còn trống tại bước đặt lịch trước khi xác nhận cho bệnh nhân.</p>
        <span className="reception-doctors-hero-tag"><CheckCircle2 size={15} aria-hidden="true" /> Bác sĩ đang hoạt động</span>
      </div>
      {onAppointments && <button className="reception-doctors-hero-action" type="button" onClick={onAppointments}>
        <CalendarClock size={17} aria-hidden="true" /> Đến trang Lịch hẹn <ArrowRight size={16} aria-hidden="true" />
      </button>}
      <span className="reception-doctors-hero-icon" aria-hidden="true"><Stethoscope size={68} strokeWidth={1.45} /></span>
    </section>

    <section className="reception-doctors-metrics" aria-label="Thống kê danh sách đã tải">
      <article><span className="reception-doctors-metric-icon teal"><UsersRound size={21} aria-hidden="true" /></span><strong>{doctors ? doctors.length.toLocaleString('vi-VN') : '—'}</strong><h3>Bác sĩ đang hoạt động</h3><p>Trong danh sách hiện tại</p></article>
      <article><span className="reception-doctors-metric-icon violet"><Stethoscope size={21} aria-hidden="true" /></span><strong>{specialtyCount === null ? '—' : specialtyCount.toLocaleString('vi-VN')}</strong><h3>Chuyên khoa có bác sĩ</h3><p>Đếm từ danh sách bác sĩ đã tải</p></article>
      <article><span className="reception-doctors-metric-icon blue"><Search size={21} aria-hidden="true" /></span><strong>{doctors ? filtered.length.toLocaleString('vi-VN') : '—'}</strong><h3>Kết quả phù hợp</h3><p>Trong bộ lọc hiện tại</p></article>
    </section>

    {error && <Alert tone="error">Không tải được bác sĩ: {error} <button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    {specialtyError && <Alert tone="info">Không tải được danh mục chuyên khoa: {specialtyError}. Vẫn có thể tìm bác sĩ theo thông tin được trả về.</Alert>}

    <div className="reception-doctors-layout">
      <section className="panel reception-doctors-directory" aria-label="Tra cứu bác sĩ">
        <div className="reception-doctors-section-head"><div><span>ĐỘI NGŨ KHÁM BỆNH</span><h3>Danh sách bác sĩ</h3><p>Chỉ gồm bác sĩ đang hoạt động.</p></div><span className="reception-doctors-scope"><ShieldCheck size={14} aria-hidden="true" /> Chỉ tra cứu</span></div>
        <div className="reception-doctors-filters">
          <label><Search size={17} aria-hidden="true" /><span className="reception-doctors-sr-only">Tìm bác sĩ</span>
            <input type="search" aria-label="Tìm bác sĩ" placeholder="Tên bác sĩ, mã hoặc chuyên khoa..." value={search} onChange={(event) => changeFilters(event.target.value, specialtyId)} />
            {search && <button type="button" aria-label="Xóa tìm kiếm" onClick={() => changeFilters('', specialtyId)}><X size={15} /></button>}
          </label>
          <label><Stethoscope size={17} aria-hidden="true" /><span className="reception-doctors-sr-only">Lọc chuyên khoa</span>
            <select aria-label="Lọc chuyên khoa" value={specialtyId} onChange={(event) => changeFilters(search, event.target.value)}><option value="">Tất cả chuyên khoa</option>
              {specialtyChoices.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
            </select></label>
        </div>
        {loading && <p className="reception-doctors-loading" role="status"><RefreshCw size={17} aria-hidden="true" /> Đang tải danh sách bác sĩ...</p>}
        {!loading && doctors && <>
          <div className="reception-doctors-count" aria-live="polite">Hiển thị {visible.length} / {filtered.length} kết quả · {doctors.length} bác sĩ trong danh sách đã tải</div>
          {visible.length > 0 && <div className="reception-doctors-list">{visible.map((doctor) =>
            <button type="button" key={doctor.id} className={`reception-doctors-row${selectedId === doctor.id ? ' is-selected' : ''}`} aria-pressed={selectedId === doctor.id}
              onClick={() => setSelectedId(doctor.id)}>
              <span className="reception-doctors-avatar"><UserRound size={22} aria-hidden="true" /></span>
              <span className="reception-doctors-row-copy"><strong>{doctorName(doctor)}</strong><small><Stethoscope size={13} aria-hidden="true" /> {doctor.specialtyName || 'Chưa cập nhật chuyên khoa'}</small><span>Mã hồ sơ: {doctor.id}</span></span>
              <span className="reception-doctors-row-action">Chi tiết <ArrowRight size={14} aria-hidden="true" /></span>
            </button>)}
          </div>}
          {!filtered.length && <div className="reception-doctors-empty"><Search size={27} aria-hidden="true" /><strong>{doctors.length ? 'Không tìm thấy bác sĩ phù hợp' : 'Chưa có bác sĩ đang hoạt động'}</strong><p>{doctors.length ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.' : 'Hiện chưa có hồ sơ bác sĩ hoạt động.'}</p></div>}
          {filtered.length > PAGE_SIZE && <nav className="reception-doctors-pagination" aria-label="Phân trang bác sĩ lễ tân"><span>Trang {currentPage}/{pageCount}</span><div>
            <button type="button" className="soft-button" disabled={currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} aria-hidden="true" /> Trước</button>
            <button type="button" className="soft-button" disabled={currentPage >= pageCount} onClick={() => { setPage((value) => Math.min(pageCount, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} aria-hidden="true" /></button>
          </div></nav>}
        </>}
        {!loading && !doctors && <p className="reception-doctors-loading">Danh sách bác sĩ chưa khả dụng. Nhấn Thử lại để tải lại.</p>}
      </section>

      <aside className="panel reception-doctors-detail" aria-label="Chi tiết bác sĩ và lịch làm việc">
        <div className="reception-doctors-section-head"><div><span>THÔNG TIN TRA CỨU</span><h3>{selected ? doctorName(selected) : 'Hồ sơ & lịch làm việc'}</h3><p>Thông tin bác sĩ và lịch làm việc.</p></div>
          {selected && <button type="button" className="reception-doctors-close" aria-label="Đóng chi tiết bác sĩ" onClick={() => setSelectedId('')}><X size={17} /></button>}</div>
        {!selected ? <div className="reception-doctors-detail-placeholder"><BookOpen size={36} aria-hidden="true" /><strong>Chọn bác sĩ để xem chi tiết</strong><p>Xem chuyên khoa, mã hồ sơ và lịch làm việc trong tuần trước khi đến bước đặt lịch.</p></div> : <>
          <div className="reception-doctors-detail-person"><span className="reception-doctors-avatar large"><UserRound size={30} aria-hidden="true" /></span><div><strong>{doctorName(selected)}</strong><span><Stethoscope size={15} aria-hidden="true" /> {selected.specialtyName || 'Chưa cập nhật chuyên khoa'}</span></div></div>
          <dl className="reception-doctors-facts"><div><dt><IdCard size={15} aria-hidden="true" /> Mã hồ sơ bác sĩ</dt><dd>{selected.id}</dd></div>
            <div><dt><Stethoscope size={15} aria-hidden="true" /> Chuyên khoa</dt><dd>{selected.specialtyName || 'Chưa có dữ liệu'}</dd></div>
            <div><dt><ClipboardList size={15} aria-hidden="true" /> Phí khám tham khảo (VND)</dt><dd>{selected.consultationFee == null ? 'Chưa cập nhật' : formatVnd(selected.consultationFee)}</dd></div></dl>
          {selected.biography?.trim() && <div className="reception-doctors-biography"><h4>Giới thiệu chuyên môn</h4><p>{selected.biography}</p></div>}
          <div className="reception-doctors-schedules"><h4><CalendarClock size={19} aria-hidden="true" /> Lịch làm việc trong tuần</h4>
            {scheduleLoading && <p role="status" className="reception-doctors-loading">Đang tải lịch làm việc...</p>}
            {scheduleError && <Alert tone="error">Không tải được lịch làm việc: {scheduleError} <button type="button" className="soft-button" onClick={() => setSelectedId('')}>Đóng</button></Alert>}
            {!scheduleLoading && schedules?.length === 0 && <p className="reception-doctors-schedule-empty">Chưa có ca làm việc nào.</p>}
            {schedules?.map((schedule, index) => <div className="reception-doctors-shift" key={schedule.id || `${schedule.dayOfWeek}-${schedule.startTime}-${index}`}><span>{weekdays[schedule.dayOfWeek - 1]}</span><strong><Clock3 size={15} aria-hidden="true" /> {formatTime(schedule.startTime)} – {formatTime(schedule.endTime)}</strong></div>)}
          </div>
          <p className="reception-doctors-note"><ShieldCheck size={17} aria-hidden="true" /> Giá khám hiển thị bằng VND. Lịch làm việc không đảm bảo còn chỗ; hãy kiểm tra khi đặt lịch.</p>
          {onAppointments && <button type="button" className="reception-doctors-go" onClick={onAppointments}><CalendarClock size={17} aria-hidden="true" /> Đến trang Lịch hẹn <ArrowRight size={16} aria-hidden="true" /></button>}
        </>}
      </aside>
    </div>
  </div>;
}
