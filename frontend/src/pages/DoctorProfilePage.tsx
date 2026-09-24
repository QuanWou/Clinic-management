import { type FormEvent, useEffect, useState } from 'react';
import {
  CalendarClock, CheckCircle2, Clock3, FileText, IdCard,
  LockKeyhole, Mail, Pencil, Phone, RefreshCw, Stethoscope, X
} from 'lucide-react';
import { getDoctorProfile, getMyDoctorSchedules, updateDoctorProfile } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import type { CurrentUser, DoctorProfileResponse, DoctorSchedule } from '../types/domain';
import { formatVnd } from '../utils/format';
import { integrations } from '../config/integrations.config';
import './doctorProfile.css';

const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
const MAX_BIO = 10000; // Matches UpdateDoctorProfileRequest's backend validation.

function apiMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.';
}

function scheduleTime(value: string): string {
  return /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : 'Chưa rõ';
}

export default function DoctorProfilePage({ user }: { user: CurrentUser }) {
  const [doctor, setDoctor] = useState<DoctorProfileResponse | null>(null);
  const [schedules, setSchedules] = useState<DoctorSchedule[] | null>(null);
  const [form, setForm] = useState({ biography: '' });
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setScheduleLoading(true); setError(null); setScheduleError(null);
    setDoctor(null); setSchedules(null); setProfileNotFound(false); setEditing(false); setNotice(null);
    void getDoctorProfile().then((response) => {
      if (!active) return;
      if (!response || !response.id || !response.userId) throw new Error('Phản hồi hồ sơ bác sĩ không hợp lệ.');
      setDoctor(response);
      setForm({ biography: response.biography ?? '' });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof HttpApiError && cause.status === 404) setProfileNotFound(true);
      else setError(apiMessage(cause));
    }).finally(() => { if (active) setLoading(false); });
    // Schedule failure should not hide an otherwise valid personal profile.
    void getMyDoctorSchedules().then((items) => {
      if (!active) return;
      if (!Array.isArray(items) || items.some((item) => !Number.isInteger(item.dayOfWeek)
        || item.dayOfWeek < 1 || item.dayOfWeek > 7 || typeof item.startTime !== 'string'
        || typeof item.endTime !== 'string')) throw new Error('Dữ liệu lịch làm việc không hợp lệ.');
      setSchedules([...items].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    }).catch((cause: unknown) => { if (active) setScheduleError(apiMessage(cause)); })
      .finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [revision, user.id, user.userId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !doctor || !integrations.adminCatalog) return;
    if (form.biography.length > MAX_BIO) {
      setError(`Tiểu sử không được vượt quá ${MAX_BIO.toLocaleString('vi-VN')} ký tự.`);
      return;
    }
    setSaving(true); setError(null); setNotice(null);
    try {
      // Never send specialtyId, consultationFee or account details from this self-service page.
      const result = await updateDoctorProfile({ biography: form.biography });
      if (!result || result.id !== doctor.id || result.userId !== doctor.userId) {
        throw new Error('Chưa xác nhận được cập nhật hồ sơ bác sĩ. Vui lòng tải lại.');
      }
      setDoctor(result);
      setForm({ biography: result.biography ?? '' });
      setEditing(false);
      setNotice('Đã lưu tiểu sử bác sĩ.');
    } catch (cause) { setError(apiMessage(cause)); }
    finally { setSaving(false); }
  }

  const name = user.fullName?.trim() || user.email;
  const canEdit = integrations.adminCatalog;
  const totalDays = schedules ? new Set(schedules.map((item) => item.dayOfWeek)).size : null;

  return <div className="doctor-profile-workspace" aria-label="Hồ sơ bác sĩ cá nhân">
    <PageHeader title="Hồ sơ bác sĩ" subtitle="Thông tin chuyên môn và lịch làm việc của tài khoản đang đăng nhập."
      actions={<button type="button" className="soft-button" disabled={loading || saving || editing} onClick={() => setRevision((value) => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button>} />

    {loading && <div className="panel doctor-profile-state" role="status"><RefreshCw size={23} aria-hidden="true" /> Đang tải hồ sơ bác sĩ...</div>}
    {error && <Alert tone="error">{error} {!doctor && <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Thử lại</button>}</Alert>}
    {notice && <div role="status"><Alert tone="info">{notice}</Alert></div>}
    {!doctor && !loading && !error && <div className="panel doctor-profile-state"><IdCard size={27} aria-hidden="true" />
      {profileNotFound ? 'Chưa được cấp hồ sơ bác sĩ. Vui lòng liên hệ quản trị viên.' : 'Chưa có hồ sơ bác sĩ để hiển thị.'}</div>}

    {doctor && <>
      <section className="doctor-profile-summary" aria-label="Thông tin hồ sơ">
        <article className="panel doctor-profile-identity">
          <div className="doctor-profile-identity-main">
            <Avatar label={name} size="lg" />
            <div className="doctor-profile-identity-name"><span className="doctor-profile-kicker">HỒ SƠ CÁ NHÂN</span>
              <h3>{name}</h3><p className="doctor-profile-specialty"><Stethoscope size={17} aria-hidden="true" /> {doctor.specialtyName || 'Chưa được gán chuyên khoa'}</p></div>
            <span className="doctor-profile-verified"><LockKeyhole size={14} aria-hidden="true" /> Hồ sơ của tài khoản đang đăng nhập</span>
          </div>
          <dl className="doctor-profile-contact">
            <div><dt><Mail size={16} aria-hidden="true" /> Email</dt><dd>{user.email}</dd></div>
            <div><dt><Phone size={16} aria-hidden="true" /> Số điện thoại</dt><dd>{user.phone || 'Chưa được cung cấp'}</dd></div>
            <div><dt><IdCard size={16} aria-hidden="true" /> Mã bác sĩ</dt><dd>{doctor.doctorCode || 'Chưa có'}</dd></div>
          </dl>
        </article>
        <div className="doctor-profile-summary-side">
          <article className="panel doctor-profile-fact"><span className="doctor-profile-fact-icon"><Stethoscope size={23} aria-hidden="true" /></span>
            <small>CHUYÊN KHOA</small><strong>{doctor.specialtyName || 'Chưa cập nhật'}</strong><p>Do quản trị viên phòng khám quản lý.</p></article>
          <article className="panel doctor-profile-fact doctor-profile-fact-blue"><span className="doctor-profile-fact-icon"><FileText size={23} aria-hidden="true" /></span>
            <small>GIÁ KHÁM</small><strong>{doctor.consultationFee == null ? 'Chưa cập nhật' : formatVnd(doctor.consultationFee)}</strong><p>Đơn vị VND; giá do quản trị viên quản lý.</p></article>
          <article className="panel doctor-profile-fact doctor-profile-fact-violet"><span className="doctor-profile-fact-icon"><CalendarClock size={23} aria-hidden="true" /></span>
            <small>LỊCH LÀM VIỆC</small><strong>{totalDays === null ? 'Chưa tải' : `${totalDays} ngày/tuần`}</strong><p>Số ngày trong lịch làm việc hiện tại.</p></article>
        </div>
      </section>

      <section className="doctor-profile-content" aria-label="Tiểu sử và lịch làm việc">
        <article className="panel doctor-profile-section">
          <header className="doctor-profile-section-head"><div><span>GIỚI THIỆU</span><h3>Tiểu sử chuyên môn</h3><p>Nội dung do bác sĩ tự cập nhật.</p></div>
            {!editing && canEdit && <button type="button" className="doctor-profile-edit" onClick={() => { setForm({ biography: doctor.biography ?? '' }); setEditing(true); setError(null); setNotice(null); }}><Pencil size={16} aria-hidden="true" /> Chỉnh sửa</button>}</header>
          {editing ? <form className="doctor-profile-biography-form" onSubmit={(event) => void save(event)}>
            <label htmlFor="doctor-biography">Tiểu sử của bạn</label>
            <textarea id="doctor-biography" value={form.biography} maxLength={MAX_BIO} rows={8} disabled={saving}
              onChange={(event) => setForm({ biography: event.target.value })} placeholder="Giới thiệu chuyên môn và kinh nghiệm được phép công bố..." />
            <span className="doctor-profile-character-count">{form.biography.length.toLocaleString('vi-VN')} / {MAX_BIO.toLocaleString('vi-VN')} ký tự</span>
            <p>Chuyên khoa, giá khám và thông tin tài khoản không thể chỉnh sửa tại đây.</p>
            <div className="doctor-profile-form-actions"><button type="submit" disabled={saving || form.biography === (doctor.biography ?? '')}>
              <CheckCircle2 size={16} aria-hidden="true" /> {saving ? 'Đang lưu...' : 'Lưu tiểu sử'}</button>
              <button type="button" className="soft-button" disabled={saving} onClick={() => { setEditing(false); setForm({ biography: doctor.biography ?? '' }); setError(null); }}>
                <X size={16} aria-hidden="true" /> Hủy</button></div>
          </form> : <div className="doctor-profile-bio-text">{doctor.biography?.trim() || 'Chưa cập nhật tiểu sử. Bạn có thể bổ sung nội dung khi chức năng chỉnh sửa được bật.'}</div>}
          {!canEdit && <div className="doctor-profile-readonly"><LockKeyhole size={17} aria-hidden="true" /> Chỉnh sửa tiểu sử hiện chưa khả dụng.</div>}
        </article>

        <aside className="panel doctor-profile-section" aria-label="Lịch làm việc của tôi">
          <header className="doctor-profile-section-head"><div><span>THỜI GIAN</span><h3>Lịch làm việc trong tuần</h3><p>Các ca làm việc hiện tại.</p></div><CalendarClock size={21} aria-hidden="true" /></header>
          {scheduleLoading && <p className="doctor-profile-schedule-state" role="status">Đang tải lịch làm việc...</p>}
          {scheduleError && <Alert tone="error">Không tải được lịch: {scheduleError} <button type="button" disabled={loading || saving || editing} onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
          {!scheduleLoading && schedules?.length === 0 && <p className="doctor-profile-schedule-state">Chưa có ca làm việc nào được ghi nhận.</p>}
          {schedules && schedules.length > 0 && <div className="doctor-profile-schedules">{schedules.map((schedule, index) => <div className="doctor-profile-schedule-row" key={schedule.id || `${schedule.dayOfWeek}-${schedule.startTime}-${index}`}>
            <span className="doctor-profile-schedule-day">{weekdays[schedule.dayOfWeek - 1]}</span>
            <strong><Clock3 size={15} aria-hidden="true" /> {scheduleTime(schedule.startTime)} – {scheduleTime(schedule.endTime)}</strong>
          </div>)}</div>}
          <p className="doctor-profile-schedule-note"><LockKeyhole size={15} aria-hidden="true" /> Lịch này chỉ xem tại đây.</p>
        </aside>
      </section>
    </>}
  </div>;
}
