import { useEffect, useState } from 'react';
import {
  Bell, CheckCircle2, CircleHelp, Fingerprint, KeyRound, LockKeyhole,
  Mail, MessageSquare, Monitor, RefreshCw, Settings2, ShieldCheck,
  Smartphone, UserRound
} from 'lucide-react';
import { getNotificationPreferences, updateNotificationPreference } from '../api/clinic';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { CurrentUser, NotificationPreferenceResponse, NotificationType } from '../types/domain';
import { normalizeRoles } from '../utils/roles';
import './AdminSettingsPage.css';

export type AdminSettingsTab = 'account' | 'notifications' | 'system';

const channelLabels: Record<NotificationType, { title: string; description: string }> = {
  EMAIL: { title: 'Email', description: 'Nhận thông báo qua thư điện tử khi hệ thống hỗ trợ gửi.' },
  SMS: { title: 'SMS', description: 'Tùy chọn nhận thông báo qua tin nhắn điện thoại.' },
  PUSH: { title: 'Push', description: 'Chưa có nhà cung cấp Push; không thể bật trong phiên bản này.' },
  IN_APP: { title: 'Trong ứng dụng', description: 'Tùy chọn thông báo trong hộp thư cá nhân.' }
};
const channels: NotificationType[] = ['IN_APP', 'EMAIL', 'SMS', 'PUSH'];

function apiMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể tải hoặc lưu tùy chọn thông báo.';
}

