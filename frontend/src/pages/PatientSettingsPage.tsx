import { type FormEvent, useEffect, useState } from 'react';
import { Bell, HeartPulse, IdCard, KeyRound, LockKeyhole, RefreshCw, Settings2, ShieldCheck, UserRound } from 'lucide-react';
import { getPatientProfile, updatePatientProfile } from '../api/clinic';
import { HttpApiError } from '../api/client';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, PatientProfileResponse } from '../types/domain';
import { formatDate } from '../utils/format';
import './patientPortal.css';

type Tab = 'account' | 'profile' | 'security';
type Form = { dob: string; gender: string; address: string; bloodType: string };
const empty: Form = { dob: '', gender: '', address: '', bloodType: '' };
const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientSettingsPage({ user }: { user: CurrentUser }) {
  const [tab, setTab] = useState<Tab>('account');
  const [form, setForm] = useState<Form>(empty);
  const [profile, setProfile] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setProfile(null); setMissing(false); setError(null); setNotice(null); setForm(empty);
    void getPatientProfile().then((result) => {
      if (!active) return;
      if (!result?.id || !result.userId || (user.userId || user.id) && result.userId !== (user.userId || user.id)) throw new Error('Hồ sơ không khớp tài khoản đăng nhập.');
      setProfile(result);
      setForm({ dob: result.dob ?? '', gender: result.gender ?? '', address: result.address ?? '', bloodType: result.bloodType ?? '' });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof HttpApiError && cause.status === 404) setMissing(true);
      else setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ bệnh nhân.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, user.userId, user.id, user.email]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || loading) return;
    setError(null); setNotice(null);
    if (!form.dob || form.dob >= clinicToday() || !['MALE', 'FEMALE', 'OTHER'].includes(form.gender)) {
      setError('Ngày sinh phải ở quá khứ và giới tính phải được chọn.'); return;
    }
    if (form.address.trim().length > 500 || form.bloodType && !bloodTypes.includes(form.bloodType)) {
      setError('Địa chỉ tối đa 500 ký tự; vui lòng chọn nhóm máu hợp lệ.'); return;
    }
    setSaving(true);
    try {
      // Patient Service requires non-null birth date and gender, and updates only /profile for the authenticated user.
      const request = { dob: form.dob, gender: form.gender, address: form.address.trim() || null, bloodType: form.bloodType || null };
      const confirmed = await updatePatientProfile(request);
      if (!confirmed?.id || !confirmed.userId || (user.userId || user.id) && confirmed.userId !== (user.userId || user.id)
        || confirmed.dob !== request.dob || confirmed.gender !== request.gender) throw new Error('Chưa thể lưu hồ sơ đúng tài khoản. Vui lòng tải lại trước khi tiếp tục.');
      setProfile(confirmed); setMissing(false);
      setForm({ dob: confirmed.dob ?? '', gender: confirmed.gender ?? '', address: confirmed.address ?? '', bloodType: confirmed.bloodType ?? '' });
      setNotice('Đã lưu hồ sơ bệnh nhân.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ bệnh nhân.'); }
    finally { setSaving(false); }
  }

  const status = user.status === 'ACTIVE' ? 'Đang hoạt động' : user.status === 'LOCKED' ? 'Đã khóa' : user.status === 'INACTIVE' ? 'Ngừng hoạt động' : 'Chưa có thông tin';
  return <div className="patient-portal patient-settings" aria-label="Cài đặt bệnh nhân"><PageHeader title="Cài đặt của tôi" subtitle="Quản lý hồ sơ bệnh nhân và xem thông tin tài khoản cá nhân"
    actions={<button type="button" className="soft-button" disabled={loading || saving} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Làm mới</button>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> KHÔNG GIAN BỆNH NHÂN · CÀI ĐẶT</span><h3>Thông tin rõ ràng, quyền riêng tư được giữ nguyên.</h3>
      <p>Xem thông tin tài khoản, cập nhật hồ sơ và quản lý tùy chọn cá nhân.</p>
      <div className="patient-hero-tags"><span><UserRound size={15} /> Bệnh nhân</span><span><ShieldCheck size={15} /> {status}</span></div></div><Settings2 size={63} aria-hidden="true" /></section>
    <div className="patient-two-columns"><nav className="panel patient-panel patient-settings-nav" aria-label="Danh mục cài đặt">
      <div className="patient-section-head"><div><span>THIẾT LẬP CỦA TÔI</span><h3>Danh mục cài đặt</h3></div></div>
      <div className="patient-worklist">{([
        { key: 'account' as const, label: 'Tài khoản', hint: 'Thông tin đăng nhập', icon: UserRound },
        { key: 'profile' as const, label: 'Hồ sơ bệnh nhân', hint: 'Thông tin có thể cập nhật', icon: IdCard },
        { key: 'security' as const, label: 'Bảo mật', hint: 'Phiên đăng nhập và giới hạn', icon: LockKeyhole }
      ]).map(({ key, label, hint, icon: Icon }) => <button type="button" key={key} className={tab === key ? 'is-active' : ''} aria-pressed={tab === key} disabled={saving} onClick={() => { setTab(key); setNotice(null); }}>
        <span className="patient-row-icon"><Icon size={19} /></span><div><strong>{label}</strong><small>{hint}</small></div></button>)}</div>
      <p className="patient-note"><ShieldCheck size={16} /> Thông tin chỉ cập nhật sau khi lưu thành công.</p></nav>
      <div className="patient-dashboard-side">
        {tab === 'account' && <section className="panel patient-panel"><div className="patient-section-head"><div><span>TÀI KHOẢN</span><h3>Thông tin đăng nhập</h3><p>Thông tin tài khoản chỉ xem tại đây.</p></div><LockKeyhole size={21} /></div>
          <div className="patient-info-row"><Avatar label={user.fullName || user.email} size="lg" /><div><strong>{user.fullName || user.email}</strong><p>Tài khoản bệnh nhân</p></div></div>
          <dl className="patient-fields"><div><dt>Họ và tên</dt><dd>{user.fullName || 'Chưa cung cấp'}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div>
            <div><dt>Số điện thoại</dt><dd>{user.phone || 'Chưa cung cấp'}</dd></div><div><dt>Trạng thái</dt><dd>{status}</dd></div>
            <div className="patient-field-wide"><dt>Mã tài khoản</dt><dd>{user.accountCode || 'Chưa cung cấp'}</dd></div></dl>
          <p className="patient-note"><ShieldCheck size={16} /> Tên, email, số điện thoại và quyền truy cập không thể tự thay đổi tại trang này.</p></section>}
        {tab === 'profile' && <section className="panel patient-panel"><div className="patient-section-head"><div><span>HỒ SƠ BỆNH NHÂN</span><h3>Thông tin cá nhân</h3><p>{profile ? `Mã bệnh nhân ${profile.patientCode || 'Chưa có'}` : 'Dữ liệu hồ sơ của tài khoản hiện tại.'}</p></div><HeartPulse size={22} /></div>
          {loading && <p role="status">Đang tải hồ sơ bệnh nhân...</p>}
          {missing && <Alert tone="info">Chưa có hồ sơ. Bạn có thể hoàn thiện ngày sinh và giới tính để tạo hồ sơ.</Alert>}
          {error && <Alert tone="error">{error} <button type="button" disabled={saving || loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
          {notice && <div role="status"><Alert tone="info">{notice}</Alert></div>}
          <form className="patient-form" onSubmit={(event) => void save(event)}><div className="patient-form-fields">
            <label>Ngày sinh *<input type="date" max={clinicToday()} required disabled={loading || saving} value={form.dob} onChange={(event) => setForm({ ...form, dob: event.target.value })} /></label>
            <label>Giới tính *<select required disabled={loading || saving} value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}><option value="">Chọn giới tính</option><option value="MALE">Nam</option><option value="FEMALE">Nữ</option><option value="OTHER">Khác</option></select></label>
            <label>Nhóm máu<select disabled={loading || saving} value={form.bloodType} onChange={(event) => setForm({ ...form, bloodType: event.target.value })}><option value="">Chưa cung cấp</option>{bloodTypes.map((blood) => <option value={blood} key={blood}>{blood}</option>)}</select></label>
            <label>Địa chỉ<textarea maxLength={500} disabled={loading || saving} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label></div>
            <div className="patient-form-actions"><button type="submit" disabled={loading || saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ của tôi'}</button></div></form>
          {profile && <p className="patient-note"><ShieldCheck size={16} /> Cập nhật gần nhất: {formatDate(profile.updatedAt)}.</p>}
        </section>}
        {tab === 'security' && <section className="panel patient-panel"><div className="patient-section-head"><div><span>BẢO MẬT</span><h3>Phiên đăng nhập và quyền riêng tư</h3><p>Các chức năng đã được tích hợp trong bản hiện tại.</p></div><ShieldCheck size={22} /></div>
          <div className="patient-info-row"><LockKeyhole size={20} /><div><strong>Đăng xuất</strong><p>Sử dụng nút Đăng xuất ở thanh điều hướng để kết thúc phiên.</p></div></div>
          <div className="patient-info-row"><KeyRound size={20} /><div><strong>Đổi mật khẩu</strong><p>Tính năng đổi mật khẩu hiện chưa khả dụng.</p></div></div>
          <div className="patient-info-row"><Bell size={20} /><div><strong>Thông báo cá nhân</strong><p>Quản lý hộp thư và tùy chọn nhận tin tại trang Thông báo nếu tích hợp được bật.</p></div></div>
          <p className="patient-note"><ShieldCheck size={16} /> Bạn chỉ xem bệnh án, hóa đơn và lịch khám thuộc tài khoản của mình.</p></section>}
      </div>
    </div>
  </div>;
}
