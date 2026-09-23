import { type FormEvent, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleUserRound, ClipboardList, IdCard, Phone, Plus, Search, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { registerReceptionPatient, searchReceptionPatients } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { ReceptionPatientResponse, RegisterWalkInPatientRequest } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, shortId } from '../utils/format';
import { clinicToday } from '../api/staffDashboard';
import { filterPatientResults, type PatientAccountFilter } from '../utils/patientResults';

const initialForm: RegisterWalkInPatientRequest = { fullName: '', phone: '', dob: '', gender: '', address: '', bloodType: '' };
const phonePattern = /^[+0-9() .-]{7,20}$/;
const pageSize = 8;

export default function ReceptionPatientsPage({ role, onBookPatient }: { role: ClinicRole; onBookPatient?: (patient: ReceptionPatientResponse) => void }) {
  if (role !== 'ADMIN' && role !== 'RECEPTIONIST') return <Alert tone="error">You cannot access the receptionist patient directory.</Alert>;
  if (!integrations.reception) return <><PageHeader title="Patients" subtitle="Reception patient search" />
    <Alert tone="info">Patient search and walk-in registration are unavailable until Task 03 is merged, running and routed.</Alert></>;
  return <ActiveReceptionPatientsPage onBookPatient={onBookPatient} />;
}