export default function AdminSettingsPage({ user }: { user: CurrentUser }) {
  const [tab, setTab] = useState<AdminSettingsTab>('account');
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const roles = normalizeRoles(user.roles);
  const accountStatus = user.status === 'ACTIVE' ? 'Đang hoạt động'
    : user.status === 'LOCKED' ? 'Đã khóa'
      : user.status === 'INACTIVE' ? 'Ngừng hoạt động' : 'Chưa có thông tin';

  useEffect(() => {
    if (!integrations.notifications || tab !== 'notifications') return;
    let active = true;
    setLoading(true);
    setPreferenceError(null);
    setNotice(null);
    setPreferences(null);
    void getNotificationPreferences().then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((item) => !item || !channels.includes(item.type)
        || typeof item.enabled !== 'boolean') || new Set(result.map((item) => item.type)).size !== result.length) {
        throw new Error('Dữ liệu tùy chọn thông báo không hợp lệ.');
      }
      setPreferences(result);
    }).catch((cause: unknown) => { if (active) setPreferenceError(apiMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision, tab]);

  async function changePreference(type: NotificationType, enabled: boolean) {
    if (!integrations.notifications || type === 'PUSH' || savingType || !preferences?.some((item) => item.type === type)) return;
    setSavingType(type);
    setNotice(null);
    setPreferenceError(null);
    try {
      const confirmed = await updateNotificationPreference(type, enabled);
      if (!confirmed || confirmed.type !== type || confirmed.enabled !== enabled) {
        throw new Error('Máy chủ chưa xác nhận thay đổi. Vui lòng tải lại tùy chọn.');
      }
      setPreferences((current) => current?.map((item) => item.type === type ? confirmed : item) ?? null);
      setNotice(`Đã ${enabled ? 'bật' : 'tắt'} tùy chọn ${channelLabels[type].title} theo xác nhận từ máy chủ.`);
    } catch (cause) {
      setPreferenceError(apiMessage(cause));
    } finally {
      setSavingType(null);
    }
  }

  const tabs = [
    { id: 'account' as const, label: 'Tài khoản', description: 'Thông tin và vai trò', icon: UserRound },
    { id: 'notifications' as const, label: 'Thông báo', description: 'Tùy chọn nhận tin', icon: Bell },
    { id: 'system' as const, label: 'Hệ thống', description: 'Trạng thái cấu hình giao diện', icon: Settings2 }
  ];
  const features = [
    { name: 'Danh mục', enabled: integrations.adminCatalog },
    { name: 'Tiếp nhận và lịch hẹn', enabled: integrations.reception },
    { name: 'Xét nghiệm', enabled: integrations.laboratory },
    { name: 'Hóa đơn', enabled: integrations.billing },
    { name: 'Thông báo', enabled: integrations.notifications }
  ];

  return <div className="admin-settings-workspace">
    <PageHeader title="Cài đặt" subtitle="Thông tin tài khoản và các tùy chọn được hệ thống hỗ trợ" />
    <section className="admin-settings-hero" aria-label="Tổng quan cài đặt">
      <div className="admin-settings-hero-copy">
        <span className="admin-settings-kicker"><ShieldCheck size={15} aria-hidden="true" /> KHÔNG GIAN QUẢN TRỊ</span>
        <h3>Thiết lập rõ ràng, quản lý an toàn.</h3>
        <p>Xem thông tin tài khoản, điều chỉnh tùy chọn thông báo cá nhân và kiểm tra cấu hình giao diện được triển khai.</p>
        <div className="admin-settings-hero-tags"><span><LockKeyhole size={14} aria-hidden="true" /> Chỉ trong tài khoản hiện tại</span>
          <span><CheckCircle2 size={14} aria-hidden="true" /> Không dùng dữ liệu mẫu</span></div>
      </div>
      <div className="admin-settings-hero-symbol" aria-hidden="true"><Settings2 size={58} strokeWidth={1.4} /></div>
    </section>

    <section className="admin-settings-highlights" aria-label="Trạng thái cài đặt">
      <article className="admin-settings-highlight"><span className="admin-settings-highlight-icon"><Fingerprint size={22} /></span>
        <span>Vai trò đang sử dụng</span><strong>Quản trị viên</strong><small>Được xác định từ phiên đăng nhập</small></article>
      <article className="admin-settings-highlight blue"><span className="admin-settings-highlight-icon"><Bell size={22} /></span>
        <span>Thông báo cá nhân</span><strong>{integrations.notifications ? 'Có cấu hình API' : 'Chưa bật tích hợp'}</strong><small>Không đồng nghĩa với xác nhận gửi tin thành công</small></article>
      <article className="admin-settings-highlight violet"><span className="admin-settings-highlight-icon"><ShieldCheck size={22} /></span>
        <span>Trạng thái tài khoản</span><strong>{accountStatus}</strong><small>Theo thông tin Identity cung cấp</small></article>
    </section>

    <section className="admin-settings-layout" aria-label="Khu vực cài đặt">
      <nav className="panel admin-settings-navigation" aria-label="Danh mục cài đặt">
        <p className="admin-settings-nav-caption">CÀI ĐẶT CÁ NHÂN</p>
        {tabs.map(({ id, label, description, icon: Icon }) => <button key={id} type="button" aria-pressed={tab === id}
          className={tab === id ? 'admin-settings-nav-item is-active' : 'admin-settings-nav-item'}
          onClick={() => { setTab(id); setNotice(null); }}>
          <span><Icon size={19} aria-hidden="true" /></span><span><strong>{label}</strong><small>{description}</small></span>
        </button>)}
        <div className="admin-settings-navigation-foot"><CircleHelp size={18} aria-hidden="true" />
          <p>Chỉ các thay đổi được API xác nhận mới được thông báo đã lưu.</p></div>
      </nav>

      <div className="admin-settings-content">
        {tab === 'account' && <>
          <article className="panel admin-settings-panel">
            <div className="admin-settings-heading"><div><span className="admin-settings-eyebrow">HỒ SƠ TÀI KHOẢN</span>
              <h3>Thông tin quản trị viên</h3><p>Dữ liệu tài khoản trả về từ Identity, chỉ đọc trong trang này.</p></div>
              <span className="admin-settings-pill"><LockKeyhole size={13} aria-hidden="true" /> Chỉ xem</span></div>
            <div className="admin-settings-identity"><Avatar label={user.fullName || user.email} size="lg" />
              <div><strong>{user.fullName || user.email}</strong><span>{roles.join(' · ') || 'Chưa xác định vai trò'}</span></div></div>
            <dl className="admin-settings-fields">
              <div><dt>Họ và tên</dt><dd>{user.fullName || 'Chưa được cung cấp'}</dd></div>
              <div><dt>Email</dt><dd>{user.email}</dd></div>
              <div><dt>Số điện thoại</dt><dd>{user.phone || 'Chưa được cung cấp'}</dd></div>
              <div><dt>Mã tài khoản</dt><dd>{user.userId || user.id || 'Chưa được cung cấp'}</dd></div>
              <div><dt>Vai trò</dt><dd>{roles.join(', ') || 'Chưa xác định'}</dd></div>
              <div><dt>Trạng thái</dt><dd>{accountStatus}</dd></div>
            </dl>
            <div className="admin-settings-explainer"><ShieldCheck size={19} aria-hidden="true" />
              <p>Trang này không hỗ trợ tự sửa tài khoản. Không có thay đổi tên, email hoặc vai trò nào được gửi lên máy chủ.</p></div>
          </article>
          <article className="panel admin-settings-panel admin-settings-security">
            <div className="admin-settings-heading"><div><span className="admin-settings-eyebrow">BẢO MẬT TÀI KHOẢN</span>
              <h3>Phiên đăng nhập và mật khẩu</h3><p>Các tùy chọn bảo mật trong phiên hiện tại.</p></div><KeyRound size={22} aria-hidden="true" /></div>
            <div className="admin-settings-info-row"><LockKeyhole size={19} aria-hidden="true" /><div><strong>Đăng xuất</strong><p>Dùng nút Đăng xuất ở thanh điều hướng để kết thúc phiên.</p></div><span>Khả dụng</span></div>
            <div className="admin-settings-info-row"><KeyRound size={19} aria-hidden="true" /><div><strong>Đổi mật khẩu</strong><p>Chưa có quy trình đổi mật khẩu cá nhân được kết nối vào trang này.</p></div><span>Chưa hỗ trợ</span></div>
          </article>
        </>}

        {tab === 'notifications' && <article className="panel admin-settings-panel">
          <div className="admin-settings-heading"><div><span className="admin-settings-eyebrow">THÔNG BÁO CÁ NHÂN</span>
            <h3>Kênh nhận thông báo</h3><p>Chỉ cập nhật tùy chọn của tài khoản đang đăng nhập.</p></div>
            {integrations.notifications && <button type="button" className="soft-button" disabled={loading || savingType !== null}
              onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} aria-hidden="true" /> Tải lại</button>}</div>
          {!integrations.notifications ? <div className="admin-settings-empty"><Bell size={27} aria-hidden="true" />
            <strong>Tích hợp thông báo chưa được bật</strong><p>Chưa thể xem hoặc thay đổi tùy chọn khi API thông báo không được kích hoạt trong bản triển khai.</p></div>
            : <>
              {preferenceError && <Alert tone="error">{preferenceError} <button type="button" disabled={loading || savingType !== null}
                onClick={() => setRevision((value) => value + 1)}>Thử lại</button></Alert>}
              {notice && <div role="status"><Alert tone="info">{notice}</Alert></div>}
              {loading && <p role="status" className="admin-settings-loading">Đang tải tùy chọn từ máy chủ...</p>}
              {!loading && preferences?.length === 0 && <p className="admin-settings-loading">Máy chủ chưa trả về kênh thông báo nào.</p>}
              {!loading && preferences && <div className="admin-settings-channels">
                {channels.filter((type) => preferences.some((item) => item.type === type)).map((type) => {
                  const preference = preferences.find((item) => item.type === type)!;
                  const Icon = type === 'EMAIL' ? Mail : type === 'SMS' ? MessageSquare : type === 'PUSH' ? Smartphone : Monitor;
                  return <label key={type} className="admin-settings-channel">
                    <span className="admin-settings-channel-icon"><Icon size={21} aria-hidden="true" /></span>
                    <span className="admin-settings-channel-copy"><strong>{channelLabels[type].title}</strong><small>{channelLabels[type].description}</small></span>
                    <input type="checkbox" aria-label={`Bật nhận thông báo ${channelLabels[type].title}`} checked={preference.enabled}
                      disabled={savingType !== null || type === 'PUSH'} onChange={(event) => void changePreference(type, event.target.checked)} />
                  </label>;
                })}</div>}
              <p className="admin-settings-footnote">Thay đổi chỉ hiển thị sau khi API xác nhận. Bật một kênh không bảo đảm hệ thống đã cấu hình nhà cung cấp gửi tin.</p>
            </>}
        </article>}

        {tab === 'system' && <>
          <article className="panel admin-settings-panel">
            <div className="admin-settings-heading"><div><span className="admin-settings-eyebrow">CẤU HÌNH TRIỂN KHAI</span>
              <h3>Tích hợp giao diện</h3><p>Thông tin từ các cờ cấu hình frontend, không phải kiểm tra sức khỏe server.</p></div>
              <span className="admin-settings-pill"><Settings2 size={13} aria-hidden="true" /> Chỉ xem</span></div>
            <div className="admin-settings-features">{features.map((feature) => <div className="admin-settings-feature" key={feature.name}>
              <span className={feature.enabled ? 'admin-settings-feature-icon enabled' : 'admin-settings-feature-icon'}>
                {feature.enabled ? <CheckCircle2 size={18} aria-hidden="true" /> : <CircleHelp size={18} aria-hidden="true" />}</span>
              <strong>{feature.name}</strong><span className={feature.enabled ? 'admin-settings-state enabled' : 'admin-settings-state'}>
                {feature.enabled ? 'Bật trong giao diện' : 'Chưa bật'}</span></div>)}</div>
            <p className="admin-settings-footnote">Trạng thái này không chứng minh API đã kết nối, có dữ liệu hay gửi thông báo thành công.</p>
          </article>
          <article className="panel admin-settings-panel">
            <div className="admin-settings-heading"><div><span className="admin-settings-eyebrow">THIẾT LẬP PHÒNG KHÁM</span>
              <h3>Cấu hình chung</h3><p>Chức năng này cần API lưu cấu hình riêng và phân quyền Admin.</p></div></div>
            <div className="admin-settings-explainer"><LockKeyhole size={20} aria-hidden="true" />
              <p>Chưa có API cấu hình chung được kết nối cho tên phòng khám, giờ hoạt động hoặc chính sách đặt lịch. Không có biểu mẫu lưu giả hay cấu hình chỉ lưu trong trình duyệt.</p></div>
          </article>
        </>}
      </div>
    </section>
  </div>;
}
