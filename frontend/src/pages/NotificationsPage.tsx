import { useEffect, useState } from 'react';
import {
  ArrowRight, Bell, BellRing, Check, CheckCheck, ChevronLeft, ChevronRight, CircleAlert,
  Clock3, Inbox, LockKeyhole, Mail, RefreshCw, Search, Settings2, ShieldCheck,
  Smartphone, Stethoscope, X
} from 'lucide-react';
import { getNotifications, getNotificationPreferences, markNotificationRead, updateNotificationPreference } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { NotificationPreferenceResponse, NotificationResponse, NotificationType } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import {
  channelLabel, deliveryLabel, filterInbox, inboxCounts, notificationMoment,
  type InboxChannelFilter, type InboxFilter
} from '../utils/notificationInbox';
import './notifications.css';
import './doctor-notifications.css';
import './patientPortal.css';

const PAGE_SIZE = 7;
const channels: InboxChannelFilter[] = ['ALL', 'IN_APP', 'EMAIL', 'SMS', 'PUSH'];
const preferenceDescriptions: Record<NotificationType, string> = {
  IN_APP: 'Nhận thông báo cá nhân ngay trong hộp thư này.',
  EMAIL: 'Nhận thông báo qua thư điện tử.',
  SMS: 'Nhận thông báo qua tin nhắn điện thoại.',
  PUSH: 'Kênh này hiện chưa khả dụng.'
};

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Không thể hoàn tất yêu cầu thông báo.';
}

export default function NotificationsPage({ role }: { role?: ClinicRole }) {
  const isDoctor = role === 'DOCTOR';
  const isPatient = role === 'PATIENT';
  if (!integrations.notifications) {
    return <div className={`notifications-workspace${isDoctor ? ' doctor-notifications' : ''}${isPatient ? ' patient-notifications' : ''}`}>
      <PageHeader title={isDoctor ? 'Thông báo bác sĩ' : isPatient ? 'Thông báo của tôi' : 'Thông báo'} subtitle="Hộp thư cá nhân của tài khoản đang đăng nhập" />
      <section className="notifications-unavailable panel" aria-label="Thông báo chưa được kích hoạt">
        <span className="notifications-unavailable-icon"><Bell size={32} /></span>
        <h3>Hộp thư cá nhân chưa được bật</h3>
        <p>Hộp thư cá nhân hiện chưa khả dụng.</p>
        <Alert tone="info">Thông báo chưa được bật.</Alert>
      </section>
    </div>;
  }
  return <ActiveNotificationsPage isDoctor={isDoctor} isPatient={isPatient} />;
}

