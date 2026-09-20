import { useEffect, useState } from 'react';
import {
  Bell, CalendarClock, CheckCircle2, CircleHelp, Clock3, Fingerprint,
  KeyRound, LockKeyhole, Mail, MessageSquare, RefreshCw, Settings2,
  ShieldCheck, Smartphone, Stethoscope, UserRound
} from 'lucide-react';
import { getDoctorProfile, getMyDoctorSchedules, getNotificationPreferences, updateNotificationPreference } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { CurrentUser, DoctorProfileResponse, DoctorSchedule, NotificationPreferenceResponse, NotificationType } from '../types/domain';
import './doctorSettings.css';

type Tab = 'account' | 'professional' | 'notifications';
const channelTypes: NotificationType[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'];
const channelInfo: Record<NotificationType, { label: string; description: string; icon: typeof Bell }> = {
  IN_APP: { label: 'Trong ứng dụng', description: 'Thông báo trong hộp thư cá nhân của bác sĩ.', icon: Bell },
  EMAIL: { label: 'Email', description: 'Chỉ nhận email khi nhà cung cấp gửi tin đã được cấu hình.', icon: Mail },
  SMS: { label: 'SMS', description: 'Chỉ nhận SMS khi nhà cung cấp gửi tin đã được cấu hình.', icon: MessageSquare },
  PUSH: { label: 'Push', description: 'Chưa cấu hình nhà cung cấp Push. Không thể bật.', icon: Smartphone }
};
const weekdays = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật'];
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Máy chủ không thể hoàn tất yêu cầu.';
const accountStatus = (status: CurrentUser['status']) => status === 'ACTIVE' ? 'Đang hoạt động'
  : status === 'LOCKED' ? 'Đã khóa' : status === 'INACTIVE' ? 'Ngừng hoạt động' : 'Chưa có thông tin';
const scheduleClock = (time: string) => /^\d{2}:\d{2}/.test(time) ? time.slice(0, 5) : 'Chưa rõ';

/** All profile and schedule requests are scoped to the authenticated doctor, never an Admin directory. */
export default function DoctorSettingsPage({ user }: { user: CurrentUser }) {
  const [tab, setTab] = useState<Tab>('account');
  const [doctor, setDoctor] = useState<DoctorProfileResponse | null>(null);
  const [schedules, setSchedules] = useState<DoctorSchedule[] | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[] | null>(null);
  const [preferenceLoading, setPreferenceLoading] = useState(false);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preferenceRevision, setPreferenceRevision] = useState(0);

  useEffect(() => {
    let active = true;
    setDoctor(null); setSchedules(null); setProfileError(null); setScheduleError(null);
    setProfileLoading(true); setScheduleLoading(true);
    void getDoctorProfile().then((result) => {
      if (!active) return;
      if (!result?.id || !result.userId || (user.userId || user.id) && result.userId !== (user.userId || user.id)) {
        throw new Error('Hồ sơ không khớp tài khoản đang đăng nhập.');
      }
      setDoctor(result);
    }).catch((cause: unknown) => { if (active) setProfileError(errorText(cause)); })
      .finally(() => { if (active) setProfileLoading(false); });
    void getMyDoctorSchedules().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 7 || typeof item.startTime !== 'string' || typeof item.endTime !== 'string')) {
        throw new Error('Dữ liệu lịch làm việc không hợp lệ.');
      }
      setSchedules([...result].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)));
    }).catch((cause: unknown) => { if (active) setScheduleError(errorText(cause)); })
      .finally(() => { if (active) setScheduleLoading(false); });
    return () => { active = false; };
  }, [profileRevision, user.id, user.userId]);

  useEffect(() => {
    if (tab !== 'notifications' || !integrations.notifications) return;
    let active = true;
    setPreferences(null); setPreferenceError(null); setNotice(null); setPreferenceLoading(true);
    void getNotificationPreferences().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !item || !channelTypes.includes(item.type) || typeof item.enabled !== 'boolean')
        || new Set(result.map((item) => item.type)).size !== result.length) throw new Error('Dữ liệu tùy chọn thông báo không hợp lệ.');
      setPreferences(result);
    }).catch((cause: unknown) => { if (active) setPreferenceError(errorText(cause)); })
      .finally(() => { if (active) setPreferenceLoading(false); });
    return () => { active = false; };
  }, [tab, preferenceRevision, user.id, user.userId]);

  async function savePreference(type: NotificationType, enabled: boolean) {
    if (!integrations.notifications || preferenceLoading || savingType || type === 'PUSH' || !preferences?.some((item) => item.type === type)) return;
    setSavingType(type); setPreferenceError(null); setNotice(null);
    try {
      const confirmed = await updateNotificationPreference(type, enabled);
      if (!confirmed || confirmed.type !== type || confirmed.enabled !== enabled) throw new Error('Máy chủ chưa xác nhận tùy chọn mới. Tải lại để kiểm tra.');
      setPreferences((current) => current?.map((item) => item.type === type ? confirmed : item) ?? null);
      setNotice(`Máy chủ đã xác nhận ${enabled ? 'bật' : 'tắt'} ${channelInfo[type].label}.`);
    } catch (cause) { setPreferenceError(errorText(cause)); }
    finally { setSavingType(null); }
  }

  const dayCount = schedules ? new Set(schedules.map((item) => item.dayOfWeek)).size : null;
  const tabs: { id: Tab; label: string; description: string; icon: typeof Bell }[] = [
    { id: 'account', label: 'Tài khoản', description: 'Thông tin đăng nhập', icon: UserRound },
    { id: 'professional', label: 'Chuyên môn', description: 'Hồ sơ và lịch làm việc', icon: Stethoscope },
    { id: 'notifications', label: 'Thông báo', description: 'Kênh nhận tin của tôi', icon: Bell }
  ];

  return <div className="doctor-settings" aria-label="Cài đặt tài khoản bác sĩ">
    <PageHeader title="Cài đặt bác sĩ" subtitle="Tài khoản, thông tin chuyên môn và tùy chọn thông báo cá nhân"
      actions={<button type="button" className="soft-button" disabled={profileLoading || scheduleLoading || preferenceLoading || savingType !== null}
        onClick={() => tab === 'notifications' ? setPreferenceRevision((value) => value + 1) : setProfileRevision((value) => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button>} />
    <section className="doctor-settings-hero" aria-label="Tổng quan cài đặt cá nhân"><div>
      <span className="doctor-settings-kicker"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN BÁC SĨ · CÀI ĐẶT CÁ NHÂN</span>
      <h3>Cài đặt rõ ràng, thông tin an toàn.</h3>
      <p>Quản lý tùy chọn thông báo của chính bạn và xem dữ liệu tài khoản, chuyên môn, lịch làm việc đã được máy chủ ghi nhận.</p>
      <span className="doctor-settings-hero-tag"><LockKeyhole size={15} aria-hidden="true" /> Không thay đổi cấu hình của phòng khám</span>
    </div><span className="doctor-settings-hero-icon" aria-hidden="true"><Settings2 size={62} strokeWidth={1.5} /></span></section>
    <section className="doctor-settings-stats" aria-label="Tổng quan tài khoản bác sĩ">
      <article><span className="doctor-settings-stat-icon"><UserRound size={21} /></span><small>Vai trò hiện tại</small><strong>Bác sĩ</strong><p>Phiên đăng nhập hiện tại</p></article>
      <article><span className="doctor-settings-stat-icon blue"><Stethoscope size={21} /></span><small>Chuyên khoa</small><strong>{profileLoading ? 'Đang tải...' : doctor?.specialtyName || (profileError ? 'Chưa khả dụng' : 'Chưa cập nhật')}</strong><p>Theo hồ sơ bác sĩ từ API</p></article>
      <article><span className="doctor-settings-stat-icon violet"><CalendarClock size={21} /></span><small>Lịch làm việc</small><strong>{dayCount === null ? '—' : `${dayCount} ngày/tuần`}</strong><p>Chỉ đếm ngày trong lịch API trả về</p></article>
    </section>
    <div className="doctor-settings-layout">
      <nav className="panel doctor-settings-nav" aria-label="Danh mục cài đặt bác sĩ"><span className="doctor-settings-eyebrow">THIẾT LẬP CỦA TÔI</span>
        {tabs.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id}
          className={tab === id ? 'is-active' : ''} disabled={savingType !== null} onClick={() => { setTab(id); setNotice(null); }}>
          <span className="doctor-settings-nav-icon"><Icon size={19} aria-hidden="true" /></span><span><strong>{label}</strong><small>{description}</small></span>
        </button>)}
        <p className="doctor-settings-nav-note"><ShieldCheck size={17} aria-hidden="true" /> Chỉ những cập nhật được API xác nhận mới hiển thị thành công.</p>
      </nav>
      <div className="doctor-settings-content">
        {tab === 'account' && <>
          <section className="panel doctor-settings-panel"><header className="doctor-settings-heading"><div><span>HỒ SƠ TÀI KHOẢN</span><h3>Thông tin đăng nhập</h3><p>Thông tin Identity trả về, không thể chỉnh sửa tại đây.</p></div><span className="doctor-settings-readonly"><LockKeyhole size={14} /> Chỉ xem</span></header>
            <div className="doctor-settings-person"><Avatar label={user.fullName || user.email} size="lg" /><div><strong>{user.fullName || user.email}</strong><span>Bác sĩ · Tài khoản hiện tại</span></div></div>
            <dl className="doctor-settings-fields"><div><dt>Họ và tên</dt><dd>{user.fullName || 'Chưa được cung cấp'}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Số điện thoại</dt><dd>{user.phone || 'Chưa được cung cấp'}</dd></div><div><dt>Mã tài khoản</dt><dd>{user.userId || user.id || 'Chưa có thông tin'}</dd></div>
              <div><dt>Vai trò</dt><dd>Bác sĩ</dd></div><div><dt>Trạng thái</dt><dd>{accountStatus(user.status)}</dd></div></dl>
            <p className="doctor-settings-note"><ShieldCheck size={17} /> Việc thay đổi tên, email hoặc quyền tài khoản cần quy trình Identity phù hợp. Trang này không gửi yêu cầu sửa tài khoản.</p>
          </section>
          <section className="panel doctor-settings-panel"><header className="doctor-settings-heading"><div><span>BẢO MẬT</span><h3>Phiên đăng nhập và mật khẩu</h3><p>Các chức năng hiện có của tài khoản.</p></div><KeyRound size={21} /></header>
            <div className="doctor-settings-info"><LockKeyhole size={19} /><div><strong>Đăng xuất</strong><p>Dùng nút Đăng xuất trong thanh điều hướng để kết thúc phiên.</p></div><span>Khả dụng</span></div>
            <div className="doctor-settings-info"><KeyRound size={19} /><div><strong>Đổi mật khẩu</strong><p>Chưa có quy trình đổi mật khẩu cá nhân được kết nối.</p></div><span>Chưa hỗ trợ</span></div></section>
        </>}
        {tab === 'professional' && <>
          <section className="panel doctor-settings-panel"><header className="doctor-settings-heading"><div><span>HỒ SƠ CHUYÊN MÔN</span><h3>Thông tin bác sĩ</h3><p>Chỉ tải hồ sơ của bác sĩ đang đăng nhập.</p></div><span className="doctor-settings-readonly"><Fingerprint size={14} /> Chỉ xem</span></header>
            {profileLoading && <p className="doctor-settings-loading" role="status">Đang tải hồ sơ chuyên môn...</p>}
            {profileError && <Alert tone="error">{profileError} <button type="button" className="soft-button" disabled={profileLoading || scheduleLoading} onClick={() => setProfileRevision((value) => value + 1)}>Thử lại</button></Alert>}
            {doctor && <><dl className="doctor-settings-fields"><div><dt>Mã bác sĩ</dt><dd>{doctor.id}</dd></div><div><dt>Chuyên khoa</dt><dd>{doctor.specialtyName || 'Chưa cập nhật'}</dd></div>
              <div><dt>Mã chuyên khoa</dt><dd>{doctor.specialtyId || 'Chưa cập nhật'}</dd></div><div><dt>Giá khám</dt><dd>{doctor.consultationFee == null ? 'Chưa cập nhật' : String(doctor.consultationFee)}</dd></div></dl>
              <div className="doctor-settings-biography"><strong>Tiểu sử chuyên môn</strong><p>{doctor.biography?.trim() || 'Chưa cập nhật tiểu sử.'}</p></div></>}
            {!doctor && !profileLoading && !profileError && <p className="doctor-settings-loading">Chưa có hồ sơ được API trả về.</p>}
            <p className="doctor-settings-note"><ShieldCheck size={17} /> Tiểu sử được chỉnh sửa ở mục Hồ sơ bác sĩ. Chuyên khoa và giá khám do quản trị viên quản lý.</p>
          </section>
          <section className="panel doctor-settings-panel"><header className="doctor-settings-heading"><div><span>CA LÀM VIỆC</span><h3>Lịch làm việc trong tuần</h3><p>Dữ liệu lấy từ API lịch của chính bác sĩ.</p></div><CalendarClock size={22} /></header>
            {scheduleLoading && <p className="doctor-settings-loading" role="status">Đang tải lịch làm việc...</p>}
            {scheduleError && <Alert tone="error">{scheduleError} <button type="button" className="soft-button" disabled={profileLoading || scheduleLoading} onClick={() => setProfileRevision((value) => value + 1)}>Thử lại</button></Alert>}
            {!scheduleLoading && schedules?.length === 0 && <p className="doctor-settings-loading">Chưa có ca làm việc nào được ghi nhận.</p>}
            {schedules && schedules.length > 0 && <div className="doctor-settings-schedules">{schedules.map((item, index) => <div key={item.id || `${item.dayOfWeek}-${item.startTime}-${index}`}><span>{weekdays[item.dayOfWeek - 1]}</span><strong><Clock3 size={15} /> {scheduleClock(item.startTime)} – {scheduleClock(item.endTime)}</strong></div>)}</div>}
            <p className="doctor-settings-note"><LockKeyhole size={17} /> Trang Cài đặt chỉ tra cứu lịch làm việc, không tự ý thay đổi hoặc tạo ca.</p>
          </section>
        </>}
        {tab === 'notifications' && <section className="panel doctor-settings-panel"><header className="doctor-settings-heading"><div><span>THÔNG BÁO CÁ NHÂN</span><h3>Kênh nhận thông báo</h3><p>Chỉ thay đổi tùy chọn của tài khoản đang đăng nhập.</p></div>
          {integrations.notifications && <button type="button" className="soft-button" disabled={preferenceLoading || savingType !== null} onClick={() => setPreferenceRevision((value) => value + 1)}><RefreshCw size={15} /> Tải lại</button>}</header>
          {!integrations.notifications ? <div className="doctor-settings-empty"><Bell size={30} /><strong>Chưa bật tích hợp thông báo</strong><p>Không thể xem hoặc thay đổi tùy chọn khi API chưa được kích hoạt trong bản triển khai này.</p></div> : <>
            {preferenceError && <Alert tone="error">{preferenceError} <button type="button" className="soft-button" disabled={preferenceLoading || savingType !== null} onClick={() => setPreferenceRevision((value) => value + 1)}>Thử lại</button></Alert>}
            {notice && <div role="status"><Alert tone="info">{notice}</Alert></div>}
            {preferenceLoading && <p className="doctor-settings-loading" role="status">Đang tải tùy chọn từ máy chủ...</p>}
            {!preferenceLoading && preferences?.length === 0 && <p className="doctor-settings-loading">Máy chủ chưa trả về tùy chọn nào.</p>}
            {preferences && <div className="doctor-settings-channels">{channelTypes.filter((type) => preferences.some((item) => item.type === type)).map((type) => {
              const pref = preferences.find((item) => item.type === type)!;
              const Icon = channelInfo[type].icon;
              return <label key={type} className="doctor-settings-channel"><span className="doctor-settings-channel-icon"><Icon size={21} /></span>
                <span className="doctor-settings-channel-copy"><strong>{channelInfo[type].label}</strong><small>{channelInfo[type].description}</small></span>
                <input type="checkbox" aria-label={`Bật nhận thông báo ${channelInfo[type].label}`} checked={pref.enabled && type !== 'PUSH'} disabled={preferenceLoading || savingType !== null || type === 'PUSH'} onChange={(event) => void savePreference(type, event.target.checked)} />
              </label>;
            })}</div>}
            <p className="doctor-settings-footnote"><CircleHelp size={16} /> Bật Email/SMS không đồng nghĩa nhà cung cấp đã hoạt động. Chỉ thông báo xác nhận từ API mới được coi là đã lưu.</p>
          </>}
        </section>}
      </div>
    </div>
  </div>;
}
