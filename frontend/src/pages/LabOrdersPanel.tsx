import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Beaker, CalendarDays, CheckCircle2, ChevronDown, ClipboardCheck, ClipboardList, Clock3,
  FileCheck2, FlaskConical, Info, Plus, RefreshCw, Search, ShieldCheck, X
} from 'lucide-react';
import { changeLabOrder, createLabOrder, getAppointment, getCatalogServices, getDoctorLabBillingStatus, getLabOrders } from '../api/clinic';
import { HttpApiError } from '../api/client';
import Alert from '../components/Alert';
import type { CatalogServiceResponse, LabOrderResponse, LabOrderStatus, MedicalRecordResponse } from '../types/domain';
import { formatDate } from '../utils/format';
import { statusLabel } from '../utils/locale';
import './labOrders.css';

type OrderFilter = 'ALL' | LabOrderStatus;
const statuses: LabOrderStatus[] = ['ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'RELEASED'];
const nextAction: Record<Exclude<LabOrderStatus, 'RELEASED'>, { label: string; expected: LabOrderStatus }> = {
  ORDERED: { label: 'Xác nhận lấy mẫu', expected: 'COLLECTED' },
  COLLECTED: { label: 'Bắt đầu xử lý mẫu', expected: 'PROCESSING' },
  PROCESSING: { label: 'Ghi kết quả', expected: 'RESULTED' },
  RESULTED: { label: 'Kiểm tra và công bố', expected: 'RELEASED' }
};

/** Catalog has no structured test category yet. Only explicitly marked laboratory services may be offered as test orders. */
export function isLaboratoryService(service: CatalogServiceResponse): boolean {
  return service.active && (
    /(?:^|[;\s])nhóm\s+xét\s+nghiệm(?:[;\s]|$)/iu.test(service.description ?? '')
    || /\bcategory\s*:\s*lab\b/i.test(service.description ?? '')
    || /^(?:LAB|XN)(?:[-_0-9])/i.test(service.code)
    || /^xét nghiệm\b/iu.test(service.name)
  );
}

/** The API returns a local date-time without an offset; display its recorded wall-clock time without timezone conversion. */
function eventDateTime(value: string | null): string {
  if (!value) return 'Chưa ghi nhận';
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match ? `${formatDate(match[1])} · ${match[2]}` : formatDate(value);
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Hệ thống không xử lý được yêu cầu. Vui lòng thử lại.';
}

/** Only this specific billing conflict means that the lab workflow has been locked. */
export function isFinalizedBillingConflict(cause: unknown): boolean {
  return cause instanceof HttpApiError && cause.status === 409
    && cause.message.includes('Lab billing items are already finalized');
}

/** The backend enforces ownership, legal transitions, billing closure, and patient visibility. */
export default function LabOrdersPanel({ record, doctor }: { record: MedicalRecordResponse; doctor: boolean }) {
  const [orders, setOrders] = useState<LabOrderResponse[] | null>(null);
  const [services, setServices] = useState<CatalogServiceResponse[] | null>(null);
  const [performedOn, setPerformedOn] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [creating, setCreating] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<OrderFilter>('ALL');
  const [sampleIdentifier, setSampleIdentifier] = useState('');
  const [resultValue, setResultValue] = useState('');
  const [resultUnit, setResultUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [releaseConfirmed, setReleaseConfirmed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [billingFinalized, setBillingFinalized] = useState<boolean | null>(null);
  const [billingStatusError, setBillingStatusError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true); setOrders(null); setError(null); setNotice(null);
    setSelectedOrderId(''); setCreating(false); setServices(null); setPerformedOn(null);
    setCatalogError(null); setCatalogLoading(doctor);
    setBillingFinalized(null); setBillingStatusError(null);
    // The order list is independent of catalog/appointment lookup: an unavailable catalog
    // must not hide previously recorded lab orders and results.
    void getLabOrders(record.id).then((rows) => {
      if (!active) return;
      if (!Array.isArray(rows) || rows.some((order) => order.medicalRecordId !== record.id)) {
        throw new Error('Danh sách xét nghiệm không khớp bệnh án đang xem.');
      }
      setOrders(doctor ? rows : rows.filter((order) => order.status === 'RELEASED'));
    }).catch((cause: unknown) => { if (active) setError(errorText(cause)); })
      .finally(() => { if (active) setLoading(false); });

    if (doctor) {
      // Never call the staff-only billing-item endpoint with a doctor's token.
      void getDoctorLabBillingStatus(record.id).then((status) => {
        if (!active) return;
        if (status.medicalRecordId !== record.id || typeof status.finalizedForBilling !== 'boolean')
          throw new Error('Phản hồi trạng thái chốt xét nghiệm không hợp lệ.');
        // Finalization is monotonic. A slower stale response must never reopen a locked form.
        setBillingFinalized((current) => current === true ? true : status.finalizedForBilling);
        if (status.finalizedForBilling) { setCreating(false); setSelectedOrderId(''); }
      }).catch((cause: unknown) => { if (active) setBillingStatusError(errorText(cause)); });
      void Promise.all([getCatalogServices(), getAppointment(record.appointmentId)]).then(([catalog, appointment]) => {
        if (!active) return;
        if (!Array.isArray(catalog) || appointment.id !== record.appointmentId ||
          appointment.patientId !== record.patientId || appointment.doctorId !== record.doctorId ||
          appointment.status !== 'COMPLETED') {
          throw new Error('Chưa xác minh được danh mục hoặc lịch khám đã hoàn tất.');
        }
        setServices(catalog.filter(isLaboratoryService));
        setPerformedOn(appointment.appointmentDate);
      }).catch((cause: unknown) => { if (active) setCatalogError(errorText(cause)); })
        .finally(() => { if (active) setCatalogLoading(false); });
    }
    return () => { active = false; };
  }, [record.id, record.appointmentId, record.patientId, record.doctorId, doctor, revision]);

  const filtered = useMemo(() => (orders ?? []).filter((order) =>
    (filter === 'ALL' || filter === order.status) &&
    `${order.testName} ${order.testCode} ${doctor ? order.sampleIdentifier ?? '' : ''}`
      .toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))
  ), [orders, query, filter, doctor]);
  const matchingServices = useMemo(() => (services ?? []).filter((service) =>
    `${service.code} ${service.name}`.toLocaleLowerCase('vi-VN').includes(catalogSearch.trim().toLocaleLowerCase('vi-VN'))
  ), [catalogSearch, services]);
  const selected = orders?.find((order) => order.id === selectedOrderId) ?? null;
  const selectedService = services?.find((service) => service.id === serviceId) ?? null;
  const total = orders?.length ?? 0;
  const pending = orders?.filter((order) => order.status !== 'RELEASED').length ?? 0;
  const resulted = orders?.filter((order) => order.status === 'RESULTED').length ?? 0;
  const released = orders?.filter((order) => order.status === 'RELEASED').length ?? 0;
  const canModify = doctor && billingFinalized === false && !billingStatusError;

  /** Recheck just before a mutation: billing staff may have closed the batch since page load. */
  async function verifyBillingOpen() {
    const status = await getDoctorLabBillingStatus(record.id);
    if (status.medicalRecordId !== record.id || typeof status.finalizedForBilling !== 'boolean')
      throw new Error('Không xác minh được trạng thái chốt xét nghiệm.');
    setBillingFinalized((current) => current === true ? true : status.finalizedForBilling);
    if (status.finalizedForBilling) {
      setCreating(false); setSelectedOrderId('');
      return false;
    }
    return true;
  }

  function selectOrder(id: string) {
    setSelectedOrderId((previous) => previous === id ? '' : id);
    setSampleIdentifier(''); setResultValue(''); setResultUnit(''); setReferenceRange('');
    setReleaseConfirmed(false); setNotice(null); setError(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const service = services?.find((item) => item.id === serviceId);
    if (!canModify || busy || !service || !isLaboratoryService(service) || !performedOn) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (!await verifyBillingOpen()) return;
      const created = await createLabOrder(record.id, {
        serviceId: service.id, testCode: service.code, testName: service.name, performedOn
      });
      if (created.medicalRecordId !== record.id || created.serviceId !== service.id || created.status !== 'ORDERED') {
        throw new Error('Máy chủ chưa xác nhận được chỉ định xét nghiệm.');
      }
      setOrders((previous) => previous ? [created, ...previous] : [created]);
      setServiceId(''); setCatalogSearch(''); setCreating(false);
      setSelectedOrderId(created.id);
      setNotice(`Đã tạo chỉ định ${created.testName}. Chỉ định đang chờ lấy mẫu.`);
    } catch (cause) {
      if (isFinalizedBillingConflict(cause)) {
        setBillingFinalized(true); setCreating(false); setSelectedOrderId('');
      } else {
        setError(`${errorText(cause)}. Hãy làm mới danh sách và kiểm tra chỉ định trước khi gửi lại để tránh tạo trùng.`);
      }
    } finally { setBusy(false); }
  }

  async function transition(action: 'sample' | 'processing' | 'result' | 'release', from: LabOrderStatus,
    expected: LabOrderStatus, body?: object) {
    if (!canModify || !selected || busy || selected.status !== from ||
      (action === 'release' && !releaseConfirmed) ||
      (action === 'sample' && !sampleIdentifier.trim()) ||
      (action === 'result' && !resultValue.trim())) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (!await verifyBillingOpen()) return;
      const updated = await changeLabOrder(selected.id, action, body);
      if (updated.id !== selected.id || updated.medicalRecordId !== record.id ||
        updated.serviceId !== selected.serviceId || updated.status !== expected) {
        throw new Error('Máy chủ chưa xác nhận được bước xử lý xét nghiệm.');
      }
      setOrders((previous) => previous?.map((order) => order.id === updated.id ? updated : order) ?? null);
      setSampleIdentifier(''); setResultValue(''); setResultUnit(''); setReferenceRange('');
      setReleaseConfirmed(false);
      setNotice(action === 'release' ? 'Kết quả đã được máy chủ xác nhận công bố cho bệnh nhân.' :
        `Đã cập nhật chỉ định sang trạng thái: ${statusLabel(expected)}.`);
    } catch (cause) {
      if (isFinalizedBillingConflict(cause)) {
        setBillingFinalized(true); setCreating(false); setSelectedOrderId('');
      } else {
        setError(`${errorText(cause)}. Hãy làm mới danh sách để xác minh trạng thái trước khi thao tác lại.`);
      }
    } finally { setBusy(false); }
  }

  return <section className="lab-workspace" aria-label="Xét nghiệm của hồ sơ được cấp quyền">
    <header className="lab-workspace-heading">
      <div className="lab-heading-title"><span className="lab-heading-icon"><FlaskConical size={23} aria-hidden="true" /></span>
        <div><span className="lab-eyebrow">THEO DÕI XÉT NGHIỆM</span>
          <h3>{doctor ? 'Xét nghiệm & chỉ định' : 'Kết quả xét nghiệm'}</h3>
          <p>Bệnh án {record.recordCode || 'đang xem'} · {doctor ? 'Dữ liệu chỉ định thuộc bác sĩ điều trị' : 'Chỉ kết quả đã được công bố'}</p></div></div>
      <div className="lab-heading-actions"><button type="button" className="soft-button lab-refresh" disabled={busy || loading}
        onClick={() => setRevision((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Làm mới</button>
        {doctor && <button type="button" className="lab-new-button" disabled={busy || loading || !canModify || catalogLoading || !performedOn || !services?.length}
          onClick={() => { setCreating((previous) => !previous); setSelectedOrderId(''); setNotice(null); }}>
          {creating ? <X size={17} aria-hidden="true" /> : <Plus size={17} aria-hidden="true" />}
          {creating ? 'Đóng biểu mẫu' : 'Tạo chỉ định'}</button>}</div>
    </header>

    {loading && <p role="status" className="lab-loading">Đang tải xét nghiệm...</p>}
    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {doctor && billingFinalized === null && !billingStatusError &&
      <p className="lab-support-note" role="status">Đang kiểm tra trạng thái chốt xét nghiệm. Các thao tác chỉnh sửa tạm khóa trong lúc xác minh.</p>}
    {doctor && billingStatusError && <Alert tone="error">Không xác minh được trạng thái chốt xét nghiệm: {billingStatusError}. Chỉ cho phép xem dữ liệu; hãy nhấn Làm mới để kiểm tra lại.</Alert>}
    {doctor && billingFinalized === true && <div className="lab-billing-locked" role="status">
      <ShieldCheck size={21} aria-hidden="true" /><div><strong>Danh sách xét nghiệm tính phí đã được chốt</strong>
        <p>Hệ thống khóa tạo chỉ định và các bước xử lý để bảo toàn hóa đơn. Bạn vẫn xem được xét nghiệm và kết quả đã lưu. Nếu cần bổ sung, hãy liên hệ bộ phận phụ trách hóa đơn để kiểm tra quy trình điều chỉnh; không sửa trực tiếp database.</p></div>
    </div>}
    {doctor && catalogError && <Alert tone="error">Không thể xác minh danh mục để tạo chỉ định: {catalogError}. Danh sách xét nghiệm vẫn có thể xem bên dưới.</Alert>}
    {doctor && catalogLoading && <p className="lab-support-note" role="status">Đang xác minh lịch khám và danh mục xét nghiệm...</p>}
    {doctor && !catalogLoading && !catalogError && services?.length === 0 &&
      <Alert tone="info">Danh mục hiện chưa có dịch vụ được phân loại là xét nghiệm. Cần bổ sung nhóm xét nghiệm trong Catalog trước khi tạo chỉ định; không dùng dịch vụ khám hoặc chẩn đoán hình ảnh thay thế.</Alert>}

    {orders && <div className="lab-overview" aria-label="Thống kê xét nghiệm trong bệnh án">
      <div><span><ClipboardList size={17} aria-hidden="true" /> Tổng xét nghiệm</span><strong>{total}</strong></div>
      {doctor && <div><span><Clock3 size={17} aria-hidden="true" /> Chưa công bố</span><strong>{pending}</strong></div>}
      {doctor && <div><span><FileCheck2 size={17} aria-hidden="true" /> Chờ công bố</span><strong>{resulted}</strong></div>}
      <div><span><CheckCircle2 size={17} aria-hidden="true" /> Đã công bố</span><strong>{released}</strong></div>
    </div>}

    {canModify && creating && services && performedOn && <form className="lab-create-form" onSubmit={(event) => void create(event)}>
      <div className="lab-section-title"><div><span className="lab-eyebrow">TẠO YÊU CẦU MỚI</span>
        <h4>Chọn dịch vụ xét nghiệm</h4><p>Chỉ các dịch vụ được phân loại xét nghiệm và đang hoạt động mới được hiển thị.</p></div>
        <button type="button" className="lab-icon-button" aria-label="Đóng tạo chỉ định" disabled={busy} onClick={() => setCreating(false)}><X size={18} /></button></div>
      <label className="lab-field">Tìm dịch vụ trong danh mục
        <span className="lab-input-with-icon"><Search size={17} aria-hidden="true" />
          <input type="search" value={catalogSearch} disabled={busy} placeholder="Tên xét nghiệm hoặc mã dịch vụ..."
            onChange={(event) => { setCatalogSearch(event.target.value); setServiceId(''); }} /></span></label>
      <label className="lab-field" htmlFor="lab-service-select">Dịch vụ xét nghiệm <span className="lab-required">*</span>
        <select id="lab-service-select" required value={serviceId} disabled={busy} onChange={(event) => setServiceId(event.target.value)}>
          <option value="">{matchingServices.length ? 'Chọn xét nghiệm cần chỉ định' : 'Không có dịch vụ phù hợp'}</option>
          {matchingServices.map((service) => <option value={service.id} key={service.id}>{service.name} — {service.code}</option>)}
        </select></label>
      {selectedService && <p className="lab-selected-service"><CheckCircle2 size={16} aria-hidden="true" /> {selectedService.name} · {selectedService.code}</p>}
      <p className="lab-support-note"><CalendarDays size={16} aria-hidden="true" /> Ngày thực hiện theo lịch khám đã xác minh: <strong>{formatDate(performedOn)}</strong>.</p>
      <div className="lab-form-actions"><button type="submit" disabled={busy || !selectedService || !performedOn}>{busy ? 'Đang lưu...' : 'Xác nhận tạo chỉ định'}</button>
        <button type="button" className="soft-button" disabled={busy} onClick={() => setCreating(false)}>Hủy</button></div>
    </form>}

    {orders && <div className="lab-list-section">
      <div className="lab-section-title"><div><span className="lab-eyebrow">DANH SÁCH ĐƯỢC GHI NHẬN</span>
        <h4>{doctor ? 'Các chỉ định của bệnh án' : 'Kết quả đã phát hành'}</h4>
        <p>Hiển thị {filtered.length}/{total} mục. Trạng thái và kết quả lấy từ hệ thống.</p></div></div>
      {total > 0 && <div className="lab-list-toolbar"><label className="lab-input-with-icon"><Search size={17} aria-hidden="true" />
        <span className="lab-visually-hidden">Tìm xét nghiệm</span>
        <input aria-label="Tìm xét nghiệm" type="search" value={query} placeholder="Tìm tên, mã xét nghiệm..." onChange={(event) => setQuery(event.target.value)} /></label>
        {doctor && <label className="lab-filter"><span className="lab-visually-hidden">Lọc trạng thái xét nghiệm</span>
          <select aria-label="Lọc trạng thái xét nghiệm" value={filter} onChange={(event) => setFilter(event.target.value as OrderFilter)}>
            <option value="ALL">Tất cả trạng thái</option>{statuses.map((value) => <option value={value} key={value}>{statusLabel(value)}</option>)}
          </select><ChevronDown size={16} aria-hidden="true" /></label>}</div>}
      {total === 0 && <div className="lab-empty" role="status"><Beaker size={31} aria-hidden="true" /><strong>{doctor ? 'Chưa có chỉ định xét nghiệm' : 'Chưa có kết quả được công bố'}</strong>
        <p>{doctor ? 'Tạo chỉ định từ danh mục xét nghiệm đã xác minh để bắt đầu quy trình.' : 'Kết quả sẽ xuất hiện sau khi bác sĩ công bố trên hệ thống.'}</p></div>}
      {total > 0 && filtered.length === 0 && <p className="lab-empty" role="status">Không tìm thấy xét nghiệm phù hợp từ khóa hoặc bộ lọc.</p>}
      <div className="lab-order-list">{filtered.map((order) => <article key={order.id} className={`lab-order-card ${selectedOrderId === order.id ? 'is-selected' : ''}`}>
        <div className="lab-order-top"><span className="lab-order-icon"><FlaskConical size={19} aria-hidden="true" /></span>
          <div className="lab-order-main"><strong>{order.testName}</strong><small>Mã dịch vụ: {order.testCode} · {formatDate(order.performedOn)}</small></div>
          <span className={`lab-state lab-state-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span></div>
        {doctor && <div className="lab-order-meta"><span>Mã mẫu: <strong>{order.sampleIdentifier || 'Chưa lấy mẫu'}</strong></span>
          {order.collectedAt && <span>Lấy mẫu: {eventDateTime(order.collectedAt)}</span>}</div>}
        {(order.status === 'RELEASED' || (doctor && order.status === 'RESULTED')) &&
          <div className="lab-result-display" aria-label="Kết quả được ghi nhận"><span>{order.status === 'RELEASED' ? 'KẾT QUẢ ĐÃ CÔNG BỐ' : 'KẾT QUẢ CHƯA CÔNG BỐ'}</span>
            <strong>{order.resultValue?.trim() || 'Chưa có dữ liệu'}{order.resultUnit?.trim() ? ` ${order.resultUnit.trim()}` : ''}</strong>
            <small>Khoảng tham chiếu: {order.referenceRange?.trim() || 'Chưa cung cấp'}</small>
            {order.releasedAt && <small>Thời điểm công bố: {eventDateTime(order.releasedAt)}</small>}
          </div>}
        {doctor && order.status !== 'RELEASED' && <div className="lab-order-footer"><span><Info size={15} aria-hidden="true" />
          {!canModify ? billingFinalized ? 'Đã chốt xét nghiệm tính phí · chỉ xem.' : 'Chưa xác minh trạng thái chốt · chỉ xem.'
            : order.status === 'RESULTED' ? 'Chỉ bác sĩ điều trị được công bố kết quả.' : 'Thực hiện lần lượt các bước xử lý.'}</span>
          {canModify && <button type="button" className="lab-order-action" disabled={busy} aria-expanded={selectedOrderId === order.id}
            onClick={() => selectOrder(order.id)}>{selectedOrderId === order.id ? 'Đóng xử lý' : nextAction[order.status].label} <ChevronDown size={16} aria-hidden="true" /></button>}</div>}
        {canModify && selectedOrderId === order.id && order.status !== 'RELEASED' && <section className="lab-action-panel" aria-label={`Xử lý chỉ định ${order.testName}`}>
          <div className="lab-action-heading"><ClipboardCheck size={20} aria-hidden="true" /><div><span className="lab-eyebrow">BƯỚC XỬ LÝ TIẾP THEO</span><h5>{nextAction[order.status].label}</h5></div></div>
          {order.status === 'ORDERED' && <form onSubmit={(event) => { event.preventDefault(); void transition('sample', 'ORDERED', 'COLLECTED', { sampleIdentifier: sampleIdentifier.trim() }); }}>
            <label className="lab-field">Mã mẫu xét nghiệm <span className="lab-required">*</span>
              <input value={sampleIdentifier} required maxLength={100} disabled={busy} placeholder="Nhập mã mẫu duy nhất..."
                onChange={(event) => setSampleIdentifier(event.target.value)} /></label>
            <p className="lab-support-note">Mã mẫu phải duy nhất; máy chủ sẽ kiểm tra khi lưu.</p>
            <div className="lab-form-actions"><button type="submit" disabled={busy || !sampleIdentifier.trim()}>Xác nhận lấy mẫu</button></div>
          </form>}
          {order.status === 'COLLECTED' && <div className="lab-action-body"><p>Mã mẫu <strong>{order.sampleIdentifier || 'Chưa xác minh'}</strong> đã được ghi nhận. Xác nhận chuyển sang xử lý mẫu.</p>
            <div className="lab-form-actions"><button type="button" disabled={busy} onClick={() => void transition('processing', 'COLLECTED', 'PROCESSING')}>Bắt đầu xử lý mẫu</button></div></div>}
          {order.status === 'PROCESSING' && <form onSubmit={(event) => { event.preventDefault(); void transition('result', 'PROCESSING', 'RESULTED', {
            value: resultValue.trim(), unit: resultUnit.trim(), referenceRange: referenceRange.trim()
          }); }}>
            <label className="lab-field">Nội dung kết quả <span className="lab-required">*</span>
              <textarea value={resultValue} required maxLength={4000} rows={3} disabled={busy} placeholder="Nhập chính xác kết quả được xác minh..."
                onChange={(event) => setResultValue(event.target.value)} /></label>
            <div className="lab-result-fields"><label className="lab-field">Đơn vị đo (nếu có)
              <input value={resultUnit} maxLength={100} disabled={busy} placeholder="Đơn vị trên phiếu xét nghiệm" onChange={(event) => setResultUnit(event.target.value)} /></label>
              <label className="lab-field">Khoảng tham chiếu (nếu có)
                <input value={referenceRange} maxLength={255} disabled={busy} placeholder="Theo tài liệu xét nghiệm" onChange={(event) => setReferenceRange(event.target.value)} /></label></div>
            <p className="lab-support-note">Không tự diễn giải kết quả hoặc suy đoán đơn vị/khoảng tham chiếu. Bước này chưa công bố cho bệnh nhân.</p>
            <div className="lab-form-actions"><button type="submit" disabled={busy || !resultValue.trim()}>Lưu kết quả</button></div>
          </form>}
          {order.status === 'RESULTED' && <div className="lab-action-body">
            <div className="lab-release-warning"><ShieldCheck size={20} aria-hidden="true" /> Sau khi công bố, kết quả sẽ xuất hiện trong hồ sơ của bệnh nhân. Hãy kiểm tra nội dung đã nhập trước khi xác nhận.</div>
            <label className="lab-release-confirm"><input type="checkbox" checked={releaseConfirmed} disabled={busy}
              onChange={(event) => setReleaseConfirmed(event.target.checked)} /> Tôi đã kiểm tra kết quả và xác nhận công bố cho đúng bệnh nhân.</label>
            <div className="lab-form-actions"><button type="button" disabled={busy || !releaseConfirmed}
              onClick={() => void transition('release', 'RESULTED', 'RELEASED')}>Công bố kết quả cho bệnh nhân</button></div>
          </div>}
        </section>}
      </article>)}</div>
    </div>}
    {!doctor && <p className="lab-patient-note"><ShieldCheck size={17} aria-hidden="true" /> Chỉ kết quả đã được công bố mới xuất hiện tại đây. Liên hệ bác sĩ điều trị nếu cần giải thích kết quả.</p>}
  </section>;
}