function ActiveNotificationsPage({ isDoctor, isPatient }: { isDoctor: boolean; isPatient: boolean }) {
  const [items, setItems] = useState<NotificationResponse[] | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPreferences, setLoadingPreferences] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [savingType, setSavingType] = useState<NotificationType | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('ALL');
  const [channel, setChannel] = useState<InboxChannelFilter>('ALL');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadingPreferences(true);
    setItems(null);
    setPreferences(null);
    setListError(null);
    setPreferencesError(null);
    // This is the current JWT user's inbox, never the staff-wide /api/notifications list.
    void getNotifications().then((mine) => {
      if (!active) return;
      if (!Array.isArray(mine)) throw new Error('Dữ liệu hộp thư không hợp lệ.');
      setItems(mine);
    }).catch((cause: unknown) => {
      if (active) { setItems(null); setListError(message(cause)); }
    }).finally(() => { if (active) setLoading(false); });
    // Preferences have independent failure/loading handling: an unavailable settings API
    // must not hide a successfully loaded personal inbox.
    void getNotificationPreferences().then((prefs) => {
      if (!active) return;
      if (!Array.isArray(prefs)) throw new Error('Dữ liệu tùy chọn thông báo không hợp lệ.');
      setPreferences(prefs);
    }).catch((cause: unknown) => {
      if (active) { setPreferences(null); setPreferencesError(message(cause)); }
    }).finally(() => { if (active) setLoadingPreferences(false); });
    return () => { active = false; };
  }, [revision]);

  const busy = busyId !== null || savingType !== null;
  const counts = items ? inboxCounts(items) : null;
  const filtered = filterInbox(items ?? [], query, filter, channel);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  // These are actual unread messages from /my, not inferred appointments or clinic-wide alerts.
  const personalUnread = isDoctor || isPatient ? (items ?? []).filter((item) => !item.readAt).slice(0, 3) : [];

  async function read(id: string) {
    if (busy || loading) return;
    const current = items?.find((item) => item.id === id);
    if (!current || current.readAt) return;
    setBusyId(id); setActionError(null); setNotice(null);
    try {
      const confirmed = await markNotificationRead(id);
      if (confirmed.id !== id || !confirmed.readAt) throw new Error('Chưa xác nhận được trạng thái đã đọc.');
      setItems((previous) => previous?.map((item) => item.id === id ? confirmed : item) ?? null);
      setNotice('Đã đánh dấu thông báo đã đọc.');
    } catch (cause) { setActionError(message(cause)); }
    finally { setBusyId(null); }
  }

  async function savePreference(type: NotificationType, enabled: boolean) {
    if (busy || loadingPreferences || type === 'PUSH' || !preferences?.some((item) => item.type === type)) return;
    setSavingType(type); setActionError(null); setNotice(null);
    try {
      const confirmed = await updateNotificationPreference(type, enabled);
      if (confirmed.type !== type || confirmed.enabled !== enabled) throw new Error('Chưa xác nhận được tùy chọn thông báo.');
      setPreferences((previous) => previous?.map((item) => item.type === type ? confirmed : item) ?? null);
      setNotice(`Đã lưu tùy chọn ${channelLabel(type)}.`);
    } catch (cause) { setActionError(message(cause)); }
    finally { setSavingType(null); }
  }

  function refresh() {
    if (busy || loading || loadingPreferences) return;
    setActionError(null); setNotice(null);
    setRevision((value) => value + 1);
  }

  function resetFilters() {
    setQuery(''); setFilter('ALL'); setChannel('ALL'); setPage(1); setSelectedId('');
  }

  return <div className={`notifications-workspace${isDoctor ? ' doctor-notifications' : ''}${isPatient ? ' patient-notifications' : ''}`}>
    <PageHeader title={isDoctor ? 'Thông báo bác sĩ' : isPatient ? 'Thông báo của tôi' : 'Thông báo'} subtitle={isDoctor ? 'Hộp thư và cập nhật gửi riêng cho tài khoản bác sĩ của bạn' : isPatient ? 'Theo dõi thông báo riêng của tài khoản bệnh nhân' : 'Theo dõi thông báo gửi đến tài khoản đang đăng nhập'}
      actions={<button type="button" className="soft-button" disabled={busy || loading || loadingPreferences} onClick={refresh}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button>} />

    <section className="notifications-hero" aria-label="Tổng quan hộp thư cá nhân">
      <div className="notifications-hero-copy">
        <span className="notifications-kicker"><ShieldCheck size={15} aria-hidden="true" /> {isDoctor ? 'KHÔNG GIAN BÁC SĨ · HỘP THƯ CÁ NHÂN' : isPatient ? 'KHÔNG GIAN BỆNH NHÂN · HỘP THƯ CỦA TÔI' : 'HỘP THƯ CÁ NHÂN'}</span>
        <h3>{isDoctor ? 'Cập nhật dành riêng cho bác sĩ' : isPatient ? 'Theo dõi thông tin chăm sóc của bạn.' : 'Không bỏ lỡ thông tin quan trọng.'}</h3>
        <p>{isDoctor ? 'Theo dõi thông báo được gửi đến tài khoản của bạn, xem các mục chưa đọc và quản lý kênh nhận tin. Không hiển thị hộp thư của người khác.' : isPatient ? 'Xem thông báo được gửi riêng cho bạn, đánh dấu đã đọc và điều chỉnh kênh nhận tin. Không hiển thị hộp thư của người khác.' : 'Thông báo từ hệ thống được gửi theo quyền của tài khoản. Kiểm tra các cập nhật và quản lý tùy chọn nhận tin tại một nơi.'}</p>
        <span className="notifications-hero-tag"><BellRing size={15} aria-hidden="true" /> Hộp thư riêng tư</span>
      </div>
      <div className="notifications-hero-art" aria-hidden="true">{isDoctor ? <Stethoscope size={69} strokeWidth={1.45} /> : <Bell size={69} strokeWidth={1.45} />}</div>
    </section>

    {actionError && <Alert tone="error">{actionError}</Alert>}
    {notice && <div className="notifications-confirmation" role="status"><Check size={17} aria-hidden="true" /> {notice}</div>}
    {listError && <Alert tone="error">Không tải được hộp thư: {listError} <button type="button" className="soft-button" onClick={refresh} disabled={loading || loadingPreferences || busy}>Thử lại</button></Alert>}

    <section className="notifications-metrics" aria-label="Thống kê hộp thư cá nhân">
      {[
        { title: 'Tổng thông báo', value: counts?.total, icon: Inbox, tone: 'blue', note: 'Trong hộp thư đã tải' },
        { title: 'Chưa đọc', value: counts?.unread, icon: BellRing, tone: 'orange', note: 'Cần bạn xem' },
        { title: 'Đã đọc', value: counts?.read, icon: CheckCheck, tone: 'green', note: 'Đã xem' },
        { title: 'Gửi thất bại', value: counts?.failed, icon: CircleAlert, tone: 'purple', note: 'Cần kiểm tra' }
      ].map(({ title, value, icon: Icon, tone, note }) => <article className={`notifications-metric notifications-metric-${tone}`} key={title}>
        <span className="notifications-metric-icon"><Icon size={21} aria-hidden="true" /></span>
        <strong>{value === undefined ? '—' : value.toLocaleString('vi-VN')}</strong><h4>{title}</h4><p>{note}</p>
      </article>)}
    </section>

    {(isDoctor || isPatient) && <section className="doctor-notifications-focus panel" aria-label={isDoctor ? 'Thông báo chưa đọc dành cho bác sĩ' : 'Thông báo chưa đọc của bệnh nhân'}>
      <div className="doctor-notifications-focus-heading"><div><span className="notifications-section-kicker">CẦN XEM</span>
        <h3>Thông báo chưa đọc của tôi</h3><p>Chọn một thông báo để xem nội dung đầy đủ. Việc mở chi tiết không tự động đánh dấu đã đọc.</p></div>
        <span className="doctor-notifications-focus-count"><BellRing size={16} aria-hidden="true" /> {counts ? `${counts.unread} chưa đọc` : 'Đang tải'}</span>
      </div>
      {loading && <p className="doctor-notifications-focus-empty" role="status">Đang tải thông báo cá nhân...</p>}
      {!loading && listError && <p className="doctor-notifications-focus-empty">Chưa thể xác định thông báo cần xem. Hãy tải lại hộp thư.</p>}
      {!loading && items && personalUnread.length === 0 && <p className="doctor-notifications-focus-empty"><CheckCheck size={18} aria-hidden="true" /> Hiện không có thông báo chưa đọc.</p>}
      {personalUnread.length > 0 && <div className="doctor-notifications-focus-list">{personalUnread.map((item) => <button key={item.id} type="button" className="doctor-notifications-focus-item" disabled={busy}
        onClick={() => { setQuery(''); setFilter('UNREAD'); setChannel('ALL'); setPage(1); setSelectedId(item.id); }}>
        <span className="doctor-notifications-focus-icon"><Bell size={19} aria-hidden="true" /></span>
        <span className="doctor-notifications-focus-copy"><strong>{item.subject || 'Thông báo'}</strong><small>{notificationMoment(item.createdAt ?? item.sentAt)} · {channelLabel(item.type)}</small></span>
        <ArrowRight size={17} aria-hidden="true" />
      </button>)}</div>}
      {counts && counts.unread > personalUnread.length && <p className="doctor-notifications-focus-more">Đang hiển thị {personalUnread.length}/{counts.unread} thông báo chưa đọc. Chọn bộ lọc “Chưa đọc” để xem tất cả.</p>}
    </section>}

    <div className="notifications-columns">
      <div className="notifications-main">
        <section className="panel notifications-list" aria-label="Danh sách thông báo cá nhân">
          <header className="notifications-section-head"><div><span className="notifications-section-kicker">DANH SÁCH</span>
            <h3>Hộp thư của bạn</h3><p>{items ? `${filtered.length} / ${items.length} thông báo phù hợp` : 'Dữ liệu theo tài khoản đang đăng nhập'}</p></div>
            <span className="notifications-scope"><LockKeyhole size={14} aria-hidden="true" /> Riêng tư</span></header>
          <div className="notifications-filters">
            <label className="notifications-search"><Search size={17} aria-hidden="true" /><span className="notifications-sr-only">Tìm thông báo</span>
              <input type="search" aria-label="Tìm thông báo" placeholder="Tìm tiêu đề, nội dung, mã..." value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); setSelectedId(''); }} /></label>
            <label><span className="notifications-sr-only">Lọc kênh thông báo</span><select aria-label="Lọc kênh thông báo" value={channel}
              onChange={(event) => { setChannel(event.target.value as InboxChannelFilter); setPage(1); setSelectedId(''); }}>
              {channels.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'Tất cả kênh' : channelLabel(option)}</option>)}</select></label>
          </div>
          <div className="notifications-tabs" role="group" aria-label="Lọc theo trạng thái đã đọc">
            {(['ALL', 'UNREAD', 'READ'] as InboxFilter[]).map((option) => <button key={option} type="button" className={filter === option ? 'is-active' : ''}
              aria-pressed={filter === option} onClick={() => { setFilter(option); setPage(1); setSelectedId(''); }}>
              {option === 'ALL' ? 'Tất cả' : option === 'UNREAD' ? 'Chưa đọc' : 'Đã đọc'}
              <span>{counts ? option === 'ALL' ? counts.total : option === 'UNREAD' ? counts.unread : counts.read : '—'}</span>
            </button>)}
          </div>
          {loading && <div className="notifications-empty" role="status"><RefreshCw size={23} aria-hidden="true" /><strong>Đang tải thông báo...</strong></div>}
          {!loading && items?.length === 0 && <div className="notifications-empty" role="status"><Inbox size={29} aria-hidden="true" /><strong>Hộp thư chưa có thông báo</strong><p>Chưa có thông báo nào dành cho tài khoản này.</p></div>}
          {!loading && items && items.length > 0 && filtered.length === 0 && <div className="notifications-empty" role="status"><Search size={25} aria-hidden="true" /><strong>Không có kết quả phù hợp</strong><p>Thử thay đổi từ khóa hoặc bộ lọc.</p><button type="button" className="soft-button" onClick={resetFilters}><X size={15} aria-hidden="true" /> Xóa bộ lọc</button></div>}
          {visible.length > 0 && <div className="notifications-items">{visible.map((item) => <article key={item.id} className={`notifications-item ${item.readAt ? 'is-read' : 'is-unread'} ${selected?.id === item.id ? 'is-selected' : ''}`}>
            <span className={`notifications-item-icon notifications-channel-${item.type.toLowerCase()}`} aria-hidden="true">{item.type === 'EMAIL' ? <Mail size={21} /> : item.type === 'SMS' ? <Smartphone size={21} /> : <Bell size={21} />}</span>
            <div className="notifications-item-body"><div className="notifications-item-heading"><strong>{item.subject || 'Thông báo'}</strong>{!item.readAt && <span className="notifications-unread-dot" title="Chưa đọc" />}</div>
              <p>{item.content}</p><div className="notifications-item-meta"><span><Clock3 size={13} aria-hidden="true" /> {notificationMoment(item.createdAt ?? item.sentAt)}</span><span>{channelLabel(item.type)}</span></div></div>
            <div className="notifications-item-actions"><button type="button" className="notifications-detail-button" aria-label={`Xem chi tiết thông báo ${item.subject}`} aria-pressed={selected?.id === item.id}
              onClick={() => setSelectedId(item.id)}>Chi tiết</button>{!item.readAt && <button type="button" className="notifications-read-button" disabled={busy || loading} onClick={() => void read(item.id)}>
                <Check size={14} aria-hidden="true" /> {busyId === item.id ? 'Đang lưu...' : 'Đánh dấu đã đọc'}</button>}</div>
          </article>)}</div>}
          {filtered.length > PAGE_SIZE && <nav className="notifications-pagination" aria-label="Phân trang thông báo">
            <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span><div>
              <button type="button" disabled={busy || currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} /> Trước</button>
              <span>Trang {currentPage}/{totalPages}</span>
              <button type="button" disabled={busy || currentPage >= totalPages} onClick={() => { setPage((value) => Math.min(totalPages, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} /></button>
            </div></nav>}
        </section>
      </div>
      <aside className="notifications-side">
        <section className="panel notifications-detail" aria-label="Chi tiết thông báo">
          <header className="notifications-section-head"><div><span className="notifications-section-kicker">NỘI DUNG</span><h3>Chi tiết thông báo</h3></div><Bell size={20} aria-hidden="true" /></header>
          {selected ? <div className="notifications-detail-content"><span className="notifications-detail-label">{channelLabel(selected.type)}</span>
            <h4>{selected.subject || 'Thông báo'}</h4><p className="notifications-detail-message">{selected.content}</p>
            <dl><div><dt>Ngày tạo</dt><dd>{notificationMoment(selected.createdAt)}</dd></div>
              <div><dt>Trạng thái gửi</dt><dd>{deliveryLabel(selected.status)}</dd></div>
              <div><dt>Trạng thái đọc</dt><dd>{selected.readAt ? `Đã đọc · ${notificationMoment(selected.readAt)}` : 'Chưa đọc'}</dd></div></dl>
            {!selected.readAt && <button type="button" className="notifications-detail-read" disabled={busy || loading} onClick={() => void read(selected.id)}><CheckCheck size={16} aria-hidden="true" /> {busyId === selected.id ? 'Đang lưu...' : 'Đánh dấu đã đọc'}</button>}
          </div> : <div className="notifications-detail-placeholder"><Inbox size={27} aria-hidden="true" /><p>Chọn một thông báo trong danh sách để xem chi tiết.</p></div>}
        </section>
        <section className="panel notifications-preferences" aria-label="Tùy chọn nhận thông báo">
          <header className="notifications-section-head"><div><span className="notifications-section-kicker">CÀI ĐẶT</span><h3>Tùy chọn nhận tin</h3><p>Áp dụng cho tài khoản hiện tại</p></div><Settings2 size={20} aria-hidden="true" /></header>
          {loadingPreferences && <p role="status" className="notifications-preference-note">Đang tải tùy chọn...</p>}
          {preferencesError && <Alert tone="error">Không tải được tùy chọn: {preferencesError} <button type="button" className="soft-button" disabled={busy || loading || loadingPreferences} onClick={refresh}>Thử lại</button></Alert>}
          {preferences?.map((preference) => <label key={preference.type} className="notifications-preference-row">
            <span className="notifications-preference-copy"><strong>{channelLabel(preference.type)}</strong><small>{preferenceDescriptions[preference.type]}</small></span>
            <input type="checkbox" aria-label={`Bật ${channelLabel(preference.type)}`} checked={preference.enabled} disabled={busy || loadingPreferences || preference.type === 'PUSH'}
              onChange={(event) => void savePreference(preference.type, event.target.checked)} />
          </label>)}
          <p className="notifications-preference-note"><ShieldCheck size={15} aria-hidden="true" /> Khả năng nhận tin còn tùy thuộc cấu hình dịch vụ.</p>
        </section>
      </aside>
    </div>
    <p className="notifications-footer-note"><LockKeyhole size={14} aria-hidden="true" /> Chỉ hiển thị thông báo cá nhân. Trang không tự động cập nhật; dùng “Làm mới” để kiểm tra thông báo mới.</p>
  </div>;
}
