import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  ClipboardCheck, IdCard, Pencil, Plus, RefreshCw, Search, ShieldCheck, Stethoscope,
  UserRoundX, UsersRound, X
} from 'lucide-react';
import {
  createAdminDoctor, deactivateAdminDoctor, getAdminDoctor, getAdminDoctorSchedules,
  getAdminDoctors, getAdminUser, getSpecialties, updateAdminDoctor
} from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import type {
  AdminDoctorResponse, AdminDoctorSchedule, CreateAdminDoctorRequest, PageResponse,
  SpecialtyResponse
} from '../types/domain';
import { formatTime, formatVnd, shortId } from '../utils/format';
import { doctorDisplayName, filterAdminDoctorPage, type DoctorStatusFilter } from '../utils/doctorDirectory';
import './adminDoctorsUx.css';

const PAGE_SIZE = 20;
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const feePattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
type DoctorForm = CreateAdminDoctorRequest & { active: boolean };
type DoctorField = 'userId' | 'specialtyId' | 'consultationFee';
type DoctorFieldErrors = Partial<Record<DoctorField, string>>;
const initialForm: DoctorForm = { userId: '', specialtyId: '', biography: '', consultationFee: '', active: true };

export function groupDoctorSchedules(items: AdminDoctorSchedule[]) {
  const days = new Map<number, AdminDoctorSchedule[]>();
  for (const item of items) {
    const slots = days.get(item.dayOfWeek) ?? [];
    slots.push(item);
    days.set(item.dayOfWeek, slots);
  }
  return [...days.entries()].sort(([a], [b]) => a - b).map(([dayOfWeek, slots]) => ({
    dayOfWeek,
    slots: slots.sort((a, b) => a.startTime.localeCompare(b.startTime))
  }));
}

function apiMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Yêu cầu bác sĩ không thành công.';
}

function fieldMessage(field: DoctorField, value: string, mode: 'create' | 'edit', specialties: SpecialtyResponse[] | null): string | undefined {
  if (field === 'userId' && mode === 'create' && !uuid.test(value)) return 'Nhập mã tài khoản hợp lệ.';
  if (field === 'specialtyId' && (!uuid.test(value) || !specialties?.some((item) => item.id === value))) return 'Chọn chuyên khoa từ danh mục.';
  if (field === 'consultationFee' && !feePattern.test(value)) return 'Nhập mức phí hợp lệ (tối đa 10 chữ số, 2 số thập phân).';
  return undefined;
}

function validateFields(form: DoctorForm, mode: 'create' | 'edit', specialties: SpecialtyResponse[] | null): DoctorFieldErrors {
  const errors: DoctorFieldErrors = {};
  (['userId', 'specialtyId', 'consultationFee'] as DoctorField[]).forEach((field) => {
    const message = fieldMessage(field, form[field], mode, specialties);
    if (message) errors[field] = message;
  });
  return errors;
}

