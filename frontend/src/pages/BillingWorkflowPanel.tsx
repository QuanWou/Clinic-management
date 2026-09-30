import { type FormEvent, useState } from 'react';
import {
  addPerformedService, createInvoice, finalizeLabBillableItems, finalizePerformedServices,
  getAppointment, getCatalogServices, getLabBillableItems, getPerformedServices, removePerformedService
} from '../api/clinic';
import Alert from '../components/Alert';
import type { AppointmentResponse, CatalogServiceResponse, InvoiceResponse, LabBillableItemsResponse, PerformedServicesResponse } from '../types/domain';

const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;

/** Cashiers finalize authoritative service/lab revisions before requesting a priced invoice. */
export default function BillingWorkflowPanel({ onCreated }: { onCreated: (invoice: InvoiceResponse) => void }) {
  const [appointmentId, setAppointmentId] = useState('');
  const [appointment, setAppointment] = useState<AppointmentResponse | null>(null);
  const [performed, setPerformed] = useState<PerformedServicesResponse | null>(null);
  const [laboratory, setLaboratory] = useState<LabBillableItemsResponse | null>(null);
  const [catalog, setCatalog] = useState<CatalogServiceResponse[] | null>(null);
  const [serviceId, setServiceId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function reset() {
    setAppointment(null); setPerformed(null); setLaboratory(null); setCatalog(null);
    setError(null); setNotice(null); setServiceId('');
  }

  async function load(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); reset();
    if (!uuid.test(appointmentId)) { setError('Nhập mã lịch hẹn hợp lệ.'); return; }
    setBusy(true);
    try {
      const [booking, services, lab, catalogRows] = await Promise.all([
        getAppointment(appointmentId), getPerformedServices(appointmentId),
        getLabBillableItems(appointmentId), getCatalogServices()
      ]);
      if (booking.id !== appointmentId || services.appointmentId !== appointmentId ||
          lab.appointmentId !== appointmentId || !Array.isArray(services.items) || !Array.isArray(lab.items) ||
          !Array.isArray(catalogRows)) throw new Error('Dữ liệu tính phí không khớp với lịch hẹn.');
      if (booking.status !== 'COMPLETED') throw new Error('Chỉ được xuất hóa đơn sau khi lịch hẹn hoàn thành');
      setAppointment(booking); setPerformed(services); setLaboratory(lab);
      setCatalog(catalogRows.filter((item) => item.active));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu tính phí'); }
    finally { setBusy(false); }
  }

  async function update(action: () => Promise<PerformedServicesResponse | LabBillableItemsResponse>, kind: 'service' | 'lab', label: string) {
    if (!appointment) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await action();
      if (result.appointmentId !== appointment.id) throw new Error('Dữ liệu trả về không khớp với lịch hẹn.');
      if (kind === 'service') setPerformed(result as PerformedServicesResponse);
      else setLaboratory(result as LabBillableItemsResponse);
      setNotice(label);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa thể xác nhận thao tác.'); }
    finally { setBusy(false); }
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointment || !catalog?.some((service) => service.id === serviceId)
        || !Number.isSafeInteger(quantity) || quantity <= 0) return;
    await update(() => addPerformedService(appointment.id, { serviceId, quantity,
      serviceDate: appointment.appointmentDate }), 'service', 'Dịch vụ đã thực hiện được ghi nhận.');
    setServiceId(''); setQuantity(1);
  }

  async function issue() {
    if (!appointment || !performed?.finalized || !laboratory?.finalizedForBilling) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const issued = await createInvoice(appointment.id);
      if (issued.appointmentId !== appointment.id || issued.status !== 'UNPAID'
          || issued.currency !== 'VND' || !issued.items?.length) {
        throw new Error('Chưa thể xác nhận hóa đơn có đơn giá và trạng thái hợp lệ.');
      }
      onCreated(issued);
      reset(); setAppointmentId('');
      setNotice(`Hóa đơn ${issued.id} đã được tạo ở trạng thái chưa thanh toán.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể phát hành hóa đơn'); }
    finally { setBusy(false); }
  }

  return <section className="panel settings-form" aria-label="Quy trình xuất hóa đơn">
    <h3>Xuất hóa đơn</h3>
    <p>Hoàn tất các bước khám, dịch vụ và xét nghiệm trước khi phát hành.</p>
    <form onSubmit={(event) => void load(event)}>
      <label>Mã lịch hẹn đã hoàn thành<input required value={appointmentId}
        onChange={(event) => { reset(); setAppointmentId(event.target.value.trim()); }} /></label>
      <button type="submit" disabled={busy || !appointmentId}>Kiểm tra chi phí</button>
    </form>
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {appointment && performed && laboratory && <>
      <h4>Lịch hẹn: {appointment.id}</h4>
      <p>Ngày khám: {appointment.appointmentDate} · Trạng thái: {appointment.status}</p>
      <h4>Dịch vụ thực hiện ({performed.items.length}) {performed.finalized ? '· Đã chốt' : '· Chưa chốt'}</h4>
      {performed.items.map((item) => <div className="person-row" key={item.performedItemId}>
        <strong>{catalog?.find((service) => service.id === item.serviceId)?.name ?? item.serviceId}</strong>
        <span>Số lượng: {item.quantity}, ngày: {item.serviceDate}</span>
        {!performed.finalized && <button type="button" disabled={busy}
          onClick={() => void update(() => removePerformedService(appointment.id, item.performedItemId),
            'service', 'Đã xóa dịch vụ khỏi danh sách chưa chốt.')}>Bỏ dịch vụ</button>}
      </div>)}
      {!performed.finalized && <form onSubmit={(event) => void add(event)}>
        <label>Dịch vụ<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          <option value="">{catalog?.length ? 'Chọn dịch vụ' : 'Chưa có dịch vụ đang hoạt động'}</option>
          {catalog?.map((service) => <option key={service.id} value={service.id}>{service.code} — {service.name}</option>)}
        </select></label>
        <label>Số lượng<input type="number" required min={1} step={1} value={quantity}
          onChange={(event) => setQuantity(Number(event.target.value))} /></label>
        <button type="submit" disabled={busy || !serviceId || !Number.isSafeInteger(quantity) || quantity < 1}>Ghi dịch vụ đã thực hiện</button>
      </form>}
      {!performed.finalized && <button type="button" disabled={busy || !performed.items.length}
        onClick={() => void update(() => finalizePerformedServices(appointment.id), 'service', 'Đã chốt danh sách dịch vụ.')}>Chốt dịch vụ</button>}
      <h4>Xét nghiệm tính phí ({laboratory.items.length}) {laboratory.finalizedForBilling ? '· Đã chốt' : '· Chưa chốt'}</h4>
      {laboratory.items.map((item) => <p key={item.orderId}>{item.testCode} · {item.status} · {item.orderId.slice(0, 8)}</p>)}
      {!laboratory.finalizedForBilling && <button type="button" disabled={busy || laboratory.items.some((item) => item.status !== 'RELEASED')}
        onClick={() => void update(() => finalizeLabBillableItems(appointment.id), 'lab', 'Đã chốt danh sách xét nghiệm.')}>Chốt xét nghiệm</button>}
      {!laboratory.finalizedForBilling && laboratory.items.some((item) => item.status !== 'RELEASED') &&
        <Alert tone="info">Còn xét nghiệm chưa công bố; không thể xuất hóa đơn.</Alert>}
      <button type="button" disabled={busy || !performed.finalized || !laboratory.finalizedForBilling || !performed.items.length}
        onClick={() => void issue()}>Phát hành hóa đơn (chưa thanh toán)</button>
      <p>Đơn giá được kiểm tra khi phát hành. Thanh toán trực tuyến chưa khả dụng.</p>
    </>}
  </section>;
}
