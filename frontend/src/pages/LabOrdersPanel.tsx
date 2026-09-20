import { type FormEvent, useEffect, useState } from 'react';
import { changeLabOrder, createLabOrder, getAppointment, getCatalogServices, getLabOrders } from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import type { CatalogServiceResponse, LabOrderResponse, MedicalRecordResponse } from '../types/domain';

/** Never shows unreleased laboratory results to patients; the backend also filters them. */
export default function LabOrdersPanel({ record, doctor }: { record: MedicalRecordResponse; doctor: boolean }) {
  const [orders, setOrders] = useState<LabOrderResponse[] | null>(null);
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [performedOn, setPerformedOn] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [sampleIdentifier, setSampleIdentifier] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [resultUnit, setResultUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true); setOrders(null); setError(null); setNotice(null);
    const details = doctor ? Promise.all([getCatalogServices(), getAppointment(record.appointmentId)]) : Promise.resolve(null);
    void Promise.all([getLabOrders(record.id), details]).then(([rows, extra]) => {
      if (!active) return;
      if (!Array.isArray(rows) || rows.some((order) => order.medicalRecordId !== record.id)) {
        throw new Error('Unexpected laboratory data for this medical record');
      }
      // Defense in depth in addition to the backend's patient-release filter.
      setOrders(doctor ? rows : rows.filter((order) => order.status === 'RELEASED'));
      if (extra) {
        const [catalog, appointment] = extra;
        if (!Array.isArray(catalog) || appointment.id !== record.appointmentId || appointment.status !== 'COMPLETED') {
          throw new Error('Unable to verify completed appointment or catalog');
        }
        setServices(catalog.filter((item) => item.active));
        setPerformedOn(appointment.appointmentDate);
      }
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Cannot load lab orders');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [record.id, record.appointmentId, doctor, revision]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const service = services?.find((item) => item.id === serviceId);
    if (!doctor || !service || !performedOn) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const created = await createLabOrder(record.id, { serviceId: service.id, testCode: service.code,
        testName: service.name, performedOn });
      if (created.medicalRecordId !== record.id || created.serviceId !== service.id || created.status !== 'ORDERED') {
        throw new Error('The server did not confirm this laboratory order');
      }
      setOrders((previous) => previous ? [created, ...previous] : [created]);
      setServiceId(''); setNotice('Chỉ định xét nghiệm đã được ghi nhận.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Cannot create lab order'); }
    finally { setBusy(false); }
  }

  const selected = orders?.find((order) => order.id === selectedOrderId) ?? null;
  async function transition(action: 'sample' | 'processing' | 'result' | 'release', expected: LabOrderResponse['status'], body?: object) {
    if (!doctor || !selected) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const updated = await changeLabOrder(selected.id, action, body);
      if (updated.id !== selected.id || updated.medicalRecordId !== record.id || updated.status !== expected) {
        throw new Error('The server did not confirm the laboratory transition');
      }
      setOrders((previous) => previous?.map((order) => order.id === updated.id ? updated : order) ?? null);
      setSampleIdentifier(''); setResultValue(''); setResultUnit(''); setReferenceRange('');
      setNotice('Trạng thái xét nghiệm đã được backend xác nhận.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cannot update lab order');
      setRevision((value) => value + 1);
    } finally { setBusy(false); }
  }

  return <section className="panel settings-form" aria-label="Xét nghiệm của hồ sơ được cấp quyền">
    <h3>Xét nghiệm · Hồ sơ {record.id.slice(0, 8)}</h3>
    <button type="button" className="soft-button" disabled={busy || loading}
      onClick={() => setRevision((value) => value + 1)}>Làm mới xét nghiệm</button>
    {loading && <p role="status">Đang tải xét nghiệm...</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {!loading && orders?.length === 0 && <p>{doctor ? 'Chưa có chỉ định xét nghiệm.' : 'Chưa có kết quả xét nghiệm được công bố.'}</p>}
    {orders?.map((order) => <article key={order.id} className="person-row">
      <strong>{order.testName} ({order.testCode})</strong><Badge tone={order.status}>{order.status}</Badge>
      {order.status === 'RELEASED' && <p>Kết quả: {order.resultValue ?? 'Chưa ghi nhận'} {order.resultUnit ?? ''} · Khoảng tham chiếu: {order.referenceRange ?? 'Không có'}</p>}
      {doctor && order.status === 'RESULTED' && <p>Đã nhập kết quả; cần công bố để bệnh nhân xem.</p>}
      {doctor && order.status === 'PROCESSING' && <p>Đang xử lý mẫu; kết quả chưa công bố.</p>}
      {doctor && order.status !== 'RELEASED' && <button type="button" disabled={busy}
        onClick={() => setSelectedOrderId(order.id)}>Xử lý chỉ định</button>}
    </article>)}
    {doctor && selected && selected.status !== 'RELEASED' && <div className="panel settings-form">
      <h4>Xử lý: {selected.testName}</h4>
      {selected.status === 'ORDERED' && <form onSubmit={(event) => { event.preventDefault(); void transition('sample', 'COLLECTED', { sampleIdentifier }); }}>
        <label>Mã mẫu<input value={sampleIdentifier} required maxLength={100} onChange={(event) => setSampleIdentifier(event.target.value)} /></label>
        <button disabled={busy || !sampleIdentifier.trim()} type="submit">Xác nhận lấy mẫu</button>
      </form>}
      {selected.status === 'COLLECTED' && <button disabled={busy} type="button" onClick={() => void transition('processing', 'PROCESSING')}>Bắt đầu xử lý mẫu</button>}
      {selected.status === 'PROCESSING' && <form onSubmit={(event) => { event.preventDefault(); void transition('result', 'RESULTED', { value: resultValue, unit: resultUnit, referenceRange }); }}>
        <label>Kết quả<input value={resultValue} required maxLength={4000} onChange={(event) => setResultValue(event.target.value)} /></label>
        <label>Đơn vị<input value={resultUnit} maxLength={100} onChange={(event) => setResultUnit(event.target.value)} /></label>
        <label>Khoảng tham chiếu<input value={referenceRange} maxLength={255} onChange={(event) => setReferenceRange(event.target.value)} /></label>
        <button disabled={busy || !resultValue.trim()} type="submit">Ghi kết quả</button>
      </form>}
      {selected.status === 'RESULTED' && <button disabled={busy} type="button"
        onClick={() => void transition('release', 'RELEASED')}>Công bố kết quả cho bệnh nhân</button>}
    </div>}
    {doctor && services && performedOn && <form onSubmit={(event) => void create(event)}>
      <h4>Chỉ định xét nghiệm mới</h4>
      <p>Chỉ dùng dịch vụ đang hoạt động trong Catalog, ngày thực hiện: {performedOn}.</p>
      <label>Dịch vụ xét nghiệm <select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
        <option value="">{services.length ? 'Chọn dịch vụ' : 'Catalog chưa có dịch vụ'}</option>
        {services.map((service) => <option value={service.id} key={service.id}>{service.code} — {service.name}</option>)}
      </select></label>
      <button type="submit" disabled={busy || !serviceId}>Tạo chỉ định</button>
    </form>}
  </section>;
}