import { useEffect, useState } from 'react';
import {
  Bell, CalendarCheck2, CheckCircle2, CircleHelp, ClipboardCheck, Fingerprint,
  KeyRound, LockKeyhole, Mail, MessageSquare, RefreshCw, Settings2, ShieldCheck,
  Smartphone, UserRound, UsersRound
} from 'lucide-react';
import { getNotificationPreferences, updateNotificationPreference } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { CurrentUser, NotificationPreferenceResponse, NotificationType } from '../types/domain';
import './receptionSettings.css';

type Section = 'account' | 'notifications' | 'workflow';
const channels: NotificationType[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'];
const channelDetails: Record<NotificationType, { label: string; description: string; icon: typeof Bell }> = {
  IN_APP: { label: 'Trong ứng dụng', description: 'Nhận thông báo trong hộp thư cá nhân.', icon: Bell },
  EMAIL: { label: 'Email', description: 'Nhận thông báo qua thư điện tử.', icon: Mail },
  SMS: { label: 'SMS', description: 'Nhận thông báo qua tin nhắn điện thoại.', icon: MessageSquare },
  PUSH: { label: 'Push', description: 'Kênh này hiện chưa khả dụng.', icon: Smartphone }
};

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể hoàn tất yêu cầu cài đặt.';
}

function statusLabel(status: CurrentUser['status']): string {
  if (status === 'ACTIVE') return 'Đang hoạt động';
  if (status === 'INACTIVE') return 'Ngừng hoạt động';
  if (status === 'LOCKED') return 'Đã khóa';
  return 'Chưa có thông tin';
}

