import { useEffect, useState } from 'react';
import { CalendarDays, HeartPulse, IdCard, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import { getPatientProfile } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, PatientProfileResponse, ReceptionPatientResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate } from '../utils/format';
import ReceptionPatientsPage from './ReceptionPatientsPage';
import './patientPortal.css';

export default function PatientsPage({ role, user, onBookPatient }: { role: ClinicRole; user: CurrentUser; onBookPatient?: (patient: ReceptionPatientResponse) => void }) {
  if (role !== 'PATIENT') return <ReceptionPatientsPage role={role} onBookPatient={onBookPatient} />;
  return <PatientProfileWorkspace key={user.userId || user.id || user.email} user={user} />;
}

function genderLabel(gender?: string | null) {
  return gender === 'MALE' ? 'Nam' : gender === 'FEMALE' ? 'Nữ' : gender === 'OTHER' ? 'Khác' : 'Chưa cung cấp';
}

function PatientProfileWorkspace({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<PatientProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setMissing(false); setProfile(null);
    void getPatientProfile().then((result) => {
      if (!active) return;
      if (!result?.id || !result.userId || (user.userId || user.id) && result.userId !== (user.userId || user.id)) throw new Error('Hồ sơ trả về không thuộc tài khoản đang đăng nhập.');
      setProfile(result);
    }).catch((cause: unknown) => {
      if (!active) return;
      // A missing profile has its own explanatory state, never an invented record.
      if (cause instanceof HttpApiError && cause.status === 404) setMissing(true);
      else setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ bệnh nhân.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, user.userId, user.id, user.email]);

  return <div className="patient-portal" aria-label="Hồ sơ cá nhân bệnh nhân">
    <PageHeader title="Hồ sơ của tôi" subtitle="Thông tin cá nhân và hồ sơ bệnh nhân của tài khoản đang đăng nhập"
      actions={<button type="button" className="soft-button" disabled={loading} onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} /> Làm mới</button>} />
    <section className="patient-hero"><div><span className="patient-kicker"><ShieldCheck size={15} /> HỒ SƠ CÁ NHÂN · RIÊNG TƯ</span>
      <h3>Thông tin của bạn tại Clinic.</h3><p>Chỉ hiển thị hồ sơ thuộc người đang đăng nhập. Để cập nhật thông tin bệnh nhân, hãy mở mục Cài đặt.</p>
      <div className="patient-hero-tags"><span><UserRound size={15} /> Bệnh nhân</span><span><IdCard size={15} /> {profile ? `Mã #${profile.id.slice(0, 8).toUpperCase()}` : 'Hồ sơ cá nhân'}</span></div></div><HeartPulse size={64} aria-hidden="true" /></section>
    {loading && <p role="status">Đang tải hồ sơ bệnh nhân...</p>}
    {error && <Alert tone="error">{error} <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
    {missing && <div className="panel patient-panel patient-empty"><IdCard size={31} /><strong>Chưa có hồ sơ bệnh nhân</strong><p>Hãy vào Cài đặt để hoàn thiện ngày sinh và giới tính, sau đó quay lại xem hồ sơ.</p></div>}
    {profile && <div className="patient-two-columns"><section className="panel patient-panel"><div className="patient-section-head"><div><span>THÔNG TIN ĐĂNG KÝ</span><h3>Thông tin bệnh nhân</h3><p>Hồ sơ chỉ đọc từ Patient Service.</p></div><IdCard size={22} /></div>
      <div className="patient-info-row"><Avatar label={user.fullName || user.email} size="lg" /><div><strong>{user.fullName || user.email}</strong><p>{user.email}</p></div></div>
      <dl className="patient-fields"><div><dt>Mã bệnh nhân</dt><dd>{profile.id}</dd></div><div><dt>Ngày sinh</dt><dd>{formatDate(profile.dob)}</dd></div>
        <div><dt>Giới tính</dt><dd>{genderLabel(profile.gender)}</dd></div><div><dt>Nhóm máu</dt><dd>{profile.bloodType || 'Chưa cung cấp'}</dd></div>
        <div><dt>Số điện thoại Identity</dt><dd>{user.phone || 'Chưa cung cấp'}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div>
        <div className="patient-field-wide"><dt>Địa chỉ</dt><dd>{profile.address || 'Chưa cung cấp'}</dd></div></dl>
    </section><aside className="panel patient-panel"><div className="patient-section-head"><div><span>TÀI KHOẢN</span><h3>Quyền riêng tư</h3></div><ShieldCheck size={22} /></div>
      <div className="patient-info-row"><ShieldCheck size={21} /><div><strong>Hồ sơ thuộc tài khoản của bạn</strong><p>Thông tin hiển thị được kiểm tra theo mã tài khoản đang đăng nhập.</p></div></div>
      <div className="patient-info-row"><CalendarDays size={21} /><div><strong>Cập nhật hồ sơ</strong><p>Ngày sinh, giới tính, địa chỉ và nhóm máu được thay đổi tại mục Cài đặt.</p></div></div>
      <p className="patient-note"><ShieldCheck size={16} /> Không hỗ trợ thay đổi tên, email hoặc quyền tài khoản trên trang này.</p>
    </aside></div>}
  </div>;
}