export default function AdminDoctorsWorkspace() {
  const [pageNumber, setPageNumber] = useState(0);
  const [revision, setRevision] = useState(0);
  const [directory, setDirectory] = useState<PageResponse<AdminDoctorResponse> | null>(null);
  const [namesByUserId, setNamesByUserId] = useState<Record<string, string>>({});
  const [accountCodesByUserId, setAccountCodesByUserId] = useState<Record<string, string>>({});
  const [namesLoading, setNamesLoading] = useState(false);
  const [namesMissing, setNamesMissing] = useState(0);
  const [nameLookupError, setNameLookupError] = useState<string | null>(null);
  const [nameRevision, setNameRevision] = useState(0);
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
  const [detailView, setDetailView] = useState<'profile' | 'schedule'>('profile');
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<DoctorForm>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<DoctorFieldErrors>({});
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const detailPanelRef = useRef<HTMLElement>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);
  const rowActionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const restoreDetailFocusId = useRef('');

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
    setNamesByUserId({});
    setAccountCodesByUserId({});
    setNamesMissing(0);
    setNameLookupError(null);
    if (!directory) { setNamesLoading(false); return; }
    const ids = [...new Set(directory.content.map((doctor) => doctor.userId).filter(Boolean))];
    if (!ids.length) { setNamesLoading(false); return; }
    setNamesLoading(true);
    // The account lookup is admin-only. Limit parallel requests to protect Identity.
    void (async () => {
      const names: Record<string, string> = {};
      const codes: Record<string, string> = {};
      let missing = 0;
      let failure: string | null = null;
      for (let index = 0; index < ids.length && current; index += 4) {
        const batch = await Promise.allSettled(ids.slice(index, index + 4).map((id) => getAdminUser(id)));
        if (!current) return;
        batch.forEach((result, offset) => {
          const id = ids[index + offset];
          if (result.status === 'fulfilled' && result.value?.id === id && typeof result.value.fullName === 'string'
            && result.value.fullName.trim()) {
            names[id] = result.value.fullName.trim();
            if (typeof result.value.accountCode === 'string' && /^TK\d{6,}$/.test(result.value.accountCode)) codes[id] = result.value.accountCode;
          }
          else {
            missing += 1;
            if (!failure) failure = result.status === 'rejected' ? apiMessage(result.reason)
              : 'Identity Service không trả về tên hoặc mã tài khoản không khớp.';
          }
        });
        setNamesByUserId({ ...names });
        setAccountCodesByUserId({ ...codes });
      }
      if (current) { setNamesMissing(missing); setNameLookupError(failure); }
    })().finally(() => { if (current) setNamesLoading(false); });
    return () => { current = false; };
  }, [directory, nameRevision]);

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
      else setDetailError(doctor.status === 'rejected' ? apiMessage(doctor.reason) : 'Không thể tải đúng hồ sơ bác sĩ.');
      if (times.status === 'fulfilled' && Array.isArray(times.value)) setSchedules(times.value);
      else setScheduleError(times.status === 'rejected' ? apiMessage(times.reason) : 'Lịch làm việc không hợp lệ.');
    }).finally(() => { if (current) setDetailLoading(false); });
    return () => { current = false; };
  }, [selectedId, revision]);

  useEffect(() => {
    const focus = () => {
      if (selectedId && !formMode) detailPanelRef.current?.focus({ preventScroll: true });
      else if (restoreDetailFocusId.current) {
        const id = restoreDetailFocusId.current;
        restoreDetailFocusId.current = '';
        rowActionRefs.current[id]?.focus({ preventScroll: true });
      }
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focus);
    else focus();
  }, [selectedId, formMode]);

  useEffect(() => {
    if (!selectedId || formMode) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedId, formMode]);

  const rows = directory?.content ?? [];
  const filtered = filterAdminDoctorPage(rows, query, specialtyFilter, statusFilter, namesByUserId, accountCodesByUserId);
  const numberOfPages = Math.max(1, directory?.totalPages ?? 1);
  const loadedActive = rows.filter((doctor) => doctor.active).length;
  const loadedSpecialties = new Set(rows.map((doctor) => doctor.specialtyId).filter(Boolean)).size;
  const filterSpecialties = specialties ?? [...new Map(rows.filter((item) => item.specialtyId)
    .map((item) => [item.specialtyId, { id: item.specialtyId!, name: item.specialtyName || shortId(item.specialtyId), description: null }])).values()];
  const groupedSchedules = groupDoctorSchedules(schedules ?? []);

  function showDetailView(view: 'profile' | 'schedule') {
    setDetailView(view);
    detailContentRef.current?.scrollTo({ top: 0 });
  }

  function select(id: string) {
    if (id) restoreDetailFocusId.current = '';
    setDetailView('profile');
    setSelectedId(id); setConfirmDeactivate(false); setFormMode(null);
  }

  function closeDetail() {
    if (busy) return;
    restoreDetailFocusId.current = selectedId;
    select('');
  }

  function handleDetailKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeDetail();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(detailPanelRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === detailPanelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === detailPanelRef.current)) {
      event.preventDefault();
      first.focus();
    }
  }

  function beginCreate() {
    setFormMode('create'); setForm(initialForm); setFieldErrors({}); setConfirmDeactivate(false); setError(null); setNotice(null);
  }

  function beginEdit(item: AdminDoctorResponse) {
    setSelectedId(item.id); setConfirmDeactivate(false);
    setForm({ userId: item.userId, specialtyId: item.specialtyId ?? '',
      biography: item.biography ?? '', consultationFee: item.consultationFee == null ? '' : String(item.consultationFee), active: item.active });
    setFormMode('edit'); setFieldErrors({}); setError(null); setNotice(null);
  }

  function updateField(field: DoctorField, value: string) {
    const nextForm = { ...form, [field]: value } as DoctorForm;
    setForm(nextForm);
    if (formMode) setFieldErrors((previous) => ({ ...previous, [field]: fieldMessage(field, value, formMode, specialties) }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !formMode) return;
    const nextFieldErrors = validateFields(form, formMode, specialties);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length || form.biography.length > 10000) {
      setError('Kiểm tra các trường được đánh dấu trước khi lưu.');
      const firstInvalid = (['userId', 'specialtyId', 'consultationFee'] as DoctorField[]).find((field) => nextFieldErrors[field]);
      if (firstInvalid && typeof document !== 'undefined') document.getElementById(`doctor-${firstInvalid}`)?.focus();
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
        throw new Error('Thông tin vừa lưu chưa được xác nhận; hãy tải lại trước khi thao tác tiếp.');
      }
      setFormMode(null); setSelectedId(response.id); setConfirmDeactivate(false);
      if (mode === 'create') setPageNumber(0);
      setNotice(mode === 'create' ? 'Đã tạo hồ sơ bác sĩ.' : 'Đã cập nhật hồ sơ bác sĩ.');
      setRevision((value) => value + 1);
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setBusy(false); }
  }

  async function deactivate() {
    if (!detail?.active || busy || !confirmDeactivate) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await deactivateAdminDoctor(detail.id);
      if (result.id !== detail.id || result.active) throw new Error('Chưa xác nhận được trạng thái ngừng hoạt động.');
      setNotice('Đã ngừng hoạt động hồ sơ bác sĩ.');
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
        <p>Tra cứu bác sĩ, theo dõi chuyên khoa, xem lịch làm việc và cập nhật hồ sơ.</p>
        <span className="doctors-hero-caption"><ClipboardCheck size={15} /> Danh sách bác sĩ và lịch làm việc</span>
      </div><span className="doctors-hero-icon" aria-hidden="true"><Stethoscope size={73} strokeWidth={1.4} /></span>
    </section>

    {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Thử tải lại</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {specialtyError && <Alert tone="info">Chưa tải được danh mục chuyên khoa: {specialtyError}. Vẫn có thể xem danh sách bác sĩ; biểu mẫu sẽ chờ danh mục hợp lệ.</Alert>}
    {namesMissing > 0 && <Alert tone="error">Không tải được tên của {namesMissing} bác sĩ từ Identity Service: {nameLookupError ?? 'Không có thông tin lỗi.'} <button type="button" className="soft-button" disabled={namesLoading} onClick={() => setNameRevision((value) => value + 1)}>Tải lại tên bác sĩ</button></Alert>}

    {formMode && <section className="panel doctors-form-panel" aria-label={formMode === 'create' ? 'Thêm bác sĩ' : 'Sửa thông tin bác sĩ'}>
      <div className="doctors-section-head"><div><span className="doctors-section-kicker">{formMode === 'create' ? 'HỒ SƠ MỚI' : 'CẬP NHẬT HỒ SƠ'}</span><h3>{formMode === 'create' ? 'Tạo hồ sơ bác sĩ' : `Chỉnh sửa bác sĩ #${shortId(selectedId)}`}</h3>
        <p>{formMode === 'create' ? 'UUID tài khoản phải tồn tại và đang hoạt động. Mã TK chỉ dùng để hiển thị, không thay UUID ở biểu mẫu này.' : 'Cập nhật chuyên khoa, phí khám và trạng thái hồ sơ.'}</p></div>
        <button type="button" className="soft-button" disabled={busy} onClick={() => setFormMode(null)}><X size={16} /> Đóng</button></div>
      <form className="doctors-form" noValidate onSubmit={(event) => void submit(event)}>
        {formMode === 'create' && <label htmlFor="doctor-userId">UUID tài khoản bác sĩ<input id="doctor-userId" required aria-label="UUID tài khoản bác sĩ" aria-invalid={Boolean(fieldErrors.userId)} aria-describedby={fieldErrors.userId ? 'doctor-userId-error' : undefined} value={form.userId} onChange={(event) => updateField('userId', event.target.value.trim())} placeholder="Nhập UUID tài khoản" />{fieldErrors.userId && <span id="doctor-userId-error" className="doctors-field-error" role="alert">{fieldErrors.userId}</span>}</label>}
        <label htmlFor="doctor-specialtyId">Chuyên khoa<select id="doctor-specialtyId" required aria-invalid={Boolean(fieldErrors.specialtyId)} aria-describedby={fieldErrors.specialtyId ? 'doctor-specialtyId-error' : undefined} value={form.specialtyId} onChange={(event) => updateField('specialtyId', event.target.value)} disabled={!specialties?.length}>
          <option value="">{specialties?.length ? 'Chọn chuyên khoa từ danh mục' : 'Chưa có danh mục chuyên khoa'}</option>
          {specialties?.map((specialty) => <option value={specialty.id} key={specialty.id}>{specialty.name}</option>)}</select>{fieldErrors.specialtyId && <span id="doctor-specialtyId-error" className="doctors-field-error" role="alert">{fieldErrors.specialtyId}</span>}</label>
        <label htmlFor="doctor-consultationFee">Phí khám (VND)<input id="doctor-consultationFee" required inputMode="decimal" aria-invalid={Boolean(fieldErrors.consultationFee)} aria-describedby={fieldErrors.consultationFee ? 'doctor-consultationFee-error' : undefined} value={form.consultationFee} onChange={(event) => updateField('consultationFee', event.target.value)} placeholder="Ví dụ: 150000.00" pattern="(0|[1-9][0-9]{0,9})(\.[0-9]{1,2})?" />{fieldErrors.consultationFee && <span id="doctor-consultationFee-error" className="doctors-field-error" role="alert">{fieldErrors.consultationFee}</span>}</label>
        {formMode === 'edit' && <label>Trạng thái<select value={form.active ? 'ACTIVE' : 'INACTIVE'} onChange={(event) => setForm({ ...form, active: event.target.value === 'ACTIVE' })}><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>}
        <label className="doctors-form-wide">Giới thiệu / tiểu sử<textarea rows={4} maxLength={10000} value={form.biography} onChange={(event) => setForm({ ...form, biography: event.target.value })} placeholder="Không bắt buộc" /></label>
        <div className="doctors-form-actions"><button type="submit" disabled={busy || !specialties?.length}>{busy ? 'Đang lưu...' : formMode === 'create' ? 'Xác nhận tạo hồ sơ' : 'Lưu thay đổi'} <ArrowRight size={16} /></button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => setFormMode(null)}>Hủy</button></div>
      </form>
    </section>}

    {loading && <p role="status" className="doctors-loading">Đang tải danh sách bác sĩ...</p>}
    {directory && <>
      <section className="doctors-metrics" aria-label="Thống kê bác sĩ">
        <article className="doctors-metric"><span className="doctors-metric-icon"><UsersRound size={21} /></span><strong>{directory.totalElements.toLocaleString('vi-VN')}</strong><h3>Tổng hồ sơ bác sĩ</h3><p>Tổng hồ sơ trong danh sách</p></article>
        <article className="doctors-metric doctors-metric-green"><span className="doctors-metric-icon"><CheckCircle2 size={21} /></span><strong>{loadedActive.toLocaleString('vi-VN')}</strong><h3>Đang hoạt động · trang này</h3><p>Trong {rows.length} hồ sơ đã tải</p></article>
        <article className="doctors-metric doctors-metric-purple"><span className="doctors-metric-icon"><Stethoscope size={21} /></span><strong>{loadedSpecialties.toLocaleString('vi-VN')}</strong><h3>Chuyên khoa · trang này</h3><p>Số chuyên khoa khác nhau trong trang</p></article>
      </section>

      <section className="panel doctors-directory" aria-label="Danh sách bác sĩ">
        <div className="doctors-section-head"><div><span className="doctors-section-kicker">DANH SÁCH BÁC SĨ</span><h3>Hồ sơ đội ngũ</h3>
          <p>Trang {pageNumber + 1}/{numberOfPages} · {rows.length} hồ sơ · {filtered.length} hồ sơ phù hợp</p></div><span className="doctors-source">Danh sách bác sĩ</span></div>
        <div className="doctors-filters">
          <label className="doctors-filter doctors-search"><Search size={17} /><span className="doctors-sr-only">Tìm bác sĩ trong trang</span><input aria-label="Tìm bác sĩ trong trang" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tên bác sĩ, mã tài khoản, chuyên khoa..." /></label>
          <label className="doctors-filter"><Stethoscope size={16} /><span className="doctors-sr-only">Lọc chuyên khoa trang hiện tại</span><select aria-label="Lọc chuyên khoa trang hiện tại" value={specialtyFilter} onChange={(event) => setSpecialtyFilter(event.target.value)}><option value="">Tất cả chuyên khoa</option>
            {filterSpecialties.map((specialty) => <option value={specialty.id} key={specialty.id}>{specialty.name}</option>)}</select></label>
          <label className="doctors-filter"><span className="doctors-sr-only">Lọc trạng thái trang hiện tại</span><select aria-label="Lọc trạng thái trang hiện tại" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DoctorStatusFilter)}>
            <option value="ALL">Mọi trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="INACTIVE">Ngừng hoạt động</option></select></label>
        </div>
        <div className="doctors-table-scroll" tabIndex={0} aria-label="Bảng bác sĩ cuộn ngang khi cần">
          <table className="doctors-table"><thead><tr><th scope="col">Bác sĩ</th><th scope="col">Chuyên khoa</th><th scope="col">Mã tài khoản</th><th scope="col">Phí khám (VND)</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{filtered.map((doctor) => <tr key={doctor.id} className={doctor.id === selectedId ? 'is-selected' : undefined}>
              <td><span className="doctors-person"><span className="doctors-avatar"><Stethoscope size={19} /></span><span><strong>{doctorDisplayName(doctor, namesByUserId, namesLoading)}</strong><small>{doctor.doctorCode || 'Chưa có mã BS'}</small></span></span></td>
              <td>{doctor.specialtyName || 'Chưa có chuyên khoa'}</td><td><span className="doctors-nowrap" title={accountCodesByUserId[doctor.userId] || 'Chưa đồng bộ mã tài khoản'}>{accountCodesByUserId[doctor.userId] || 'Chưa đồng bộ'}</span></td>
              <td className="doctors-nowrap">{doctor.consultationFee == null ? 'Chưa có' : formatVnd(doctor.consultationFee)}</td>
              <td><span className={`doctors-state ${doctor.active ? 'active' : 'inactive'}`}>{doctor.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></td>
              <td><button type="button" ref={(element) => { rowActionRefs.current[doctor.id] = element; }} className="doctors-row-action" onClick={() => select(doctor.id)} aria-label={`Xem bác sĩ ${doctorDisplayName(doctor, namesByUserId)} · ${shortId(doctor.id)}`}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="doctors-empty" role="status">{rows.length ? 'Không có bác sĩ phù hợp trong trang này. Thử xóa bộ lọc hoặc chuyển trang.' : 'Chưa có hồ sơ bác sĩ ở trang này.'}</p>}
        <div className="doctors-directory-foot"><p>Phí khám được cấu hình bằng VND. Tìm kiếm và bộ lọc áp dụng cho trang hiện tại.</p>
          <nav aria-label="Phân trang bác sĩ" className="doctors-pagination"><button type="button" className="soft-button" disabled={busy || loading || pageNumber === 0} onClick={() => { setPageNumber((value) => value - 1); select(''); }}><ChevronLeft size={16} /> Trước</button>
            <span>Trang {pageNumber + 1}/{numberOfPages}</span><button type="button" className="soft-button" disabled={busy || loading || pageNumber + 1 >= numberOfPages} onClick={() => { setPageNumber((value) => value + 1); select(''); }}>Sau <ChevronRight size={16} /></button></nav></div>
      </section>
    </>}

    {selectedId && !formMode && <div className="doctors-detail-overlay">
      <button type="button" className="doctors-detail-backdrop" tabIndex={-1} aria-hidden="true" disabled={busy} onClick={closeDetail} />
      <section ref={detailPanelRef} className="panel doctors-detail doctors-detail-modal" role="dialog" aria-modal="true" aria-labelledby="doctor-detail-title" aria-describedby="doctor-detail-announcement" tabIndex={-1} onKeyDown={handleDetailKeyDown}>
      <div className="doctors-section-head"><div><span className="doctors-section-kicker">HỒ SƠ QUẢN TRỊ</span><h3 id="doctor-detail-title">Thông tin bác sĩ</h3></div>
        <button type="button" className="doctors-detail-close" disabled={busy} onClick={closeDetail} aria-label="Đóng chi tiết bác sĩ" title="Đóng chi tiết"><X size={18} aria-hidden="true" /></button></div>
      <p id="doctor-detail-announcement" className="doctors-sr-only" role="status">Đã mở chi tiết bác sĩ {shortId(selectedId)}.</p>
      {detail &&
        <div className="doctors-detail-heading"><span className="doctors-avatar large"><Stethoscope size={30} /></span><div><h4>{doctorDisplayName(detail, namesByUserId, namesLoading)}</h4><p>Mã bác sĩ: {detail.doctorCode || 'Chưa có'}</p><span className={`doctors-state ${detail.active ? 'active' : 'inactive'}`}>{detail.active ? 'Đang hoạt động' : 'Ngừng hoạt động'}</span></div></div>
      }
      <nav className="doctors-detail-views" aria-label="Chọn nội dung chi tiết bác sĩ">
        <button type="button" className={detailView === 'profile' ? 'is-active' : undefined} aria-pressed={detailView === 'profile'} onClick={() => showDetailView('profile')}><IdCard size={16} /> Hồ sơ</button>
        <button type="button" className={detailView === 'schedule' ? 'is-active' : undefined} aria-pressed={detailView === 'schedule'} onClick={() => showDetailView('schedule')}><CalendarClock size={16} /> Lịch làm việc {schedules ? `(${schedules.length} ca)` : ''}</button>
      </nav>
      <div className="doctors-detail-content" ref={detailContentRef}>
      {detailLoading && <p role="status">Đang xác minh hồ sơ và lịch làm việc...</p>}
      {detailError && <Alert tone="error">{detailError}</Alert>}
      {detailView === 'profile' && detail && <>
        <dl className="doctors-detail-fields"><div><dt><IdCard size={15} /> Mã tài khoản</dt><dd>{accountCodesByUserId[detail.userId] || 'Chưa đồng bộ'}</dd></div><div><dt><Stethoscope size={15} /> Chuyên khoa</dt><dd>{detail.specialtyName || 'Chưa có chuyên khoa'}</dd></div>
          <div><dt>Phí khám (VND)</dt><dd>{detail.consultationFee == null ? 'Chưa có' : formatVnd(detail.consultationFee)}</dd></div><div><dt>Giới thiệu</dt><dd>{detail.biography?.trim() || 'Chưa cập nhật tiểu sử.'}</dd></div></dl>
        <div className="doctors-detail-actions"><button type="button" disabled={busy} onClick={() => beginEdit(detail)}><Pencil size={16} /> Chỉnh sửa hồ sơ</button>
          {detail.active && <button type="button" className="soft-button danger" disabled={busy} onClick={() => setConfirmDeactivate(true)}><UserRoundX size={16} /> Ngừng hoạt động</button>}</div>
        {confirmDeactivate && <div className="doctors-confirm" role="group" aria-label="Xác nhận ngừng hoạt động"><CircleAlert size={21} /><div><strong>Xác nhận ngừng hoạt động bác sĩ #{shortId(detail.id)}?</strong><p>Thao tác sẽ ghi vào hệ thống thực. Không xóa dữ liệu hồ sơ.</p><div><button type="button" className="danger" disabled={busy} onClick={() => void deactivate()}>Xác nhận ngừng hoạt động</button><button type="button" className="soft-button" disabled={busy} onClick={() => setConfirmDeactivate(false)}>Giữ nguyên</button></div></div></div>}
        <p className="doctors-data-note"><ShieldCheck size={15} /> Thông tin hồ sơ chỉ dành cho quản trị viên.</p>
      </>}
      {detailView === 'schedule' && <div className="doctors-schedule doctors-schedule-compact"><h4><CalendarClock size={18} /> Lịch làm việc {schedules && <span>· {groupedSchedules.length} ngày / {schedules.length} ca</span>}</h4>
        {scheduleError && <Alert tone="info">Không tải được lịch làm việc: {scheduleError}</Alert>}
        {schedules?.length === 0 && <p>Chưa có lịch làm việc được trả về.</p>}
        {groupedSchedules.map((day) => <div className="doctors-schedule-day" key={day.dayOfWeek}>
          <strong>{weekdays[day.dayOfWeek - 1] ?? `Ngày ${day.dayOfWeek}`}</strong>
          <div>{day.slots.map((slot) => <span key={slot.id}>{formatTime(slot.startTime)} – {formatTime(slot.endTime)}</span>)}</div>
        </div>)}
      </div>}
      </div>
      </section>
    </div>}
  </div>;
}
