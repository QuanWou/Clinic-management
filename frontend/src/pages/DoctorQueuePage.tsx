import { useEffect, useState } from 'react';
import { getReceptionQueue, updateReceptionQueue } from '../api/clinic';
import { clinicToday } from '../api/staffDashboard';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { QueueStatus, ReceptionVisitResponse } from '../types/domain';
import { formatDate } from '../utils/format';
import { allowedQueueTransitions } from './ReceptionAppointmentsPage';

/** The appointment service derives the doctor's ID from their access token. */
export default function DoctorQueuePage() {
  const [date, setDate] = useState(clinicToday());
  const [visits, setVisits] = useState<ReceptionVisitResponse[] | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setVisits(null); setError(null);
    void getReceptionQueue({ date }).then((result) => {
      if (!active) return;
      if (!Array.isArray(result) || result.some((visit) => visit.visitDate !== date)) {
        throw new Error('Invalid doctor queue response');
      }
      setVisits(result);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Cannot load assigned queue');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, revision]);

  async function change(visit: ReceptionVisitResponse, status: QueueStatus) {
    if (!allowedQueueTransitions(visit.status, 'DOCTOR').includes(status)) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await updateReceptionQueue(visit.id, status);
      if (updated.id !== visit.id || updated.status !== status || updated.appointmentId !== visit.appointmentId) {
        throw new Error('The server did not confirm the queue transition');
      }
      setVisits((previous) => previous?.map((row) => row.id === updated.id ? updated : row) ?? null);
      setNotice('Trạng thái hàng đợi đã được backend xác nhận.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Queue update failed');
      setRevision((value) => value + 1);
    } finally { setBusy(false); }
  }

  return <section className="panel settings-form" aria-label="Hàng đợi bác sĩ được phân công">
    <h3>Hàng đợi của tôi</h3>
    <p>Chỉ hiển thị lượt khám của bác sĩ đang đăng nhập. Hoàn tất lượt khám qua đúng thứ tự trạng thái.</p>
    <label>Ngày khám <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    <button type="button" className="soft-button" disabled={loading || busy} onClick={() => setRevision((value) => value + 1)}>Làm mới</button>
    {loading && <p role="status">Đang tải hàng đợi...</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {!loading && visits?.length === 0 && <p>Không có lượt check-in ngày {formatDate(date)}.</p>}
    {visits?.map((visit) => <article key={visit.id} className="person-row">
      <strong>#{visit.queueNumber} · Bệnh nhân {visit.patientId.slice(0, 8)}</strong>
      <span>Appointment: {visit.appointmentId}</span><Badge tone={visit.status}>{visit.status}</Badge>
      {allowedQueueTransitions(visit.status, 'DOCTOR').map((target) => <button key={target} type="button" disabled={busy}
        onClick={() => void change(visit, target)}>{target}</button>)}
    </article>)}
  </section>;
}