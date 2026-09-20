import { useEffect, useState } from 'react';
import { getNotifications, getNotificationPreferences, markNotificationRead, updateNotificationPreference } from '../api/clinic';
import Alert from '../components/Alert';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { NotificationPreferenceResponse, NotificationResponse, NotificationType } from '../types/domain';
import { formatDate } from '../utils/format';

export default function NotificationsPage() {
  if (!integrations.notifications) {
    return <><PageHeader title="Thông báo" subtitle="Hộp thư của bạn" />
      <Alert tone="info">Hộp thư cá nhân chưa được bật trong cấu hình triển khai này.</Alert></>;
  }
  return <ActiveNotificationsPage />;
}

function ActiveNotificationsPage() {
  const [items, setItems] = useState<NotificationResponse[] | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferenceResponse[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    // Never use the privileged/global /api/notifications list for this inbox.
    void Promise.all([getNotifications(), getNotificationPreferences()]).then(([mine, prefs]) => {
      if (!active) return;
      if (!Array.isArray(mine) || !Array.isArray(prefs)) throw new Error('Invalid notification data');
      setItems(mine);
      setPreferences(prefs);
    }).catch((cause: unknown) => { if (active) { setItems(null); setPreferences(null); setError(message(cause)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [revision]);

  async function read(id: string) {
    setBusy(true); setError(null);
    try {
      const confirmed = await markNotificationRead(id);
      if (confirmed.id !== id || !confirmed.readAt) throw new Error('Server did not confirm the read status.');
      setItems((previous) => previous?.map((item) => item.id === id ? confirmed : item) ?? null);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  async function setPreference(type: NotificationType, enabled: boolean) {
    setBusy(true); setError(null);
    try {
      const confirmed = await updateNotificationPreference(type, enabled);
      if (confirmed.type !== type || confirmed.enabled !== enabled) throw new Error('Server did not confirm your preference.');
      setPreferences((previous) => previous?.map((item) => item.type === type ? confirmed : item) ?? null);
    } catch (cause) { setError(message(cause)); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Thông báo cá nhân" subtitle="Chỉ hiển thị thông báo gửi tới tài khoản đang đăng nhập"
      actions={<button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Refresh</button>} />
    {error && <Alert tone="error">{error} <button type="button" disabled={loading} onClick={() => setRevision((value) => value + 1)}>Retry</button></Alert>}
    {loading && <p role="status">Đang tải thông báo...</p>}
    {!loading && items?.length === 0 && <p>Chưa có thông báo nào dành cho tài khoản này.</p>}
    {items?.map((item) => <article className="panel" key={item.id}>
      <h3>{item.subject}</h3><p>{item.content}</p><p>{formatDate(item.createdAt ?? item.sentAt)}</p>
      {item.readAt ? <span>Read</span> : <button type="button" disabled={busy} onClick={() => void read(item.id)}>Mark as read</button>}
    </article>)}
    {preferences && <section className="panel settings-form"><h3>Delivery preferences</h3>
      {preferences.map((preference) => <label key={preference.type}>{preference.type}
        <input type="checkbox" checked={preference.enabled} disabled={busy}
          onChange={(event) => void setPreference(preference.type, event.target.checked)} />
      </label>)}
    </section>}
  </>;
}

function message(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Notification request failed';
}