function ActiveReceptionPatientsPage({ onBookPatient }: { onBookPatient?: (patient: ReceptionPatientResponse) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [patients, setPatients] = useState<ReceptionPatientResponse[] | null>(null);
  const [resultLabel, setResultLabel] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<PatientAccountFilter>('ALL');
  const [page, setPage] = useState(1);
  const [form, setForm] = useState<RegisterWalkInPatientRequest>(initialForm);
  const [registering, setRegistering] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requestId = useRef(0);
  useEffect(() => () => { requestId.current += 1; }, []);

  const filtered = filterPatientResults(patients ?? [], filter);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const selected = patients?.find((patient) => patient.id === selectedId);

  async function search(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setError(null); setNotice(null);
    const queryName = name.trim();
    const queryPhone = phone.trim();
    if (!queryName && !queryPhone) { setError('Nhập tên hoặc số điện thoại để tìm bệnh nhân.'); return; }
    const request = ++requestId.current;
    setBusy(true); setPatients(null); setSelectedId(''); setFilter('ALL'); setPage(1);
    try {
      const result = await searchReceptionPatients({ name: queryName, phone: queryPhone });
      if (!Array.isArray(result)) throw new Error('Dữ liệu tìm kiếm bệnh nhân không hợp lệ.');
      if (request !== requestId.current) return;
      setPatients(result);
      setResultLabel('Kết quả tìm kiếm');
    } catch (cause) {
      if (request === requestId.current) setError(message(cause));
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null); setNotice(null);
    if (!form.fullName.trim() || !phonePattern.test(form.phone.trim())) {
      setError('Nhập họ tên và số điện thoại hợp lệ.'); return;
    }
    if (form.dob && form.dob >= clinicToday()) { setError('Ngày sinh phải trước ngày hôm nay.'); return; }
    const request = ++requestId.current;
    setBusy(true);
    try {
      const created = await registerReceptionPatient({ ...form, fullName: form.fullName.trim(), phone: form.phone.trim(), dob: form.dob || null });
      if (!created.id || created.fullName !== form.fullName.trim()) throw new Error('Máy chủ chưa xác nhận đăng ký bệnh nhân.');
      if (request !== requestId.current) return;
      setPatients([created]); setResultLabel('Bệnh nhân vừa đăng ký');
      setSelectedId(created.id); setFilter('ALL'); setPage(1);
      setRegistering(false); setForm(initialForm);
      setNotice('Đăng ký bệnh nhân thành công theo xác nhận từ máy chủ.');
    } catch (cause) {
      if (request === requestId.current) setError(message(cause));
    } finally {
      if (request === requestId.current) setBusy(false);
    }
  }

  return <div className="patients-workspace">
    <PageHeader title="Bệnh nhân" subtitle="Tìm kiếm, tiếp nhận và quản lý thông tin hành chính bệnh nhân"
      actions={<button type="button" onClick={() => { setRegistering((value) => !value); setError(null); }} disabled={busy}>
        {registering ? <X size={17} /> : <Plus size={17} />}{registering ? 'Đóng biểu mẫu' : 'Thêm bệnh nhân'}</button>} />
    <section className="patients-hero" aria-label="Giới thiệu quản lý bệnh nhân">
      <div className="patients-hero-copy"><span className="patients-hero-kicker"><ShieldCheck size={15} /> KHU VỰC QUẢN LÝ BỆNH NHÂN</span>
        <h3>Thông tin rõ ràng. Tiếp nhận thuận tiện.</h3>
        <p>Tìm hồ sơ hành chính bằng tên hoặc số điện thoại, chọn bệnh nhân và xem chi tiết trong phạm vi được cấp quyền.</p>
        <div className="patients-hero-tags"><span><Search size={15} /> Tìm kiếm từ API</span><span><ClipboardList size={15} /> Đăng ký trực tiếp</span></div>
      </div>
      <div className="patients-hero-symbol" aria-hidden="true"><UsersRound size={72} strokeWidth={1.25} /></div>
    </section>

    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {registering && <section className="panel patients-registration" aria-label="Đăng ký bệnh nhân mới">
      <div className="patients-section-head"><div><span className="patients-section-kicker">TIẾP NHẬN</span><h3>Đăng ký bệnh nhân vãng lai</h3><p>Chỉ lưu khi máy chủ xác nhận; không tạo tài khoản đăng nhập tự động.</p></div>
        <button type="button" className="soft-button" disabled={busy} onClick={() => setRegistering(false)}><X size={16} /> Đóng</button></div>
      <form className="patients-registration-form" onSubmit={(event) => void register(event)}>
        <label>Họ và tên <span aria-hidden="true">*</span><input required autoComplete="name" maxLength={150} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Nhập họ và tên" /></label>
        <label>Số điện thoại <span aria-hidden="true">*</span><input required autoComplete="tel" type="tel" maxLength={20} pattern="[+0-9() .-]{7,20}" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Nhập số điện thoại" /></label>
        <label>Ngày sinh<input type="date" max={clinicToday()} value={form.dob ?? ''} onChange={(event) => setForm({ ...form, dob: event.target.value || null })} /></label>
        <label>Giới tính<select value={form.gender ?? ''} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Chưa cung cấp</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
        <label className="patients-form-wide">Địa chỉ<input maxLength={255} value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Địa chỉ (không bắt buộc)" /></label>
        <label>Nhóm máu<select value={form.bloodType ?? ''} onChange={(event) => setForm({ ...form, bloodType: event.target.value })}><option value="">Chưa cung cấp</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <div className="patients-form-actions"><button type="submit" disabled={busy}>{busy ? 'Đang đăng ký...' : 'Xác nhận đăng ký'} <ArrowRight size={16} /></button>
          <button type="button" className="soft-button" disabled={busy} onClick={() => setRegistering(false)}>Hủy</button></div>
      </form>
    </section>}

    <form className="panel patients-search-panel" onSubmit={(event) => void search(event)} aria-label="Tìm kiếm bệnh nhân">
      <div className="patients-section-head"><div><span className="patients-section-kicker">TRA CỨU</span><h3>Tìm kiếm bệnh nhân</h3><p>Nhập ít nhất tên hoặc số điện thoại. Hệ thống chỉ trả kết quả phù hợp.</p></div><span className="patients-search-marker"><Search size={21} /></span></div>
      <div className="patients-search-fields">
        <label><UserRound size={17} /><span className="patients-sr-only">Tìm theo họ tên</span><input aria-label="Tìm theo họ tên" maxLength={150} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập họ và tên bệnh nhân" /></label>
        <label><Phone size={17} /><span className="patients-sr-only">Tìm theo số điện thoại</span><input aria-label="Tìm theo số điện thoại" type="tel" maxLength={20} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Số điện thoại" /></label>
        <button type="submit" disabled={busy}><Search size={17} /> {busy ? 'Đang tìm...' : 'Tìm bệnh nhân'}</button>
      </div>
      <p className="patients-search-note"><ShieldCheck size={14} /> Dữ liệu chỉ xuất hiện sau khi tìm kiếm. Không có API thống kê hoặc xem toàn bộ danh sách bệnh nhân.</p>
    </form>

    {busy && <p role="status" className="patients-loading">Đang xử lý yêu cầu bệnh nhân...</p>}
    {patients === null && !busy && <section className="patients-welcome panel"><span><CircleUserRound size={36} /></span><h3>Bắt đầu bằng một lượt tìm kiếm</h3>
      <p>Nhập tên hoặc số điện thoại để hiển thị danh sách bệnh nhân. Bạn cũng có thể thêm bệnh nhân vãng lai bằng biểu mẫu ở trên.</p></section>}
    {patients && <>
      <section className="patients-metrics" aria-label="Thống kê trong kết quả tìm kiếm">
        <article className="patients-metric"><span className="patients-metric-icon"><UsersRound size={21} /></span><strong>{patients.length}</strong><h3>{resultLabel === 'Kết quả tìm kiếm' ? 'Kết quả trả về' : 'Bệnh nhân vừa tạo'}</h3><p>Không phải tổng số toàn phòng khám</p></article>
        <article className="patients-metric patients-metric-blue"><span className="patients-metric-icon"><IdCard size={21} /></span><strong>{patients.filter((item) => Boolean(item.userId)).length}</strong><h3>Có tài khoản liên kết</h3><p>Chỉ tính trong dữ liệu hiện có</p></article>
        <article className="patients-metric patients-metric-violet"><span className="patients-metric-icon"><CircleUserRound size={21} /></span><strong>{patients.filter((item) => !item.userId).length}</strong><h3>Chưa liên kết tài khoản</h3><p>Chỉ tính trong dữ liệu hiện có</p></article>
      </section>
      <section className="panel patients-results" aria-label="Kết quả tra cứu bệnh nhân">
        <div className="patients-section-head"><div><span className="patients-section-kicker">DỮ LIỆU THỰC</span><h3>{resultLabel}</h3>
          <p>{filtered.length} / {patients.length} hồ sơ đang hiển thị theo bộ lọc</p></div>
          <label className="patients-account-filter">Loại hồ sơ<select aria-label="Lọc loại hồ sơ" value={filter} onChange={(event) => { setFilter(event.target.value as PatientAccountFilter); setPage(1); setSelectedId(''); }}>
            <option value="ALL">Tất cả</option><option value="LINKED">Đã liên kết</option><option value="WALK_IN">Chưa liên kết</option></select></label></div>
        <div className="patients-table-scroll" tabIndex={0} aria-label="Bảng bệnh nhân có thể cuộn ngang">
          <table className="patients-table"><thead><tr><th scope="col">Bệnh nhân</th><th scope="col">Số điện thoại</th><th scope="col">Ngày sinh</th><th scope="col">Giới tính</th><th scope="col">Tài khoản</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id} className={selectedId === item.id ? 'is-selected' : undefined}>
              <td><div className="patients-person"><span className="patients-avatar">{initials(item.fullName)}</span><div><strong>{item.fullName}</strong><small>Mã BN: {shortId(item.id)}</small></div></div></td>
              <td>{item.phone}</td><td>{formatDate(item.dob)}</td><td>{genderLabel(item.gender)}</td><td><span className={`patients-state ${item.userId ? 'linked' : 'walk-in'}`}>{item.userId ? 'Đã liên kết' : 'Chưa liên kết'}</span></td>
              <td><button type="button" className="patients-row-action" aria-label={`Xem chi tiết bệnh nhân ${item.fullName}`} onClick={() => setSelectedId(item.id)}>Xem chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="patients-empty" role="status">{patients.length ? 'Không có hồ sơ phù hợp với bộ lọc.' : 'Không tìm thấy bệnh nhân phù hợp. Thử tên hoặc số điện thoại khác.'}</p>}
        {filtered.length > pageSize && <nav className="patients-pagination" aria-label="Phân trang bệnh nhân"><span>Hiển thị {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} / {filtered.length}</span>
          <div><button type="button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={16} /> Trước</button><span>Trang {currentPage}/{pages}</span>
            <button type="button" disabled={currentPage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))}>Sau <ChevronRight size={16} /></button></div></nav>}
        <p className="patients-limit-note">{resultLabel === 'Kết quả tìm kiếm' ? 'API trả tối đa 50 bệnh nhân cho một lượt tìm kiếm. Nếu có nhiều kết quả, hãy thu hẹp điều kiện; phân trang chỉ áp dụng cho dữ liệu đã trả về.' : 'Đây là bệnh nhân vừa được đăng ký, không phải danh sách đầy đủ.'}</p>
      </section>
      {selected && <section className="panel patients-detail" aria-label="Thông tin chi tiết bệnh nhân">
        <div className="patients-section-head"><div><span className="patients-section-kicker">HỒ SƠ HÀNH CHÍNH</span><h3>Thông tin bệnh nhân</h3></div>
          <div className="patients-detail-actions">
            {onBookPatient && <button type="button" onClick={() => onBookPatient(selected)}><CalendarDays size={16} /> Đặt lịch cho bệnh nhân</button>}
            <button type="button" className="soft-button" onClick={() => setSelectedId('')}><X size={16} /> Đóng chi tiết</button>
          </div></div>
        <div className="patients-detail-identity"><span className="patients-avatar large">{initials(selected.fullName)}</span><div><h4>{selected.fullName}</h4><p>Mã bệnh nhân: {selected.id}</p>
          <span className={`patients-state ${selected.userId ? 'linked' : 'walk-in'}`}>{selected.userId ? 'Đã liên kết tài khoản' : 'Chưa liên kết tài khoản'}</span></div></div>
        <dl className="patients-detail-fields">
          <div><dt><Phone size={15} /> Số điện thoại</dt><dd>{selected.phone}</dd></div>
          <div><dt><CalendarDays size={15} /> Ngày sinh</dt><dd>{formatDate(selected.dob)}</dd></div>
          <div><dt><UserRound size={15} /> Giới tính</dt><dd>{genderLabel(selected.gender)}</dd></div>
          <div><dt><IdCard size={15} /> Nhóm máu</dt><dd>{selected.bloodType || 'Chưa cung cấp'}</dd></div>
          <div className="patients-detail-wide"><dt>Địa chỉ</dt><dd>{selected.address || 'Chưa cung cấp'}</dd></div>
        </dl>
        <p className="patients-privacy-note"><CheckCircle2 size={17} /> Chỉ hiển thị thông tin hành chính do API tiếp nhận cung cấp. Không truy cập nội dung bệnh án.</p>
      </section>}
    </>}
  </div>;
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
