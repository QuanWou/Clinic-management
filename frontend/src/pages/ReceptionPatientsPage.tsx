import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, IdCard, Phone, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { getReceptionPatientDirectory, registerReceptionPatient, searchReceptionPatients } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { ReceptionPatientResponse, RegisterWalkInPatientRequest } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate } from '../utils/format';
import { clinicToday } from '../api/staffDashboard';
import { filterPatientResults, type PatientAccountFilter } from '../utils/patientResults';
import './receptionPatientsUx.css';

const initialForm: RegisterWalkInPatientRequest = { fullName: '', phone: '', dob: '', gender: '', address: '', bloodType: '' };
const phonePattern = /^[+0-9() .-]{7,20}$/;
const directorySize = 20;
const pageSize = directorySize;
type ResultMode = 'directory' | 'search' | 'created';
type RegistrationField = 'fullName' | 'phone' | 'dob';
type RegistrationErrors = Partial<Record<RegistrationField, string>>;
type RegistrationTouched = Partial<Record<RegistrationField, boolean>>;

export function validateRegistrationField(field: RegistrationField, value: string | null | undefined): string | undefined {
  const normalized = value?.trim() ?? '';
  if (field === 'fullName') return normalized ? undefined : 'Vui lòng nhập họ và tên.';
  if (field === 'phone') return phonePattern.test(normalized) ? undefined : 'Nhập số điện thoại hợp lệ (tối thiểu 7 số).';
  if (!normalized) return undefined;
  return normalized < clinicToday() ? undefined : 'Ngày sinh phải trước ngày hôm nay.';
}

export default function ReceptionPatientsPage({ role }: { role: ClinicRole }) {
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">Bạn không có quyền truy cập danh sách bệnh nhân lễ tân.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Bệnh nhân" subtitle="Tra cứu bệnh nhân lễ tân" />
    <Alert tone="info">Tìm kiếm và đăng ký bệnh nhân vãng lai hiện chưa khả dụng.</Alert></>;
  return <ActiveReceptionPatientsPage />;
}

function ActiveReceptionPatientsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [patients, setPatients] = useState<ReceptionPatientResponse[] | null>(null);
  const [resultMode, setResultMode] = useState<ResultMode>('directory');
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryPages, setDirectoryPages] = useState(0);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<PatientAccountFilter>('ALL');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<RegisterWalkInPatientRequest>(initialForm);
  const [fieldErrors, setFieldErrors] = useState<RegistrationErrors>({});
  const [touchedFields, setTouchedFields] = useState<RegistrationTouched>({});
  const [registering, setRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef(0);
  const detailRef = useRef<HTMLElement | null>(null);
  const originButtonRef = useRef<HTMLButtonElement | null>(null);
  const registrationButtonRef = useRef<HTMLButtonElement | null>(null);
  const registrationModalRef = useRef<HTMLElement | null>(null);
  const registrationFieldRefs = useRef<Partial<Record<RegistrationField, HTMLInputElement | null>>>({});
  useEffect(() => () => { requestId.current += 1; }, []);

  // Staff-only paged directory loads immediately; an explicit search remains independent.
  useEffect(() => {
    let active = true;
    const request = ++requestId.current;
    setBusy(true); setError(null); setPatients(null); setSelectedId(''); originButtonRef.current = null;
    setResultMode('directory'); setFilter('ALL'); setPage(1);
    void getReceptionPatientDirectory(directoryPage, directorySize).then((result) => {
      if (!active || request !== requestId.current) return;
      if (!result || !Array.isArray(result.content) || !Number.isInteger(result.totalElements)
        || result.totalElements < 0 || !Number.isInteger(result.totalPages)
        || result.number !== directoryPage || result.content.some((item) => !item?.id || !item.fullName)) {
        throw new Error('Dữ liệu danh sách bệnh nhân không hợp lệ.');
      }
      setPatients(result.content);
      setDirectoryTotal(result.totalElements);
      setDirectoryPages(result.totalPages);
    }).catch((cause: unknown) => {
      if (active && request === requestId.current) setError(message(cause));
    }).finally(() => {
      if (active && request === requestId.current) setBusy(false);
    });
    return () => { active = false; };
  }, [directoryPage, directoryRevision]);

  const filtered = filterPatientResults(patients ?? [], filter);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = patients?.find((patient) => patient.id === selectedId);

  function showDirectory() {
    if (busy) return;
    setName(''); setPhone(''); setNotice(null); setError(null);
    setDirectoryPage(0);
    setDirectoryRevision((value) => value + 1);
  }

  useEffect(() => {
    if (!selectedId || !selected || !detailRef.current) return;
    detailRef.current.focus({ preventScroll: true });
  }, [selectedId, selected]);

  useEffect(() => {
    if (!selectedId && !registering) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [selectedId, registering]);

  useEffect(() => {
    if (registering) registrationFieldRefs.current.fullName?.focus({ preventScroll: true });
  }, [registering]);

  function closeRegistration() {
    if (busy) return;
    setRegistering(false);
    setRegistrationError(null);
    const restoreFocus = () => registrationButtonRef.current?.focus({ preventScroll: true });
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreFocus);
    else setTimeout(restoreFocus, 0);
  }

  function handleRegistrationKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closeRegistration();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(registrationModalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === registrationModalRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === registrationModalRef.current)) {
      event.preventDefault();
      first.focus();
    }
  }

  function updateRegistrationField(field: RegistrationField, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setTouchedFields((previous) => ({ ...previous, [field]: true }));
    setFieldErrors((previous) => {
      if (!previous[field] && !touchedFields[field]) return previous;
      const next = { ...previous };
      const fieldError = validateRegistrationField(field, value);
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  }

  function validateRegistrationFieldOnBlur(field: RegistrationField, value: string | null | undefined) {
    const fieldError = validateRegistrationField(field, value);
    setTouchedFields((previous) => ({ ...previous, [field]: true }));
    setFieldErrors((previous) => {
      const next = { ...previous };
      if (fieldError) next[field] = fieldError;
      else delete next[field];
      return next;
    });
  }

  function validateRegistrationForm(): boolean {
    const next: RegistrationErrors = {
      fullName: validateRegistrationField('fullName', form.fullName),
      phone: validateRegistrationField('phone', form.phone),
      dob: validateRegistrationField('dob', form.dob)
    };
    (Object.keys(next) as RegistrationField[]).forEach((field) => {
      if (!next[field]) delete next[field];
    });
    setTouchedFields({ fullName: true, phone: true, dob: true });
    setFieldErrors(next);
    const firstInvalid = (['fullName', 'phone', 'dob'] as RegistrationField[]).find((field) => next[field]);
    if (firstInvalid) registrationFieldRefs.current[firstInvalid]?.focus();
    return !firstInvalid;
  }

  function closeDetail() {
    const originButton = originButtonRef.current;
    setSelectedId('');
    if (!originButton) return;
    const restoreFocus = () => originButton.focus({ preventScroll: true });
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(restoreFocus);
    else setTimeout(restoreFocus, 0);
  }

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setError(null); setNotice(null);
    const queryName = name.trim();
    const queryPhone = phone.trim();
    if (!queryName && !queryPhone) { showDirectory(); return; }
    const request = ++requestId.current;
    setBusy(true); setPatients(null); setSelectedId(''); originButtonRef.current = null; setFilter('ALL'); setPage(1);
    try {
      const result = await searchReceptionPatients({ name: queryName, phone: queryPhone });
      if (!Array.isArray(result)) throw new Error('Dữ liệu tìm kiếm bệnh nhân không hợp lệ.');
      if (request !== requestId.current) return;
      setPatients(result);
      setResultMode('search');
    } catch (cause) {
      if (request === requestId.current) setError(message(cause));
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setRegistrationError(null); setNotice(null);
    if (!validateRegistrationForm()) return;
    const request = ++requestId.current;
    setBusy(true);
    try {
      const created = await registerReceptionPatient({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), dob: form.dob || null });
      if (!created.id || created.fullName !== form.fullName.trim()) throw new Error('Chưa xác nhận được đăng ký bệnh nhân.');
      if (request !== requestId.current) return;
      setPatients([created]); setResultMode('created');
      setSelectedId(created.id); setFilter('ALL'); setPage(1);
      setRegistering(false); setForm(initialForm); setFieldErrors({}); setTouchedFields({});
      setNotice('Đăng ký bệnh nhân thành công.');
    } catch (cause) {
      if (request === requestId.current) setRegistrationError(message(cause));
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }

  return <div className="patients-workspace">
    <PageHeader title="Bệnh nhân" subtitle="Tìm kiếm, tiếp nhận và quản lý thông tin hành chính bệnh nhân"
      actions={<button type="button" ref={registrationButtonRef} onClick={() => { setRegistrationError(null); setRegistering(true); }} disabled={busy} aria-haspopup="dialog" aria-expanded={registering}>
        <Plus size={17} /> Thêm bệnh nhân</button>} />
    <section className="patients-hero" aria-label="Giới thiệu quản lý bệnh nhân">
      <div className="patients-hero-copy"><span className="patients-hero-kicker"><ShieldCheck size={15} /> KHU VỰC QUẢN LÝ BỆNH NHÂN</span>
        <h3>Thông tin rõ ràng. Tiếp nhận thuận tiện.</h3>
        <p>Danh sách bệnh nhân hiện ngay khi mở trang. Tìm theo tên hoặc số điện thoại để tra cứu nhanh và xem chi tiết trong phạm vi được cấp quyền.</p>
        <div className="patients-hero-tags"><span><UsersRound size={15} /> Danh sách bệnh nhân</span><span><Search size={15} /> Tìm kiếm hồ sơ</span><span><ClipboardList size={15} /> Đăng ký trực tiếp</span></div>
      </div>
      <div className="patients-hero-symbol" aria-hidden="true"><UsersRound size={72} strokeWidth={1.25} /></div>
    </section>

    {error && <Alert tone="error">{error} {resultMode === 'directory' && <button type="button" className="soft-button" disabled={busy} onClick={showDirectory}>Thử tải lại danh sách</button>}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {registering && <div className="patients-registration-overlay">
      <button type="button" className="patients-detail-backdrop" tabIndex={-1} aria-hidden="true" disabled={busy} onClick={closeRegistration} />
      <section ref={registrationModalRef} className="panel patients-registration" role="dialog" aria-modal="true" aria-labelledby="patients-registration-title" aria-describedby="patients-registration-description" tabIndex={-1} onKeyDown={handleRegistrationKeyDown}>
        <header className="patients-registration-header">
          <div><span className="patients-section-kicker">TIẾP NHẬN · HỒ SƠ MỚI</span><h3 id="patients-registration-title">Thêm bệnh nhân</h3><p id="patients-registration-description">Tạo hồ sơ hành chính cho bệnh nhân chưa có tài khoản đăng nhập.</p></div>
          <button type="button" className="patients-detail-close" disabled={busy} onClick={closeRegistration} aria-label="Đóng biểu mẫu thêm bệnh nhân" title="Đóng"><X size={18} aria-hidden="true" /></button>
        </header>
        <form className="patients-registration-form" onSubmit={(event) => void register(event)} noValidate>
          <div className="patients-registration-body">
            <p className="patients-registration-hint"><ShieldCheck size={16} aria-hidden="true" /> Các mục có dấu <span>*</span> là bắt buộc. Thông tin chỉ dùng cho hồ sơ hành chính.</p>
            {registrationError && <div className="patients-registration-error" role="alert">{registrationError}</div>}
            <label htmlFor="patient-registration-full-name">Họ và tên <span aria-hidden="true">*</span><input id="patient-registration-full-name" ref={(node) => { registrationFieldRefs.current.fullName = node; }} aria-required="true" aria-invalid={Boolean(fieldErrors.fullName)} aria-describedby={fieldErrors.fullName ? 'patient-registration-full-name-error' : undefined} autoComplete="name" maxLength={150} value={form.fullName} onBlur={(event) => validateRegistrationFieldOnBlur('fullName', event.target.value)} onChange={(event) => updateRegistrationField('fullName', event.target.value)} placeholder="Nhập họ và tên" />{fieldErrors.fullName && <span id="patient-registration-full-name-error" className="patients-field-error" role="alert">{fieldErrors.fullName}</span>}</label>
            <label htmlFor="patient-registration-phone">Số điện thoại <span aria-hidden="true">*</span><input id="patient-registration-phone" ref={(node) => { registrationFieldRefs.current.phone = node; }} aria-required="true" aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? 'patient-registration-phone-error' : undefined} autoComplete="tel" type="tel" maxLength={20} value={form.phone} onBlur={(event) => validateRegistrationFieldOnBlur('phone', event.target.value)} onChange={(event) => updateRegistrationField('phone', event.target.value)} placeholder="Nhập số điện thoại" />{fieldErrors.phone && <span id="patient-registration-phone-error" className="patients-field-error" role="alert">{fieldErrors.phone}</span>}</label>
            <label htmlFor="patient-registration-dob">Ngày sinh<input id="patient-registration-dob" ref={(node) => { registrationFieldRefs.current.dob = node; }} aria-invalid={Boolean(fieldErrors.dob)} aria-describedby={fieldErrors.dob ? 'patient-registration-dob-error' : undefined} type="date" max={clinicToday()} value={form.dob ?? ''} onBlur={(event) => validateRegistrationFieldOnBlur('dob', event.target.value)} onChange={(event) => updateRegistrationField('dob', event.target.value)} />{fieldErrors.dob && <span id="patient-registration-dob-error" className="patients-field-error" role="alert">{fieldErrors.dob}</span>}</label>
            <label>Giới tính<select value={form.gender ?? ''} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Chưa cung cấp</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
            <label className="patients-form-wide">Địa chỉ<input maxLength={255} value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Số nhà, đường, phường/xã, tỉnh/thành (không bắt buộc)" /></label>
            <label>Nhóm máu<select value={form.bloodType ?? ''} onChange={(event) => setForm({ ...form, bloodType: event.target.value })}><option value="">Chưa cung cấp</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <footer className="patients-form-actions">
            <button type="button" className="soft-button" disabled={busy} onClick={closeRegistration}>Hủy</button>
            <button type="submit" disabled={busy}>{busy ? 'Đang đăng ký...' : 'Lưu bệnh nhân'} <ArrowRight size={16} /></button>
          </footer>
        </form>
      </section>
    </div>}

    <form className="panel patients-search-panel" onSubmit={(event) => void search(event)} aria-label="Tìm kiếm bệnh nhân">
      <div className="patients-section-head"><div><span className="patients-section-kicker">TRA CỨU</span><h3>Tìm kiếm bệnh nhân</h3><p>Danh sách tự tải khi mở trang. Nhập tên hoặc số điện thoại để tìm trên toàn bộ hồ sơ.</p></div><span className="patients-search-marker"><Search size={21} /></span></div>
      <div className="patients-search-fields">
        <label><UserRound size={17} /><span className="patients-sr-only">Tìm theo họ tên</span><input aria-label="Tìm theo họ tên" maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập họ và tên bệnh nhân" /></label>
        <label><Phone size={17} /><span className="patients-sr-only">Tìm theo số điện thoại</span><input aria-label="Tìm theo số điện thoại" type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" /></label>
        <button type="submit" disabled={busy}><Search size={17} /> {busy ? 'Đang xử lý...' : 'Tìm bệnh nhân'}</button>
        <button type="button" className="soft-button" disabled={busy} onClick={showDirectory}>Danh sách tất cả</button>
      </div>
      <p className="patients-search-note"><ShieldCheck size={14} /> Danh sách chỉ dành cho Admin và Lễ tân; mỗi lượt tải tối đa {directorySize} bệnh nhân.</p>
    </form>

    {busy && <p role="status" className="patients-loading">{resultMode === 'directory' ? 'Đang tải danh sách bệnh nhân...' : 'Đang xử lý yêu cầu bệnh nhân...'}</p>}
    {patients && <>
      {resultMode !== 'directory' && <section className="patients-metrics" aria-label="Thống kê trong kết quả tìm kiếm">
        <article className="patients-metric"><span className="patients-metric-icon"><UsersRound size={21} /></span><strong>{patients.length}</strong><h3>{resultMode === 'search' ? 'Kết quả tìm kiếm' : 'Bệnh nhân vừa tạo'}</h3><p>Trong kết quả hiện tại</p></article>
        <article className="patients-metric patients-metric-blue"><span className="patients-metric-icon"><IdCard size={21} /></span><strong>{patients.filter((item) => Boolean(item.userId)).length}</strong><h3>Có tài khoản liên kết</h3><p>Chỉ tính trong dữ liệu hiện có</p></article>
        <article className="patients-metric patients-metric-violet"><span className="patients-metric-icon"><CircleUserRound size={21} /></span><strong>{patients.filter((item) => !item.userId).length}</strong><h3>Chưa liên kết tài khoản</h3><p>Chỉ tính trong dữ liệu hiện có</p></article>
      </section>}
      <div className="patients-results-stack">
      <section className="panel patients-results" aria-label="Kết quả tra cứu bệnh nhân">
        <div className="patients-section-head"><div><span className="patients-section-kicker">DỮ LIỆU THỰC</span><h3>{resultMode === 'directory' ? 'Danh sách bệnh nhân' : resultMode === 'search' ? 'Kết quả tìm kiếm' : 'Bệnh nhân vừa đăng ký'}</h3>
          <p>{resultMode === 'directory' ? `Trang ${directoryPage + 1}/${Math.max(1, directoryPages)} · ${filtered.length}/${patients.length} hồ sơ phù hợp trong trang · ${directoryTotal} tổng hồ sơ` : `${filtered.length} / ${patients.length} hồ sơ đang hiển thị theo bộ lọc`}</p></div>
          <label className="patients-account-filter">Loại hồ sơ<select aria-label="Lọc loại hồ sơ" value={filter} onChange={(event) => { setFilter(event.target.value as PatientAccountFilter); setPage(1); setSelectedId(''); originButtonRef.current = null; }}>
            <option value="ALL">Tất cả</option><option value="LINKED">Đã liên kết</option><option value="WALK_IN">Chưa liên kết</option></select></label></div>
        <div className="patients-table-scroll" tabIndex={0} aria-label="Bảng bệnh nhân có thể cuộn ngang">
          <table className="patients-table"><thead><tr><th scope="col">Bệnh nhân</th><th scope="col">Số điện thoại</th><th scope="col">Ngày sinh</th><th scope="col">Giới tính</th><th scope="col">Tài khoản</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id} className={selectedId === item.id ? 'is-selected' : undefined}>
              <td><div className="patients-person"><span className="patients-avatar">{initials(item.fullName)}</span><div><strong>{item.fullName}</strong><small>Mã BN: {item.patientCode || 'Chưa có'}</small></div></div></td>
              <td>{item.phone}</td><td>{formatDate(item.dob)}</td><td>{genderLabel(item.gender)}</td><td><span className={`patients-state ${item.userId ? 'linked' : 'walk-in'}`}>{item.userId ? 'Đã liên kết' : 'Chưa liên kết'}</span></td>
              <td><button type="button" className="patients-row-action" aria-label={`Xem chi tiết bệnh nhân ${item.fullName}`} onClick={(event) => { originButtonRef.current = event.currentTarget; setSelectedId(item.id); }}>Xem chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="patients-empty" role="status">{patients.length ? 'Không có hồ sơ phù hợp với bộ lọc trên trang này.' : resultMode === 'directory' ? 'Chưa có bệnh nhân trong danh sách.' : 'Không tìm thấy bệnh nhân phù hợp. Thử tên hoặc số điện thoại khác.'}</p>}
        {filtered.length > pageSize && <nav className="patients-pagination" aria-label="Phân trang bệnh nhân trong kết quả"><span>Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length} trên trang hiện tại</span>
          <div><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /> Trước</button><span>Trang {currentPage}/{pages}</span>
            <button type="button" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Sau <ChevronRight size={16} /></button></div></nav>}
        {resultMode === 'directory' && directoryPages > 1 && <nav className="patients-pagination" aria-label="Chuyển trang danh sách bệnh nhân"><span>Trang danh sách {directoryPage + 1}/{directoryPages} · {directoryTotal} hồ sơ</span><div>
          <button type="button" disabled={busy || directoryPage === 0} onClick={() => setDirectoryPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /> Trang trước</button>
          <button type="button" disabled={busy || directoryPage + 1 >= directoryPages} onClick={() => setDirectoryPage((value) => value + 1)}>Trang tiếp <ChevronRight size={16} /></button></div></nav>}
        <p className="patients-limit-note">{resultMode === 'directory' ? `Mỗi trang tải tối đa ${directorySize} hồ sơ. Bộ lọc loại hồ sơ chỉ áp dụng trên trang đang xem; tìm kiếm tên hoặc số điện thoại để tra cứu toàn bộ.` : resultMode === 'search' ? 'Hiển thị tối đa 50 kết quả. Thu hẹp tên hoặc số điện thoại nếu cần.' : 'Đây là bệnh nhân vừa được đăng ký. Nhấn Danh sách tất cả để trở về danh sách.'}</p>
      </section>
      </div>
      {selected && <div className="patients-detail-overlay">
        <button type="button" className="patients-detail-backdrop" tabIndex={-1} aria-hidden="true" onClick={closeDetail} />
        <PatientDetail patient={selected} detailRef={detailRef} onClose={closeDetail} />
      </div>}
    </>}
  </div>;
}

