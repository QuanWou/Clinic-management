import { useEffect, useMemo, useRef, useState } from 'react';
import { FlaskConical, Plus, RefreshCw } from 'lucide-react';
import { createLabOrder, getCatalogServices, getLabOrders } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { CatalogServiceResponse, LabOrderResponse, MedicalRecordResponse } from '../types/domain';

type Props = {
  record: MedicalRecordResponse;
  performedOn: string;
  canOrder: boolean;
};

function newRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'lab-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

export default function EncounterLabOrdersPanel({ record, performedOn, canOrder }: Props) {
  const [orders, setOrders] = useState<LabOrderResponse[] | null>(null);
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [duplicateReason, setDuplicateReason] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const requestKey = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    void Promise.all([getLabOrders(record.id), getCatalogServices()])
      .then(([rows, catalog]) => {
        if (!active) return;
        if (!Array.isArray(rows) || rows.some((order) => order.medicalRecordId !== record.id)) {
          throw new Error('Máy chủ trả danh sách xét nghiệm không khớp bệnh án đang mở.');
        }
        setOrders(rows);
        setServices(catalog.filter((item) => item.active));
      })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Không tải được chỉ định xét nghiệm.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [record.id, revision]);

  const selected = useMemo(() => services?.find((item) => item.id === serviceId) ?? null, [services, serviceId]);

  function resetIntent() {
    requestKey.current = null;
    setDuplicateWarning(false);
    setDuplicateReason('');
  }

  async function submit(allowDuplicate: boolean) {
    if (!selected || !canOrder || busy) return;
    if (!requestKey.current) requestKey.current = newRequestKey();
    setBusy(true); setError(null); setNotice(null);
    try {
      const created = await createLabOrder(record.id, {
        serviceId: selected.id,
        testCode: selected.code,
        testName: selected.name,
        performedOn,
        allowDuplicate,
        duplicateReason: allowDuplicate ? duplicateReason.trim() : null
      }, requestKey.current);
      if (created.medicalRecordId !== record.id || created.serviceId !== selected.id || created.status !== 'ORDERED') {
        throw new Error('Máy chủ chưa xác nhận đúng chỉ định xét nghiệm.');
      }
      setOrders((previous) => previous?.some((item) => item.id === created.id)
        ? previous
        : previous ? [created, ...previous] : [created]);
      setServiceId('');
      resetIntent();
      setNotice('Chỉ định xét nghiệm đã được ghi nhận.');
    } catch (cause) {
      if (cause instanceof HttpApiError && cause.status === 409
          && cause.message.toLowerCase().includes('already ordered')) {
        setDuplicateWarning(true);
        setError(null);
      } else {
        setError(cause instanceof Error ? cause.message : 'Không thể tạo chỉ định xét nghiệm.');
        setRevision((value) => value + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel doctor-encounter-module" aria-label="Chỉ định xét nghiệm trong lượt khám">
    <div className="doctor-encounter-section-head">
      <div><span>CHỈ ĐỊNH</span><h3><FlaskConical size={19} /> Xét nghiệm</h3></div>
      <button type="button" className="soft-button" disabled={busy || loading}
        onClick={() => setRevision((value) => value + 1)}><RefreshCw size={15} /> Làm mới</button>
    </div>
    {loading && <p role="status">Đang tải xét nghiệm...</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}

    {canOrder && <div className="doctor-encounter-order-form">
      <label>Dịch vụ xét nghiệm
        <select value={serviceId} disabled={busy} onChange={(event) => { setServiceId(event.target.value); resetIntent(); }}>
          <option value="">Chọn từ danh mục đang hoạt động</option>
          {services?.map((service) => <option key={service.id} value={service.id}>{service.code} · {service.name}</option>)}
        </select>
      </label>
      {!duplicateWarning && <button type="button" disabled={busy || !selected}
        onClick={() => void submit(false)}><Plus size={16} /> Thêm chỉ định</button>}
      {duplicateWarning && <div className="doctor-encounter-duplicate">
        <Alert tone="info">Xét nghiệm này đã có trong bệnh án. Chỉ xác nhận lặp lại khi có chủ đích lâm sàng.</Alert>
        <label>Lý do chỉ định lặp
          <textarea rows={2} maxLength={500} value={duplicateReason}
            onChange={(event) => setDuplicateReason(event.target.value)} />
        </label>
        <div>
          <button type="button" className="soft-button" disabled={busy} onClick={resetIntent}>Hủy</button>
          <button type="button" disabled={busy || !duplicateReason.trim()} onClick={() => void submit(true)}>Xác nhận chỉ định lặp</button>
        </div>
      </div>}
    </div>}

    {!canOrder && <p className="doctor-encounter-module-readonly">Chỉ định mới chỉ được tạo khi bệnh án còn bản nháp và lượt khám đang diễn ra.</p>}
    <div className="doctor-encounter-order-list">
      {!loading && orders?.length === 0 && <p>Chưa có chỉ định xét nghiệm.</p>}
      {orders?.map((order) => <article key={order.id}>
        <div><strong>{order.testName}</strong><span>{order.testCode} · {order.performedOn}</span></div>
        <Badge tone={order.status}>{order.status}</Badge>
      </article>)}
    </div>
  </section>;
}
