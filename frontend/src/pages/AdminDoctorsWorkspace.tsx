import { type FormEvent, useEffect, useState } from 'react';
import {
  ArrowRight, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  ClipboardCheck, IdCard, Pencil, Plus, RefreshCw, Search, ShieldCheck, Stethoscope,
  UserRoundX, UsersRound, X
} from 'lucide-react';
import {
  createAdminDoctor, deactivateAdminDoctor, getAdminDoctor, getAdminDoctorSchedules,
  getAdminDoctors, getSpecialties, updateAdminDoctor
} from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type {
  AdminDoctorResponse, AdminDoctorSchedule, CreateAdminDoctorRequest, PageResponse,
  SpecialtyResponse
} from '../types/domain';
import { formatMoney, formatTime, shortId } from '../utils/format';
import { filterAdminDoctorPage, type DoctorStatusFilter } from '../utils/doctorDirectory';

const PAGE_SIZE = 20;
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const feePattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
type DoctorForm = CreateAdminDoctorRequest & { active: boolean };
const initialForm: DoctorForm = { userId: '', specialtyId: '', biography: '', consultationFee: '', active: true };

function apiMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Yêu cầu bác sĩ không thành công.';
}

export default function AdminDoctorsWorkspace() {
  const [pageNumber, setPageNumber] = useState(0);
  const [revision, setRevision] = useState(0);
  const [directory, setDirectory] = useState<PageResponse<AdminDoctorResponse> | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyResponse[] | null>(null);
  const [specialtyError, setSpecialtyError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<DoctorStatusFilter>('ALL');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<AdminDoctorResponse | null>(null);
  const [schedules, setSchedules] = useState<AdminDoctorSchedule[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<DoctorForm>(initialForm);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true); setError(null); setDirectory(null);
    void getAdminDoctors(pageNumber, PAGE_SIZE).then((result) => {
      if (!current) return;
      if (!result || !Array.isArray(result.content) || !Number.isInteger(result.totalElements)
        || !Number.isInteger(result.totalPages) || result.number !== pageNumber) {
        throw new Error('Phản hồi phân trang bác sĩ không hợp lệ.');
      }
      setDirectory(result);
    }).catch((cause: unknown) => { if (current) setError(apiMessage(cause)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [pageNumber, revision]);

  useEffect(() => {
    let current = true;
    void getSpecialties().then((items) => {
      if (!current) return;
      if (!Array.isArray(items)) throw new Error('Danh sách chuyên khoa không hợp lệ.');
      setSpecialties(items); setSpecialtyError(null);
    }).catch((cause: unknown) => {
      if (current) { setSpecialties(null); setSpecialtyError(apiMessage(cause)); }
    });
    return () => { current = false; };
  }, [revision]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setSchedules(null); setDetailError(null); setScheduleError(null); return; }
    let current = true;
    setDetail(null); setSchedules(null); setDetailError(null); setScheduleError(null); setDetailLoading(true);
    void Promise.allSettled([getAdminDoctor(selectedId), getAdminDoctorSchedules(selectedId)]).then(([doctor, times]) => {
      if (!current) return;
      if (doctor.status === 'fulfilled' && doctor.value.id === selectedId) setDetail(doctor.value);
      else setDetailError(doctor.status === 'rejected' ? apiMessage(doctor.reason) : 'Máy chủ trả sai hồ sơ bác sĩ.');
      if (times.status === 'fulfilled' && Array.isArray(times.value)) setSchedules(times.value);
      else setScheduleError(times.status === 'rejected' ? apiMessage(times.reason) : 'Lịch làm việc không hợp lệ.');
    }).finally(() => { if (current) setDetailLoading(false); });
    return () => { current = false; };
  }, [selectedId, revision]);

  const rows = directory?.content ?? [];
  const filtered = filterAdminDoctorPage(rows, query, specialtyFilter, statusFilter);
  const numberOfPages = Math.max(1, directory?.totalPages ?? 1);
  const loadedActive = rows.filter((doctor) => doctor.active).length;
  const loadedSpecialties = new Set(rows.map((doctor) => doctor.specialtyId).filter(Boolean)).size;
  const filterSpecialties = specialties ?? [...new Map(rows.filter((item) => item.specialtyId)
    .map((item) => [item.specialtyId, { id: item.specialtyId!, name: item.specialtyName || shortId(item.specialtyId), description: null }])).values()];

  function select(id: string) {
    setSelectedId(id); setConfirmDeactivate(false); setFormMode(null);
  }

  function beginCreate() {
    setFormMode('create'); setForm(initialForm); setConfirmDeactivate(false); setError(null); setNotice(null);
  }

  function beginEdit(item: AdminDoctorResponse) {
    setSelectedId(item.id); setConfirmDeactivate(false);
    setForm({ userId: item.userId, specialtyId: item.specialtyId ?? '',
      biography: item.biography ?? '', consultationFee: item.consultationFee == null ? '' : String(item.consultationFee), active: item.active });
    setFormMode('edit'); setError(null); setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !formMode) return;
    if ((formMode === 'create' && !uuid.test(form.userId)) || !uuid.test(form.specialtyId) ||
      !feePattern.test(form.consultationFee) || form.biography.length > 10000 ||
      !specialties?.some((item) => item.id === form.specialtyId)) {
      setError('Kiểm tra UUID tài khoản, chuyên khoa từ danh mục và mức phí hợp lệ (tối đa 10 chữ số, 2 số thập phân).');
      return;
    }
    const mode = formMode;
    const target = selectedId;
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = mode === 'create'
        ? await createAdminDoctor({ userId: form.userId, specialtyId: form.specialtyId,
          biography: form.biography, consultationFee: form.consultationFee })
        : await updateAdminDoctor(target, { specialtyId: form.specialtyId, biography: form.biography,
          consultationFee: form.consultationFee, active: form.active });
      if (!response.id || response.specialtyId !== form.specialtyId || response.active !== (mode === 'create' ? true : form.active)
        || (mode === 'create' && response.userId !== form.userId) || (mode === 'edit' && response.id !== target)) {
        throw new Error('Máy chủ chưa xác nhận thông tin vừa lưu; hãy tải lại trước khi thao tác tiếp.');
      }
      setFormMode(null); setSelectedId(response.id); setConfirmDeactivate(false);
      if (mode === 'create') setPageNumber(0);
      setNotice(mode === 'create' ? 'Đã tạo hồ sơ bác sĩ theo xác nhận từ máy chủ.' : 'Đã cập nhật hồ sơ bác sĩ theo xác nhận từ máy chủ.');
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  }

  async function deactivate() {
    if (!detail?.active || busy || !confirmDeactivate) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await deactivateAdminDoctor(detail.id);
      if (result.id !== detail.id || result.active) throw new Error('Máy chủ chưa xác nhận ngừng hoạt động.');
      setNotice('Đã ngừng hoạt động hồ sơ bác sĩ theo xác nhận từ máy chủ.');
      setConfirmDeactivate(false); setFormMode(null); setRevision((value) => value + 1);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  }

  return <div className="doctors-workspace">
    <PageHeader title="Bác sĩ" subtitle="Quản lý đội ngũ, chuyên khoa và lịch làm việc trong phạm vi quản trị"
      actions={<><button type="button" className="soft-button" disabled={busy || loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Làm mới</button>
        <button type="button" disabled={busy} onClick={beginCreate}><Plus size={17} /> Thêm bác sĩ</button></>} />

    <section className="doctors-hero" aria-label="Giới thiệu quản lý bác sĩ">
      <div><span className="doctors-kicker"><ShieldCheck size={15} /> KHÔNG GIAN QUẢN TRỊ</span>
        <h3>Đội ngũ chuyên môn, quản lý tập trung.</h3>
        <p>Tra cứu bác sĩ, theo dõi chuyên khoa, xem lịch làm việc và cập nhật hồ sơ qua API quản trị thực tế.</p>
        <span className="doctors-hero-caption"><ClipboardCheck size={15} /> Thông tin từ hệ thống · Không sử dụng dữ liệu mẫu</span>
      </div><span className="doctors-hero-icon" aria-hidden="true"><Stethoscope size={73} strokeWidth={1.4} /></span>
    </section>

    {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Thử tải lại</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {specialtyError && <Alert tone="info">Chưa tải được danh mục chuyên khoa: {specialtyError}. Vẫn có thể xem danh sách bác sĩ; biểu mẫu sẽ chờ danh mục hợp lệ.</Alert>}

    {formMode && <section className="panel doctors-form-panel" aria-label={formMode === 'create' ? 'Thêm bác sĩ' : 'Sửa thông tin bác sĩ'}>
      <div className="doctors-section-head"><div><span className="doctors-section-kicker">{formMode === 'create' ? 'HỒ SƠ MỚI' : 'CẬP NHẬT HỒ SƠ'}</span><h3>{formMode === 'create' ? 'Tạo hồ sơ bác sĩ' : `Chỉnh sửa bác sĩ #${shortId(selectedId)}`}</h3>
        <p>{formMode === 'create' ? 'Tài khoản Identity phải tồn tại, đang hoạt động và có ROLE_DOCTOR; thao tác này không tạo tài khoản đăng nhập.' : 'Chuyên khoa, phí khám và trạng thái được ghi trực tiếp qua API Admin.'}</p></div>
        <button type="button" className="soft-button" disabled={busy} onClick={() => setFormMode(null)}><X size={16} /> Đóng</button></div>
      <form className="doctors-form" onSubmit={(event) => void submit(event)}>
        {formMode === 'create' && <label>UUID tài khoản bác sĩ (Identity)<input required aria-label="UUID tài khoản bác sĩ" value={form.userId} onChange={(event) => setForm({ ...form, userId: event.target.value.trim() })} placeholder="UUID tài khoản có ROLE_DOCTOR" /></label>}
        <label>Chuyên khoa<select required value={form.specialtyId} onChange={(event) => setForm({ ...form, specialtyId: event.target.value })} disabled={!specialties?.length}>
          <option value="">{specialties?.length ? 'Chọn chuyên khoa từ danh mục' : 'Chưa có danh mục chuyên khoa'}</option>
          {specialties?.map((specialty) => <option value={specialty.id} key={specialty.id}>{specialty.name}</option>)}</select></label>
        <label>Phí khám (API không cung cấp đơn vị tiền tệ)<input required inputMode="decimal" value={form.consultationFee} onChange={(event) => setForm({ ...form, consultationFee: event.target.value })} placeholder="Ví dụ: 150000.00" pattern="(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?" /></label>
        {formMode === 'edit' && <label>Trạng thái<select value={form.active ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setForm({ ...form, active: event.target.value === 'ACTIVE' })}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>}
        <label className="doctors-form-wide">Giới thiệu / tiểu sử<textarea rows={4} maxLength={10000} value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} placeholder="Không bắt buộc" /></label>
        <div className="doctors-form-actions"><button type="submit" disabled={busy || !specialties?.length}>{busy ? 'Đang lưu...' : formMode === 'create' ? 'Xác nhận tạo hồ sơ' : 'Lưu thay đổi'} <ArrowRight size={16} /></button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => setFormMode(null)}>Hủy</button></div>
      </form>
    </section>}

    {loading && <p role="status" className="doctors-loading">Đang tải danh sách bác sĩ từ API quản trị...</p>}
    {directory && <>
      <section className="doctors-metrics" aria-label="Thống kê bác sĩ">
        <article className="doctors-metric"><span className="doctors-metric-icon"><UsersRound size={21} /></span><strong>{directory.totalElements.toLocaleString('vi-VN')}</strong><h3>Tổng hồ sơ bác sĩ</h3><p>Tổng do API phân trang cung cấp</p></article>
        <article className="doctors-metric doctors-metric-green"><span className="doctors-metric-icon"><CheckCircle2 size={21} /></span><strong>{loadedActive.toLocaleString('vi-VN')}</strong><h3>Đang hoạt động · trang này</h3><p>Trong {rows.length} hồ sơ đã tải</p></article>
        <article className="doctors-metric doctors-metric-purple"><span className="doctors-metric-icon"><Stethoscope size={21} /></span><strong>{loadedSpecialties.toLocaleString('vi-VN')}</strong><h3>Chuyên khoa · trang này</h3><p>Số chuyên khoa khác nhau trong trang</p></article>
      </section>

      <section className="panel doctors-directory" aria-label="Danh sách bác sĩ">
        <div className="doctors-section-head"><div><span className="doctors-section-kicker">DANH SÁCH BÁC SĨ</span><h3>Hồ sơ đội ngũ</h3>
          <p>Trang {pageNumber + 1}/{numberOfPages} · {rows.length} hồ sơ đã tải · {filtered.length} hồ sơ phù hợp bộ lọc trang này</p></div><span className="doctors-source">Dữ liệu API thực</span></div>
        <div className="doctors-filters">
          <label className="doctors-filter doctors-search"><Search size={17} /><span className="doctors-sr-only">Tìm bác sĩ trong trang</span><input aria-label="Tìm bác sĩ trong trang" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm mã bác sĩ, mã tài khoản, chuyên khoa..." /></label>
          <label className="doctors-filter"><Stethoscope size={16} /><span className="doctors-sr-only">Lọc chuyên khoa trang hiện tại</span><select aria-label="Lọc chuyên khoa trang hiện tại" value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}><option value="">Tất cả chuyên khoa</option>
            {filterSpecialties.map((specialty) => <option value={specialty.id} key={specialty.id}>{specialty.name}</option>)}</select></label>
          <label className="doctors-filter"><span className="doctors-sr-only">Lọc trạng thái trang hiện tại</span><select aria-label="Lọc trạng thái trang hiện tại" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DoctorStatusFilter)}>
            <option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
        </div>
        <div className="doctors-table-scroll" tabIndex={0} aria-label="Bảng bác sĩ cuộn ngang khi cần">
          <table className="doctors-table"><thead><tr><th scope="col">Bác sĩ</th><th scope="col">Chuyên khoa</th><th scope="col">Mã tài khoản</th><th scope="col">Phí khám*</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{filtered.map((doctor) => <tr key={doctor.id} className={doctor.id === selectedId ? 'is-selected' : undefined}>
              <td><span className="doctors-person"><span className="doctors-avatar"><Stethoscope size={19} /></span><span><strong>Bác sĩ #{shortId(doctor.id)}</strong><small>ID: {doctor.id}</small></span></span></td>
              <td>{doctor.specialtyName || 'Chưa có chuyên khoa'}</td><td><span className="doctors-nowrap" title={doctor.userId}>{shortId(doctor.userId)}</span></td>
              <td className="doctors-nowrap">{doctor.consultationFee == null ? 'Chưa có' : formatMoney(doctor.consultationFee)}</td>
              <td><span className={`doctors-state ${doctor.active ? 'active' : 'inactive'}`}>{doctor.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
              <td><button type="button" className="doctors-row-action" onClick={() => select(doctor.id)} aria-label={`Xem bác sĩ ${shortId(doctor.id)}`}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="doctors-empty" role="status">{rows.length ? 'Không có bác sĩ phù hợp trong trang này. Thử xóa bộ lọc hoặc chuyển trang.' : 'Chưa có hồ sơ bác sĩ ở trang này.'}</p>}
        <div className="doctors-directory-foot"><p>*API bác sĩ chưa cung cấp đơn vị tiền tệ. Tìm kiếm và bộ lọc chỉ áp dụng cho trang đã tải, không phải toàn bộ cơ sở dữ liệu.</p>
          <nav aria-label="Phân trang bác sĩ" className="doctors-pagination"><button type="button" className="soft-button" disabled={busy || loading || pageNumber === 0} onClick={() => { setPageNumber((value) => value - 1); select(''); }}><ChevronLeft size={16} /> Trước</button>
            <span>Trang {pageNumber + 1}/{numberOfPages}</span><button type="button" className="soft-button" disabled={busy || loading || pageNumber + 1 >= numberOfPages} onClick={() => { setPageNumber((value) => value + 1); select(''); }}>Sau <ChevronRight size={16} /></button></nav></div>
      </section>
    </>}

    {selectedId && <section className="panel doctors-detail" aria-label="Chi tiết bác sĩ">
      <div className="doctors-section-head"><div><span className="doctors-section-kicker">HỒ SƠ QUẢN TRỊ</span><h3>Thông tin bác sĩ</h3></div>
        <button type="button" className="soft-button" disabled={busy} onClick={() => select('')}><X size={16} /> Đóng chi tiết</button></div>
      {detailLoading && <p role="status">Đang xác minh hồ sơ và lịch làm việc...</p>}
      {detailError && <Alert tone="error">{detailError}</Alert>}
      {detail && <>
        <div className="doctors-detail-heading"><span className="doctors-avatar large"><Stethoscope size={30} /></span><div><h4>Bác sĩ #{shortId(detail.id)}</h4><p>Mã hồ sơ: {detail.id}</p><span className={`doctors-state ${detail.active ? 'active' : 'inactive'}`}>{detail.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></div></div>
        <dl className="doctors-detail-fields"><div><dt><IdCard size={15} /> Mã tài khoản Identity</dt><dd>{detail.userId}</dd></div><div><dt><Stethoscope size={15} /> Chuyên khoa</dt><dd>{detail.specialtyName || 'Chưa có chuyên khoa'}</dd></div>
          <div><dt>Phí khám (đơn vị chưa xác định)</dt><dd>{detail.consultationFee == null ? 'Chưa có' : formatMoney(detail.consultationFee)}</dd></div><div><dt>Giới thiệu</dt><dd>{detail.biography?.trim() || 'Chưa cập nhật tiểu sử.'}</dd></div></dl>
        <div className="doctors-detail-actions"><button type="button" disabled={busy} onClick={() => beginEdit(detail)}><Pencil size={16} /> Chỉnh sửa hồ sơ</button>
          {detail.active && <button type="button" className="soft-button danger" disabled={busy} onClick={() => setConfirmDeactivate(true)}><UserRoundX size={16} /> Ngừng hoạt động</button>}</div>
        {confirmDeactivate && <div className="doctors-confirm" role="group" aria-label="Xác nhận ngừng hoạt động"><CircleAlert size={21} /><div><strong>Xác nhận ngừng hoạt động bác sĩ #{shortId(detail.id)}?</strong><p>Thao tác sẽ ghi vào hệ thống thực. Không xóa dữ liệu hồ sơ.</p><div><button type="button" className="danger" disabled={busy} onClick={() => void deactivate()}>Xác nhận ngừng hoạt động</button><button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmDeactivate(false)}>Giữ nguyên</button></div></div></div>}
      </>}
      <div className="doctors-schedule"><h4><CalendarClock size={18} /> Lịch làm việc</h4>
        {scheduleError && <Alert tone="info">Không tải được lịch làm việc: {scheduleError}</Alert>}
        {schedules?.length === 0 && <p>Chưa có lịch làm việc được trả về.</p>}
        {schedules?.map((item) => <div className="doctors-schedule-row" key={item.id}><span>{weekdays[item.dayOfWeek - 1] ?? `Ngày ${item.dayOfWeek}`}</span><strong>{formatTime(item.startTime)} – {formatTime(item.endTime)}</strong></div>)}
      </div>
      <p className="doctors-data-note"><ShieldCheck size={15} /> Chỉ hiển thị thông tin hồ sơ và lịch làm việc theo quyền Admin. API chưa cung cấp tên, email hoặc ảnh bác sĩ.</p>
    </section>}
  </div>;
}