export function PatientDetail({ patient, detailRef, onClose }: { patient: ReceptionPatientResponse; detailRef: { current: HTMLElement | null }; onClose: () => void }) {
  return <section className="panel patients-detail" ref={detailRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="patient-detail-title"
    onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') { event.preventDefault(); event.currentTarget.querySelector('button')?.focus(); }
    }}>
    <div className="patients-section-head"><div><span className="patients-section-kicker">HỒ SƠ HÀNH CHÍNH</span><h3 id="patient-detail-title">Thông tin bệnh nhân</h3></div>
      <button type="button" className="patients-detail-close" onClick={onClose} aria-label="Đóng chi tiết bệnh nhân" title="Đóng chi tiết"><X size={18} aria-hidden="true" /></button></div>
    <div className="patients-detail-identity"><span className="patients-avatar large">{initials(patient.fullName)}</span><div><h4>{patient.fullName}</h4><p>Mã bệnh nhân: {patient.patientCode || 'Chưa có'}</p>
      <span className={`patients-state ${patient.userId ? 'linked' : 'walk-in'}`}>{patient.userId ? 'Đã liên kết tài khoản' : 'Chưa liên kết tài khoản'}</span></div></div>
    <dl className="patients-detail-fields">
      <div><dt><Phone size={15} /> Số điện thoại</dt><dd>{patient.phone}</dd></div>
      <div><dt><CalendarDays size={15} /> Ngày sinh</dt><dd>{formatDate(patient.dob)}</dd></div>
      <div><dt><UserRound size={15} /> Giới tính</dt><dd>{genderLabel(patient.gender)}</dd></div>
      <div><dt><IdCard size={15} /> Nhóm máu</dt><dd>{patient.bloodType || 'Chưa cung cấp'}</dd></div>
      <div className="patients-detail-wide"><dt>Địa chỉ</dt><dd>{patient.address || 'Chưa cung cấp'}</dd></div>
    </dl>
    <p className="patients-privacy-note"><CheckCircle2 size={17} /> Chỉ hiển thị thông tin hành chính; nội dung bệnh án không nằm trong trang này.</p>
  </section>;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(-2).map((part) => part.charAt(0)).join('').toLocaleUpperCase('vi-VN') || 'BN';
}

function genderLabel(gender: string | null): string {
  if (!gender) return 'Chưa cung cấp';
  return ({ MALE: 'Nam', FEMALE: 'Nữ', OTHER: 'Khác' } as Record<string, string>)[gender.toUpperCase()] ?? gender;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Yêu cầu bệnh nhân thất bại';
}