/** A receptionist can manage only their own notification preferences, not clinic configuration. */
export default function ReceptionSettingsPage({ user }: { user: CurrentUser }) {
  const [section, setSection] = useState<Section>('account');
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (section !== 'notifications' || !integrations.notifications) return;
    let active = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    setPreferences(null);
    // Only the current principal's /my/preferences endpoint is used here.
    void getNotificationPreferences().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !item || !channels.includes(item.type)
        || typeof item.enabled !== 'boolean') || new Set(result.map((item) => item.type)).size !== result.length) {
        throw new Error('Dữ liệu tùy chọn thông báo không hợp lệ.');
      }
      setPreferences(result);
    }).catch((cause: unknown) => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [section, revision, user.id, user.userId, user.email]);

  async function savePreference(type: NotificationType, enabled: boolean) {
    if (!integrations.notifications || loading || savingType !== null || type === 'PUSH'
      || !preferences?.some((item) => item.type === type)) return;
    setSavingType(type);
    setError(null);
    setNotice(null);
    try {
      const confirmed = await updateNotificationPreference(type, enabled);
      if (!confirmed || confirmed.type !== type || confirmed.enabled !== enabled) {
        throw new Error('Thay đổi chưa được xác nhận. Hãy tải lại để kiểm tra.');
      }
      setPreferences((current) => current?.map((item) => item.type === type ? confirmed : item) ?? null);
      setNotice(`Đã ${enabled ? 'bật' : 'tắt'} kênh ${channelDetails[type].label}.`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSavingType(null); }
  }

  const sections: { id: Section; label: string; description: string; icon: typeof Bell }[] = [
    { id: 'account', label: 'Tài khoản', description: 'Thông tin đăng nhập', icon: UserRound },
    { id: 'notifications', label: 'Thông báo', description: 'Kênh nhận tin cá nhân', icon: Bell },
    { id: 'workflow', label: 'Quyền & quy trình', description: 'Phạm vi công việc lễ tân', icon: ClipboardCheck }
  ];

  return <div className="reception-settings" aria-label="Cài đặt cá nhân lễ tân">
    <PageHeader title="Cài đặt lễ tân" subtitle="Thông tin tài khoản và các tùy chọn dành riêng cho lễ tân"
      actions={section === 'notifications' && integrations.notifications ? <button type="button" className="soft-button"
        disabled={loading || savingType !== null} onClick={() => setRevision((value) => value + 1)}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button> : undefined} />

    <section className="reception-settings-hero" aria-label="Tổng quan cài đặt lễ tân">
      <div><span className="reception-settings-kicker"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN LỄ TÂN · CÀI ĐẶT CÁ NHÂN</span>
        <h3>Cài đặt của bạn, trong đúng phạm vi.</h3>
        <p>Xem tài khoản đang đăng nhập, chọn kênh nhận thông báo và tra cứu những chức năng dành cho công việc tiếp đón.</p>
        <span className="reception-settings-hero-tag"><LockKeyhole size={15} aria-hidden="true" /> Không thay đổi cấu hình toàn phòng khám</span>
      </div><span className="reception-settings-hero-art" aria-hidden="true"><Settings2 size={61} strokeWidth={1.5} /></span>
    </section>

    <section className="reception-settings-highlights" aria-label="Tổng quan tài khoản lễ tân">
      <article><span className="reception-settings-highlight-icon"><UserRound size={21} aria-hidden="true" /></span><small>Vai trò hiện tại</small><strong>Lễ tân</strong><p>Quyền từ phiên đăng nhập</p></article>
      <article><span className="reception-settings-highlight-icon blue"><Bell size={21} aria-hidden="true" /></span><small>Thông báo cá nhân</small><strong>{integrations.notifications ? 'Đang bật' : 'Chưa bật'}</strong><p>Tùy chọn nhận tin</p></article>
      <article><span className="reception-settings-highlight-icon violet"><ShieldCheck size={21} aria-hidden="true" /></span><small>Trạng thái tài khoản</small><strong>{statusLabel(user.status)}</strong><p>Trạng thái hiện tại</p></article>
    </section>

    <div className="reception-settings-layout">
      <nav className="panel reception-settings-nav" aria-label="Danh mục cài đặt lễ tân">
        <span className="reception-settings-eyebrow">THIẾT LẬP CỦA TÔI</span>
        {sections.map(({ id, label, description, icon: Icon }) => <button type="button" key={id}
          className={section === id ? 'is-active' : ''} aria-pressed={section === id} disabled={savingType !== null}
          onClick={() => { setSection(id); setNotice(null); setError(null); }}>
          <span className="reception-settings-nav-icon"><Icon size={19} aria-hidden="true" /></span>
          <span><strong>{label}</strong><small>{description}</small></span>
        </button>)}
        <p className="reception-settings-nav-note"><ShieldCheck size={17} aria-hidden="true" /> Thay đổi chỉ được báo đã lưu sau khi hoàn tất.</p>
      </nav>

      <div className="reception-settings-content">
        {section === 'account' && <>
          <section className="panel reception-settings-panel"><header className="reception-settings-heading"><div><span>THÔNG TIN TÀI KHOẢN</span>
            <h3>Hồ sơ lễ tân</h3><p>Thông tin tài khoản chỉ xem tại đây.</p></div>
            <span className="reception-settings-readonly"><LockKeyhole size={14} aria-hidden="true" /> Chỉ xem</span></header>
            <div className="reception-settings-person"><Avatar label={user.fullName || user.email} size="lg" />
              <div><strong>{user.fullName || user.email}</strong><span>Lễ tân · Tài khoản hiện tại</span></div></div>
            <dl className="reception-settings-fields"><div><dt>Họ và tên</dt><dd>{user.fullName || 'Chưa được cung cấp'}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Số điện thoại</dt><dd>{user.phone || 'Chưa được cung cấp'}</dd></div>
              <div><dt>Mã tài khoản</dt><dd>{user.accountCode || 'Chưa có thông tin'}</dd></div>
              <div><dt>Vai trò đang sử dụng</dt><dd>Lễ tân</dd></div>
              <div><dt>Trạng thái</dt><dd>{statusLabel(user.status)}</dd></div></dl>
            <p className="reception-settings-note"><ShieldCheck size={17} aria-hidden="true" /> Liên hệ quản trị viên để cập nhật tên, email hoặc quyền tài khoản.</p>
          </section>
          <section className="panel reception-settings-panel"><header className="reception-settings-heading"><div><span>BẢO MẬT CÁ NHÂN</span>
            <h3>Phiên đăng nhập và mật khẩu</h3><p>Trạng thái hỗ trợ hiện tại.</p></div><KeyRound size={21} aria-hidden="true" /></header>
            <div className="reception-settings-info"><LockKeyhole size={19} aria-hidden="true" /><div><strong>Đăng xuất</strong><p>Sử dụng nút Đăng xuất trong thanh điều hướng để kết thúc phiên.</p></div><span>Khả dụng</span></div>
            <div className="reception-settings-info"><KeyRound size={19} aria-hidden="true" /><div><strong>Đổi mật khẩu</strong><p>Tính năng đổi mật khẩu hiện chưa khả dụng.</p></div><span>Chưa hỗ trợ</span></div>
          </section>
        </>}

        {section === 'notifications' && <section className="panel reception-settings-panel"><header className="reception-settings-heading"><div><span>TÙY CHỌN CÁ NHÂN</span>
          <h3>Kênh nhận thông báo</h3><p>Chỉ thay đổi tùy chọn của tài khoản đang đăng nhập.</p></div>
          {integrations.notifications && <button type="button" className="soft-button" disabled={loading || savingType !== null}
            onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> Tải lại</button>}</header>
          {!integrations.notifications ? <div className="reception-settings-empty"><Bell size={28} aria-hidden="true" />
            <strong>Tích hợp thông báo chưa được bật</strong><p>Chưa thể tải hoặc lưu tùy chọn lúc này.</p></div> : <>
            {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading || savingType !== null}
              onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
            {notice && <div role="status"><Alert tone="info">{notice}</Alert></div>}
            {loading && <p className="reception-settings-loading" role="status">Đang tải tùy chọn...</p>}
            {!loading && preferences?.length === 0 && <p className="reception-settings-loading">Chưa có tùy chọn nào.</p>}
            {!loading && preferences && <div className="reception-settings-channels">{channels.filter((type) => preferences.some((item) => item.type === type)).map((type) => {
              const preference = preferences.find((item) => item.type === type)!;
              const Icon = channelDetails[type].icon;
              return <label key={type} className="reception-settings-channel"><span className="reception-settings-channel-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="reception-settings-channel-copy"><strong>{channelDetails[type].label}</strong><small>{channelDetails[type].description}</small></span>
                <input type="checkbox" aria-label={`Bật nhận thông báo ${channelDetails[type].label}`} checked={preference.enabled}
                  disabled={loading || savingType !== null || type === 'PUSH'} onChange={(event) => void savePreference(type, event.target.checked)} />
              </label>;
            })}</div>}
            <p className="reception-settings-footnote"><CircleHelp size={16} aria-hidden="true" /> Khả năng nhận tin còn tùy thuộc cấu hình dịch vụ.</p>
          </>}
        </section>}

        {section === 'workflow' && <>
          <section className="panel reception-settings-panel"><header className="reception-settings-heading"><div><span>QUY TRÌNH TIẾP NHẬN</span>
            <h3>Phạm vi công việc lễ tân</h3><p>Các thao tác bạn có thể thực hiện trong công việc tiếp đón.</p></div><Fingerprint size={21} aria-hidden="true" /></header>
            <div className="reception-settings-capabilities"><article><CalendarCheck2 size={21} aria-hidden="true" /><div><strong>Đặt và quản lý lịch hẹn</strong><p>Đặt lịch, xác nhận, đổi hoặc hủy lịch hợp lệ.</p></div><span>{integrations.reception ? 'Đang bật' : 'Chưa bật'}</span></article>
              <article><UsersRound size={21} aria-hidden="true" /><div><strong>Tiếp nhận bệnh nhân</strong><p>Tìm kiếm bệnh nhân, đăng ký bệnh nhân vãng lai và check-in lịch được xác nhận.</p></div><span>{integrations.reception ? 'Đã bật tích hợp' : 'Chưa bật tích hợp'}</span></article>
              <article><ClipboardCheck size={21} aria-hidden="true" /><div><strong>Quản lý hàng đợi</strong><p>Gọi, bỏ qua hoặc đưa lượt trở lại chờ theo trạng thái được phép.</p></div><span>{integrations.reception ? 'Đã bật tích hợp' : 'Chưa bật tích hợp'}</span></article></div>
            <p className="reception-settings-note"><ShieldCheck size={17} aria-hidden="true" /> Lễ tân không bắt đầu hoặc hoàn tất khám, chỉnh sửa bệnh án hay thay đổi quyền tài khoản.</p>
          </section>
          <section className="panel reception-settings-panel"><header className="reception-settings-heading"><div><span>GIỚI HẠN TRUY CẬP</span>
            <h3>Cài đặt hệ thống</h3><p>Chỉ quản trị viên được quản lý cấu hình toàn phòng khám.</p></div><LockKeyhole size={20} aria-hidden="true" /></header>
            <div className="reception-settings-info"><Settings2 size={19} aria-hidden="true" /><div><strong>Cấu hình dịch vụ và phân quyền</strong><p>Không khả dụng trong Cài đặt lễ tân.</p></div><span>Chỉ quản trị</span></div>
            <div className="reception-settings-info"><CheckCircle2 size={19} aria-hidden="true" /><div><strong>Tính năng hiện có</strong><p>Trạng thái hiển thị theo cấu hình hiện tại.</p></div><span>Chỉ xem</span></div>
          </section>
        </>}
      </div>
    </div>
  </div>;
}
