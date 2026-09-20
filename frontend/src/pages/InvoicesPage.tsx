import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, ClipboardList, Clock3, FileText, Plus, ReceiptText, RefreshCw,
  Search, ShieldCheck, UsersRound, X
} from 'lucide-react';
import { confirmCashPayment, getInvoiceTransactions, getPatientInvoices } from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { InvoiceResponse, PaymentTransactionResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatMoney, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { filterInvoiceDirectory, invoiceCounts, type InvoiceFilter } from '../utils/invoiceDirectory';
import BillingWorkflowPanel from './BillingWorkflowPanel';
import './patientPortal.css';

type InvoicesPageProps = {
  invoices: InvoiceResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const referencePattern = /^[A-Za-z0-9_-]{1,100}$/;
const PAGE_SIZE = 8;
const statuses: InvoiceFilter[] = ['ALL', 'UNPAID', 'PAID', 'REFUNDED', 'RECONCILIATION_REQUIRED', 'CANCELLED'];

export default function InvoicesPage(props: InvoicesPageProps) {
  if (props.role !== 'PATIENT' && props.role !== 'ADMIN' && props.role !== 'RECEPTIONIST') {
    return <Alert tone="error">Bạn không có quyền truy cập hóa đơn.</Alert>;
  }
  return <InvoiceWorkspace {...props} />;
}

function InvoiceWorkspace({ invoices, role, error, loading, onRefresh }: InvoicesPageProps) {
  const isPatient = role === 'PATIENT';
  const cashEnabled = integrations.billing && (role === 'ADMIN' || role === 'RECEPTIONIST');
  const [patientId, setPatientId] = useState('');
  const [searchedPatientId, setSearchedPatientId] = useState('');
  const [staffInvoices, setStaffInvoices] = useState<InvoiceResponse[] | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIssuance, setShowIssuance] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceFilter>('ALL');
  const [page, setPage] = useState(1);
  const [receiptReference, setReceiptReference] = useState('');
  const [cashCollected, setCashCollected] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransactionResponse[] | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const requestId = useRef(0);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => { setSelectedId(''); setPage(1); }, [invoices]);
  useEffect(() => {
    requestId.current += 1;
    setStaffInvoices(null); setSearchedPatientId(''); setPatientId('');
    setSelectedId(''); setNotice(null); setQueryError(null);
  }, [role]);
  useEffect(() => { setReceiptReference(''); setCashCollected(false); }, [selectedId]);

  const rows = isPatient ? (invoices ?? []) : (staffInvoices ?? []);
  const filtered = filterInvoiceDirectory(rows, filterText, statusFilter);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const counts = invoiceCounts(rows);
  const hasLoaded = isPatient ? invoices != null : staffInvoices != null;
  const scopeDescription = isPatient ? 'Hóa đơn của tài khoản hiện tại' :
    searchedPatientId ? `Hóa đơn bệnh nhân #${shortId(searchedPatientId)}` : 'Chưa chọn bệnh nhân';

  useEffect(() => {
    if (!cashEnabled || !selected?.id) { setTransactions(null); setTransactionsError(null); return; }
    let active = true;
    setTransactions(null); setTransactionsError(null);
    void getInvoiceTransactions(selected.id).then((result) => {
      if (!active) return;
      if (!Array.isArray(result)) throw new Error('Phản hồi lịch sử giao dịch không hợp lệ.');
      setTransactions(result);
    }).catch((cause: unknown) => {
      if (active) setTransactionsError(cause instanceof Error ? cause.message : 'Không tải được lịch sử giao dịch.');
    });
    return () => { active = false; };
  }, [cashEnabled, selected?.id, transactionRevision]);

  function clearLookup(next: string) {
    if (paymentBusy) return;
    requestId.current += 1;
    setPatientId(next); setStaffInvoices(null); setSearchedPatientId('');
    setSelectedId(''); setFilterText(''); setStatusFilter('ALL'); setPage(1);
    setQueryError(null); setNotice(null); setLookupBusy(false);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPatient || lookupBusy) return;
    const id = patientId.trim().toLowerCase();
    if (!uuid.test(id)) { setQueryError('Nhập UUID bệnh nhân hợp lệ để tra cứu hóa đơn.'); return; }
    const request = ++requestId.current;
    setLookupBusy(true); setQueryError(null); setNotice(null); setStaffInvoices(null); setSelectedId('');
    setFilterText(''); setStatusFilter('ALL'); setPage(1);
    try {
      const result = await getPatientInvoices(id);
      if (!Array.isArray(result) || result.some((item) => item.patientId !== id)) {
        throw new Error('Máy chủ trả dữ liệu hóa đơn không đúng bệnh nhân cần tra cứu.');
      }
      if (request !== requestId.current) return;
      setStaffInvoices(result); setSearchedPatientId(id);
    } catch (cause) {
      if (request === requestId.current) setQueryError(cause instanceof Error ? cause.message : 'Tra cứu hóa đơn thất bại.');
    } finally {
      if (request === requestId.current) setLookupBusy(false);
    }
  }

  function invoiceCreated(invoice: InvoiceResponse) {
    requestId.current += 1;
    // Never mix results from a previously searched patient into the newly created invoice scope.
    setPatientId(invoice.patientId); setSearchedPatientId(invoice.patientId);
    setStaffInvoices((previous) => [invoice, ...(searchedPatientId === invoice.patientId ? previous ?? [] : [])
      .filter((item) => item.patientId === invoice.patientId && item.id !== invoice.id)]);
    setFilterText(''); setStatusFilter('ALL'); setPage(1); setSelectedId(invoice.id);
    setNotice(`Hóa đơn #${shortId(invoice.id)} đã phát hành. Chưa ghi nhận thanh toán.`);
    setQueryError(null); setShowIssuance(false);
  }

  async function cashPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setQueryError(null); setNotice(null);
    if (!cashEnabled || !selected || selected.status !== 'UNPAID' || paymentBusy || !cashCollected) return;
    if (!referencePattern.test(receiptReference)) {
      setQueryError('Mã biên nhận gồm 1–100 chữ cái, chữ số, dấu gạch dưới hoặc gạch ngang.'); return;
    }
    const invoiceId = selected.id;
    setPaymentBusy(true);
    try {
      const confirmed = await confirmCashPayment(invoiceId, receiptReference);
      if (confirmed.id !== invoiceId || confirmed.patientId !== selected.patientId || confirmed.status !== 'PAID'
        || confirmed.paymentMethod !== 'CASH' || !confirmed.currency ||
        (selected.currency && selected.currency !== confirmed.currency)) {
        throw new Error('Máy chủ chưa xác nhận thu tiền mặt đúng hóa đơn. Tải lại dữ liệu trước khi thao tác tiếp.');
      }
      setStaffInvoices((previous) => previous?.map((item) => item.id === confirmed.id ? confirmed : item) ?? null);
      setReceiptReference(''); setCashCollected(false); setTransactionRevision((value) => value + 1);
      setNotice('Billing Service đã xác nhận thu tiền mặt và cập nhật hóa đơn.');
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Chưa xác nhận được thu tiền mặt.'); }
    finally { setPaymentBusy(false); }
  }

  return <div className={`invoice-workspace${isPatient ? ' patient-invoices' : ''}`}>
    <PageHeader title={isPatient ? 'Hóa đơn của tôi' : 'Hóa đơn'} subtitle={isPatient ? 'Tra cứu hóa đơn và chi tiết chi phí của bạn' : 'Quản lý hóa đơn và thu tiền theo quyền được cấp'}
      actions={<>{isPatient && <button type="button" className="soft-button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>}
        {cashEnabled && <button type="button" disabled={paymentBusy} onClick={() => setShowIssuance((value) => !value)}>
          {showIssuance ? <X size={16} /> : <Plus size={16} />}{showIssuance ? 'Đóng quy trình' : 'Xuất hóa đơn'}</button>}</>} />

    <section className="invoice-hero" aria-label="Tổng quan hóa đơn">
      <div className="invoice-hero-copy"><span className="invoice-kicker"><ShieldCheck size={15} /> {isPatient ? 'HÓA ĐƠN CỦA TÔI' : 'KHU VỰC THU NGÂN · QUẢN TRỊ'}</span>
        <h3>{isPatient ? 'Theo dõi chi phí rõ ràng.' : 'Hóa đơn minh bạch. Đối soát chính xác.'}</h3>
        <p>{isPatient ? 'Xem số tiền, trạng thái và từng dịch vụ do phòng khám ghi nhận.' : 'Tra cứu theo mã bệnh nhân, đối chiếu khoản phí và xác nhận tiền mặt thực nhận bằng API Billing.'}</p>
        <span className="invoice-hero-chip"><ReceiptText size={15} /> {scopeDescription}</span>
      </div><div className="invoice-hero-icon" aria-hidden="true"><ReceiptText size={69} strokeWidth={1.35} /></div>
    </section>

    {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading} onClick={onRefresh}>Thử lại</button></Alert>}
    {queryError && <Alert tone="error">{queryError}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}

    {cashEnabled && showIssuance && <div className="invoice-billing-flow"><BillingWorkflowPanel onCreated={invoiceCreated} /></div>}
    {!isPatient && <section className="panel invoice-search-panel" aria-label="Tra cứu hóa đơn theo bệnh nhân">
      <div className="invoice-section-head"><div><span className="invoice-section-kicker">TRA CỨU</span><h3>Tìm hóa đơn của bệnh nhân</h3>
        <p>Billing chỉ hỗ trợ tra cứu theo một UUID bệnh nhân; chưa có API danh sách hóa đơn toàn phòng khám.</p></div><span className="invoice-section-icon"><Search size={21} /></span></div>
      <form onSubmit={(event) => void search(event)} className="invoice-search-form">
        <label><UsersRound size={18} /><span className="invoice-sr-only">UUID bệnh nhân</span>
          <input required aria-label="Patient UUID" placeholder="Nhập UUID bệnh nhân cần tra cứu" disabled={paymentBusy} value={patientId} onChange={(event) => clearLookup(event.target.value)} /></label>
        <button type="submit" disabled={lookupBusy || paymentBusy || !patientId.trim()}><Search size={16} /> {lookupBusy ? 'Đang tra cứu...' : 'Tìm hóa đơn'}</button>
      </form><p className="invoice-search-note"><ShieldCheck size={15} /> Chỉ tải dữ liệu đúng bệnh nhân đã tìm kiếm; không tự suy luận tổng doanh thu phòng khám.</p>
    </section>}

    {loading && isPatient && <p role="status" className="invoice-loading">Đang tải hóa đơn...</p>}
    {lookupBusy && <p role="status" className="invoice-loading">Đang tra cứu hóa đơn bệnh nhân...</p>}
    {hasLoaded && <>
      <section className="invoice-metrics" aria-label="Thống kê trong dữ liệu hóa đơn đã tải">
        {[
          { title: 'Hóa đơn đã tải', value: counts.total, hint: scopeDescription, icon: ReceiptText, tone: 'blue' },
          { title: 'Chưa thanh toán', value: counts.unpaid, hint: 'Trong dữ liệu đã tải', icon: Clock3, tone: 'orange' },
          { title: 'Đã thanh toán', value: counts.paid, hint: 'Trạng thái do Billing trả về', icon: CheckCircle2, tone: 'green' },
          { title: 'Cần đối soát', value: counts.attention, hint: 'Không xác nhận thu tiền khi chưa xử lý', icon: CircleAlert, tone: 'purple' }
        ].map(({ title, value, hint, icon: Icon, tone }) => <article key={title} className={`invoice-metric invoice-metric-${tone}`}>
          <span className="invoice-metric-icon"><Icon size={21} /></span><strong>{value.toLocaleString('vi-VN')}</strong><h3>{title}</h3><p>{hint}</p></article>)}
      </section>
      <section className="panel invoice-list-panel" aria-label="Danh sách hóa đơn">
        <div className="invoice-section-head"><div><span className="invoice-section-kicker">DỮ LIỆU THỰC</span><h3>Danh sách hóa đơn</h3>
          <p>{filtered.length} / {rows.length} hóa đơn phù hợp · {scopeDescription}</p></div><span className="invoice-scope-pill">Theo phạm vi đã tải</span></div>
        <div className="invoice-filters">
          <label><Search size={17} /><span className="invoice-sr-only">Lọc trong hóa đơn đã tải</span><input type="search" aria-label="Lọc hóa đơn đã tải" placeholder="Mã hóa đơn, lịch hẹn, dịch vụ..." value={filterText}
            disabled={paymentBusy} onChange={(event) => { setFilterText(event.target.value); setPage(1); setSelectedId(''); }} /></label>
          <label><span className="invoice-sr-only">Lọc trạng thái hóa đơn</span><select aria-label="Lọc trạng thái hóa đơn" disabled={paymentBusy} value={statusFilter}
            onChange={(event) => { setStatusFilter(event.target.value as InvoiceFilter); setPage(1); setSelectedId(''); }}>
            {statuses.map((status) => <option key={status} value={status}>{status === 'ALL' ? 'Tất cả trạng thái' : statusLabel(status)}</option>)}</select></label>
        </div>
        <div className="invoice-table-scroll" tabIndex={0} aria-label="Bảng hóa đơn có thể cuộn ngang">
          <table className="invoice-table"><thead><tr><th scope="col">Mã hóa đơn</th><th scope="col">Bệnh nhân</th><th scope="col">Ngày phát hành</th><th scope="col">Tổng tiền</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
            <tbody>{visible.map((item) => <tr key={item.id} className={selected?.id === item.id ? 'is-selected' : undefined}>
              <td><strong>INV-{shortId(item.id)}</strong><small>{item.id}</small></td>
              <td>BN #{shortId(item.patientId)}</td><td>{formatDate(item.createdAt)}</td>
              <td className="invoice-amount">{formatMoney(item.totalAmount)} {item.currency || '(chưa có đơn vị)'}</td>
              <td><Badge tone={item.status}>{item.status}</Badge></td>
              <td><button type="button" className="invoice-row-action" disabled={paymentBusy} onClick={() => setSelectedId(item.id)} aria-label={`Xem hóa đơn ${shortId(item.id)}`}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="invoice-empty" role="status">{rows.length ? 'Không có hóa đơn phù hợp với bộ lọc.' : 'No invoices found. Không có hóa đơn trong phạm vi đã tải.'}</p>}
        {filtered.length > PAGE_SIZE && <nav className="invoice-pagination" aria-label="Phân trang hóa đơn">
          <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div><button type="button" disabled={paymentBusy || currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} /> Trước</button>
            <span>Trang {currentPage}/{pages}</span><button type="button" disabled={paymentBusy || currentPage >= pages} onClick={() => { setPage((value) => Math.min(pages, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} /></button></div>
        </nav>}
        <p className="invoice-list-note">Thống kê và bộ lọc chỉ dựa trên hóa đơn đã được API trả về, không phải toàn bộ phòng khám.</p>
      </section>
    </>}

    {!hasLoaded && !loading && !lookupBusy && <section className="panel invoice-welcome"><span><FileText size={35} /></span><h3>{isPatient ? 'Chưa tải được hóa đơn' : 'Bắt đầu với một mã bệnh nhân'}</h3>
      <p>{isPatient ? 'Tải lại để kiểm tra hóa đơn của tài khoản.' : 'Nhập UUID bệnh nhân để xem danh sách hóa đơn thực tế và các giao dịch liên quan.'}</p></section>}

    {selected && <section className="panel invoice-detail-panel" aria-label="Chi tiết hóa đơn">
      <div className="invoice-section-head"><div><span className="invoice-section-kicker">HÓA ĐƠN ĐÃ PHÁT HÀNH</span><h3>Chi tiết INV-{shortId(selected.id)}</h3>
        <p>Mã hóa đơn đầy đủ: {selected.id}</p></div><Badge tone={selected.status}>{selected.status}</Badge></div>
      <dl className="invoice-detail-grid">
        <div><dt><UsersRound size={15} /> Mã bệnh nhân</dt><dd>{selected.patientId}</dd></div>
        <div><dt><CalendarDays size={15} /> Mã lịch hẹn</dt><dd>{selected.appointmentId}</dd></div>
        <div><dt><CalendarDays size={15} /> Ngày tạo</dt><dd>{formatDate(selected.createdAt)}</dd></div>
        <div><dt><Banknote size={15} /> Phương thức thanh toán</dt><dd>{selected.paymentMethod || 'Chưa ghi nhận'}</dd></div>
        <div><dt>Đã thanh toán lúc</dt><dd>{selected.paidAt ? formatDate(selected.paidAt) : 'Chưa thanh toán'}</dd></div>
        <div><dt>Phiên bản bảng giá</dt><dd>{selected.catalogRevision || 'Chưa cung cấp'}</dd></div>
        {selected.refundedAt && <div><dt>Hoàn tiền lúc</dt><dd>{formatDate(selected.refundedAt)}</dd></div>}
        {selected.cancelledAt && <div><dt>Đã hủy lúc</dt><dd>{formatDate(selected.cancelledAt)}</dd></div>}
      </dl>
      <div className="invoice-total-banner"><span>Tổng thanh toán</span><strong>{formatMoney(selected.totalAmount)} {selected.currency || '(chưa có đơn vị tiền tệ)'}</strong></div>
      <div className="invoice-line-items"><h4><ClipboardList size={18} /> Chi tiết dịch vụ / xét nghiệm</h4>
        {selected.items == null ? <p>API chưa cung cấp các dòng chi phí.</p> : selected.items.length === 0 ? <p>Không có dòng chi phí được trả về.</p> :
          <div className="invoice-lines-scroll" tabIndex={0} aria-label="Chi tiết dịch vụ, cuộn ngang khi cần"><table className="invoice-lines"><thead><tr><th scope="col">Dịch vụ</th><th scope="col">Số lượng</th><th scope="col">Đơn giá</th><th scope="col">Thành tiền</th></tr></thead>
            <tbody>{selected.items.map((item) => <tr key={item.id}><td><strong>{item.serviceName}</strong><small>{item.serviceCode} · {formatDate(item.serviceDate)} · Giá: {item.priceId}</small></td><td>{item.quantity}</td>
              <td>{formatMoney(item.unitPrice)} {item.currency}</td><td>{formatMoney(item.lineAmount)} {item.currency}</td></tr>)}</tbody></table></div>}
      </div>
      {selected.status === 'UNPAID' && <Alert tone="info">Online payment is unavailable: chưa có nhà cung cấp thanh toán trực tuyến được xác minh. Trang này không tự đánh dấu đã thanh toán.</Alert>}
      {selected.status === 'RECONCILIATION_REQUIRED' && <Alert tone="error">RECONCILIATION_REQUIRED: Cần đối soát giao dịch; liên hệ người được phân quyền, không thử thu tiền lại khi chưa kiểm tra.</Alert>}
      {selected.status === 'REFUNDED' && <Alert tone="info">REFUNDED: Trạng thái hoàn tiền được Billing Service trả về, không suy luận từ giao diện.</Alert>}
      {cashEnabled && selected.status === 'UNPAID' && <form className="invoice-cash-form" onSubmit={(event) => void cashPayment(event)}>
        <h4><Banknote size={19} /> Xác nhận đã nhận tiền mặt</h4><p>Chỉ xác nhận khi thực tế đã nhận tiền tại phòng khám. Không phải thanh toán online.</p>
        <label>Mã biên nhận duy nhất<input required aria-label="Mã biên nhận" maxLength={100} pattern="[A-Za-z0-9_-]{1,100}"
          value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} placeholder="Nhập mã biên nhận thực tế" /></label>
        <label className="invoice-cash-check"><input type="checkbox" checked={cashCollected} onChange={(event) => setCashCollected(event.target.checked)} /> Tôi xác nhận đã nhận đủ số tiền mặt ghi trên hóa đơn.</label>
        <button type="submit" disabled={paymentBusy || !cashCollected || !referencePattern.test(receiptReference)}>
          {paymentBusy ? 'Đang xác nhận...' : 'Confirm cash receipt · Xác nhận thu tiền mặt'} <ArrowRight size={16} /></button>
      </form>}
      {cashEnabled && <div className="invoice-transactions"><h4><RefreshCw size={17} /> Giao dịch được ghi nhận</h4>
        {transactionsError && <Alert tone="error">{transactionsError} <button type="button" onClick={() => setTransactionRevision((value) => value + 1)}>Thử lại</button></Alert>}
        {!transactions && !transactionsError && <p role="status">Đang tải lịch sử giao dịch...</p>}
        {transactions?.length === 0 && <p>Chưa có giao dịch được ghi nhận.</p>}
        {transactions?.map((item) => <div className="invoice-transaction" key={item.id}><span><strong>{item.type}</strong><small>{item.externalReference} · {formatDate(item.confirmedAt)}</small></span>
          <span><strong>{formatMoney(item.amount)} {item.currency}</strong><small>{item.status}</small></span></div>)}
      </div>}
    </section>}
  </div>;
}
