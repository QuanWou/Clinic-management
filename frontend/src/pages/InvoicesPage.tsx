import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Banknote, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight,
  CircleAlert, ClipboardList, Clock3, FileText, Plus, ReceiptText, RefreshCw,
  Search, UsersRound, X
} from 'lucide-react';
import { confirmCashPayment, getInvoiceTransactions, getPatientInvoices, getReceptionPatientByCode, getReceptionPatientById, getStaffInvoiceDirectory } from '../api/clinic';
import Alert from '../components/Alert';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import { integrations } from '../config/integrations.config';
import type { InvoiceResponse, PaymentTransactionResponse, ReceptionPatientResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatCurrency, formatDate, shortId } from '../utils/format';
import { statusLabel } from '../utils/locale';
import { filterInvoiceDirectory, invoiceCounts, paginateInvoices, type InvoiceFilter } from '../utils/invoiceDirectory';
import BillingWorkflowPanel from './BillingWorkflowPanel';
import './patientPortal.css';
import './invoiceUx.css';

type InvoicesPageProps = {
  invoices: InvoiceResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

const patientCodePattern = /^BN[0-9]{6,}$/;
const uuid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
const referencePattern = /^[A-Za-z0-9_-]{1,100}$/;
const PAGE_SIZE = 8;
const STAFF_PAGE_SIZE = 20;
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
  const [patientCode, setPatientCode] = useState('');
  const [patientCodeError, setPatientCodeError] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ReceptionPatientResponse | null>(null);
  const [searchedPatientId, setSearchedPatientId] = useState('');
  const [staffInvoices, setStaffInvoices] = useState<InvoiceResponse[] | null>(null);
  const [staffScope, setStaffScope] = useState<'directory' | 'patient' | 'created'>('directory');
  const [directoryPage, setDirectoryPage] = useState(0);
  const [directoryPages, setDirectoryPages] = useState(0);
  const [directoryTotal, setDirectoryTotal] = useState(0);
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const [directoryLoading, setDirectoryLoading] = useState(!isPatient);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [patientLabels, setPatientLabels] = useState<Record<string, string>>({});
  const [lookupBusy, setLookupBusy] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showIssuance, setShowIssuance] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceFilter>('ALL');
  const [page, setPage] = useState(1);
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [cashCollected, setCashCollected] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [transactions, setTransactions] = useState<PaymentTransactionResponse[] | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const requestId = useRef(0);
  const patientCodeInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const detailPanel = useRef<HTMLElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => () => { requestId.current += 1; }, []);
  useEffect(() => { setSelectedId(''); setPage(1); }, [invoices]);
  useEffect(() => {
    requestId.current += 1;
    setStaffInvoices(null); setSearchedPatientId(''); setPatientCode(''); setSelectedPatient(null);
    setStaffScope('directory'); setDirectoryPage(0); setDirectoryRevision((value) => value + 1);
    setSelectedId(''); setNotice(null); setQueryError(null);
  }, [role]);
  useEffect(() => {
    if (isPatient || staffScope !== 'directory') return;
    let active = true;
    const request = ++requestId.current;
    setDirectoryLoading(true); setDirectoryError(null); setStaffInvoices(null); setSelectedId('');
    void getStaffInvoiceDirectory(directoryPage, STAFF_PAGE_SIZE).then((result) => {
      if (!active || request !== requestId.current) return;
      if (!result || !Array.isArray(result.content) || result.number !== directoryPage
        || !Number.isInteger(result.totalPages) || result.totalPages < 0
        || !Number.isInteger(result.totalElements) || result.totalElements < 0
        || result.content.some((invoice) => !invoice?.id || !invoice.patientId || !invoice.appointmentId)) {
        throw new Error('Dữ liệu danh sách hóa đơn không hợp lệ.');
      }
      setStaffInvoices(result.content); setDirectoryPages(result.totalPages); setDirectoryTotal(result.totalElements);
      setFilterText(''); setStatusFilter('ALL'); setPage(1);
    }).catch((cause: unknown) => {
      if (active && request === requestId.current) setDirectoryError(cause instanceof Error ? cause.message : 'Không thể tải danh sách hóa đơn.');
    }).finally(() => {
      if (active && request === requestId.current) setDirectoryLoading(false);
    });
    return () => { active = false; };
  }, [isPatient, staffScope, directoryPage, directoryRevision]);

  useEffect(() => {
    if (isPatient || !staffInvoices?.length) return;
    let active = true;
    const ids = [...new Set(staffInvoices.map((invoice) => invoice.patientId))]
      .filter((id) => !patientLabels[id] && selectedPatient?.id !== id);
    if (ids.length) void (async () => {
      for (let index = 0; index < ids.length && active; index += 4) {
        const results = await Promise.allSettled(ids.slice(index, index + 4).map((id) => getReceptionPatientById(id)));
        if (!active) return;
        const labels: Record<string, string> = {};
        results.forEach((result, offset) => {
          const id = ids[index + offset];
          if (result.status === 'fulfilled' && result.value.id === id && result.value.fullName) {
            labels[id] = `${result.value.fullName} · ${result.value.patientCode || id}`;
          }
        });
        if (Object.keys(labels).length) setPatientLabels((previous) => ({ ...previous, ...labels }));
      }
    })();
    return () => { active = false; };
  }, [isPatient, staffInvoices, selectedPatient]);
  useEffect(() => { setReceiptReference(''); setReceiptError(''); setCashCollected(false); }, [selectedId]);

  const rows = isPatient ? (invoices ?? []) : (staffInvoices ?? []);
  const filtered = filterInvoiceDirectory(rows, filterText, statusFilter);
  const isStaffDirectory = !isPatient && staffScope === 'directory';
  const { pages, currentPage, visible } = paginateInvoices(filtered, page, PAGE_SIZE, isStaffDirectory);
  const selected = visible.find((item) => item.id === selectedId) ?? (isPatient ? visible[0] ?? null : null);
  const counts = invoiceCounts(rows);
  const hasLoaded = isPatient ? invoices != null : staffInvoices != null;
  const scopeDescription = isPatient ? 'Tài khoản hiện tại' :
    staffScope === 'directory' ? `Trang ${directoryPage + 1}/${Math.max(1, directoryPages)} · ${directoryTotal} hóa đơn toàn phòng khám` :
    selectedPatient?.id === searchedPatientId
      ? `${selectedPatient.fullName} · ${selectedPatient.patientCode}`
      : searchedPatientId ? 'Hồ sơ vừa xuất hóa đơn' : 'Chưa chọn bệnh nhân';

  function showDirectory() {
    if (paymentBusy) return;
    requestId.current += 1;
    setPatientCode(''); setPatientCodeError(''); setSelectedPatient(null); setSearchedPatientId('');
    setSelectedId(''); setQueryError(null); setNotice(null); setFilterText(''); setStatusFilter('ALL'); setPage(1);
    setDirectoryPage(0); setStaffScope('directory'); setDirectoryRevision((value) => value + 1);
  }

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

  useEffect(() => {
    if (!selectedId) return;
    requestAnimationFrame(() => detailPanel.current?.focus());
  }, [selectedId]);

  useEffect(() => {
    if (isPatient || !selectedId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isPatient, selectedId]);

  function clearLookup(next: string) {
    if (paymentBusy) return;
    if (!next.trim()) { showDirectory(); return; }
    requestId.current += 1;
    setStaffScope('patient');
    setPatientCode(next); setSelectedPatient(null); setStaffInvoices(null); setSearchedPatientId('');
    setSelectedId(''); setFilterText(''); setStatusFilter('ALL'); setPage(1);
    setPatientCodeError(''); setQueryError(null); setNotice(null); setLookupBusy(false);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPatient || lookupBusy) return;
    const code = patientCode.trim().toUpperCase();
    if (code.length > 24 || !patientCodePattern.test(code)) {
      setPatientCodeError('Nhập mã hồ sơ bệnh nhân dạng BN000001, không nhập UUID.');
      patientCodeInput.current?.focus();
      return;
    }
    const request = ++requestId.current;
    setStaffScope('patient');
    setLookupBusy(true); setQueryError(null); setNotice(null); setStaffInvoices(null); setSelectedPatient(null); setSelectedId('');
    setFilterText(''); setStatusFilter('ALL'); setPage(1);
    try {
      const patient = await getReceptionPatientByCode(code);
      if (!patient || !uuid.test(patient.id) || patient.patientCode !== code) {
        throw new Error('Thông tin bệnh nhân không khớp với mã hồ sơ đang tra cứu.');
      }
      if (request !== requestId.current) return;
      const result = await getPatientInvoices(patient.id);
      if (!Array.isArray(result) || result.some((item) => item.patientId !== patient.id)) {
        throw new Error('Không thể tải hóa đơn đúng với mã bệnh nhân đã chọn.');
      }
      if (request !== requestId.current) return;
      setPatientCode(code); setSelectedPatient(patient); setStaffInvoices(result); setSearchedPatientId(patient.id);
    } catch (cause) {
      if (request === requestId.current) setQueryError(cause instanceof Error ? cause.message : 'Tra cứu hóa đơn thất bại.');
    } finally {
      if (request === requestId.current) setLookupBusy(false);
    }
  }

  function invoiceCreated(invoice: InvoiceResponse) {
    const request = ++requestId.current;
    setStaffScope('created');
    // Never mix results from a previously searched patient into the newly created invoice scope.
    const retainedPatient = selectedPatient?.id === invoice.patientId ? selectedPatient : null;
    setPatientCode(retainedPatient?.patientCode ?? ''); setSelectedPatient(retainedPatient);
    setSearchedPatientId(invoice.patientId);
    setStaffInvoices((previous) => [invoice, ...(searchedPatientId === invoice.patientId ? previous ?? [] : [])
      .filter((item) => item.patientId === invoice.patientId && item.id !== invoice.id)]);
    setFilterText(''); setStatusFilter('ALL'); setPage(1); setSelectedId(invoice.id);
    setNotice(`Hóa đơn #${shortId(invoice.id)} đã phát hành. Chưa ghi nhận thanh toán.`);
    setQueryError(null); setShowIssuance(false);
    if (!retainedPatient) {
      void getReceptionPatientById(invoice.patientId).then((patient) => {
        if (request !== requestId.current || patient.id !== invoice.patientId) return;
        setSelectedPatient(patient); setPatientCode(patient.patientCode ?? '');
      }).catch(() => { /* An unavailable directory must not invent a patient code. */ });
    }
  }

  async function cashPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setQueryError(null); setNotice(null); setReceiptError('');
    if (!cashEnabled || !selected || selected.status !== 'UNPAID' || paymentBusy || !cashCollected) return;
    if (!referencePattern.test(receiptReference)) {
      setReceiptError('Dùng 1–100 chữ cái, chữ số, dấu gạch dưới hoặc gạch ngang.');
      receiptInput.current?.focus();
      return;
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
      setNotice('Đã xác nhận thu tiền mặt và cập nhật hóa đơn.');
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Chưa xác nhận được thu tiền mặt.'); }
    finally { setPaymentBusy(false); }
  }

  function openDetail(id: string, trigger: HTMLButtonElement) {
    detailTrigger.current = trigger;
    setSelectedId(id);
  }

  function closeDetail() {
    if (paymentBusy) return;
    setSelectedId('');
    requestAnimationFrame(() => detailTrigger.current?.focus());
  }

  function handleDetailKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!paymentBusy) closeDetail();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(detailPanel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) { event.preventDefault(); detailPanel.current?.focus(); return; }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === detailPanel.current)) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === detailPanel.current)) {
      event.preventDefault(); first.focus();
    }
  }

  return <div className={`invoice-workspace${isPatient ? ' patient-invoices' : ''}${selected ? ' has-invoice-detail' : ''}`}>
    <PageHeader title={isPatient ? 'Hóa đơn của tôi' : 'Hóa đơn'} subtitle={isPatient ? 'Tra cứu hóa đơn và chi tiết chi phí của bạn' : 'Quản lý hóa đơn và thu tiền theo quyền được cấp'}
      actions={<>{isPatient && <button type="button" className="soft-button" disabled={loading} onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button>}
        {!isPatient && <button type="button" className="soft-button" disabled={paymentBusy || directoryLoading} onClick={showDirectory}><RefreshCw size={16} /> Tải danh sách</button>}
        {cashEnabled && <button type="button" disabled={paymentBusy} onClick={() => setShowIssuance((value) => !value)}>
          {showIssuance ? <X size={16} /> : <Plus size={16} />}{showIssuance ? 'Đóng quy trình' : 'Xuất hóa đơn'}</button>}</>} />

    {error && <Alert tone="error">{error} <button type="button" className="soft-button" disabled={loading} onClick={onRefresh}>Thử lại</button></Alert>}
    {queryError && <Alert tone="error">{queryError}</Alert>}
    {directoryError && staffScope === 'directory' && <Alert tone="error">Không tải được danh sách hóa đơn: {directoryError} <button type="button" className="soft-button" onClick={showDirectory}>Thử lại</button></Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}

    {cashEnabled && showIssuance && <div className="invoice-billing-flow"><BillingWorkflowPanel onCreated={invoiceCreated} /></div>}
    {!isPatient && <section className="panel invoice-search-panel" aria-label="Tra cứu hóa đơn theo bệnh nhân">
      <div className="invoice-section-head"><div><span className="invoice-section-kicker">TRA CỨU</span><h3>Tìm hóa đơn của bệnh nhân</h3>
        <p>Danh sách phòng khám tự tải khi mở trang. Nhập mã BN để lọc chính xác hóa đơn theo bệnh nhân.</p></div><span className="invoice-section-icon"><Search size={21} /></span></div>
      <form onSubmit={(event) => void search(event)} className="invoice-search-form">
        <div className="invoice-field">
          <label className={patientCodeError ? 'is-invalid' : undefined}><UsersRound size={18} /><span className="invoice-sr-only">Mã bệnh nhân</span>
            <input ref={patientCodeInput} required aria-label="Mã bệnh nhân" aria-invalid={Boolean(patientCodeError)}
              aria-describedby={patientCodeError ? 'invoice-patient-code-error' : undefined} placeholder="Ví dụ: BN000001" disabled={paymentBusy}
              maxLength={24} autoComplete="off" value={patientCode} onChange={(event) => clearLookup(event.target.value)} /></label>
          {patientCodeError && <p className="invoice-field-error" id="invoice-patient-code-error" role="alert">{patientCodeError}</p>}
        </div>
        <button type="submit" disabled={lookupBusy || paymentBusy || !patientCode.trim()}><Search size={16} /> {lookupBusy ? 'Đang tra cứu...' : 'Tìm hóa đơn'}</button>
        <button type="button" className="soft-button" disabled={paymentBusy || directoryLoading} onClick={showDirectory}>Danh sách tất cả</button>
      </form>
    </section>}

    {loading && isPatient && <p role="status" className="invoice-loading">Đang tải hóa đơn...</p>}
    {lookupBusy && <p role="status" className="invoice-loading">Đang tra cứu hóa đơn bệnh nhân...</p>}
    {directoryLoading && !isPatient && <p role="status" className="invoice-loading">Đang tải danh sách hóa đơn phòng khám...</p>}
    {hasLoaded && <>
      <section className="invoice-metrics" aria-label="Thống kê trong dữ liệu hóa đơn đã tải">
        {[
          { title: staffScope === 'directory' && !isPatient ? 'Hóa đơn trên trang' : 'Hóa đơn đã tải', value: counts.total, hint: scopeDescription, icon: ReceiptText, tone: 'blue' },
          { title: 'Chưa thanh toán', value: counts.unpaid, hint: 'Cần xử lý', icon: Clock3, tone: 'orange' },
          { title: 'Đã thanh toán', value: counts.paid, hint: 'Đã hoàn tất', icon: CheckCircle2, tone: 'green' },
          { title: 'Cần đối soát', value: counts.attention, hint: 'Cần kiểm tra thêm', icon: CircleAlert, tone: 'purple' }
        ].map(({ title, value, hint, icon: Icon, tone }) => <article key={title} className={`invoice-metric invoice-metric-${tone}`}>
          <span className="invoice-metric-icon"><Icon size={21} /></span><strong>{value.toLocaleString('vi-VN')}</strong><h3>{title}</h3><p>{hint}</p></article>)}
      </section>
      <section className="panel invoice-list-panel" aria-label="Danh sách hóa đơn">
        <div className="invoice-section-head"><div><span className="invoice-section-kicker">{isPatient ? 'HÓA ĐƠN' : 'DANH SÁCH HÓA ĐƠN'}</span><h3>Danh sách hóa đơn</h3>
          <p>{filtered.length} / {rows.length} hóa đơn phù hợp · {scopeDescription}</p></div><span className="invoice-scope-pill">{isPatient ? 'Tài khoản của bạn' : staffScope === 'directory' ? 'Dữ liệu thực · trang hiện tại' : 'Theo bệnh nhân'}</span></div>
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
              <td>{isPatient ? 'Bạn' : selectedPatient?.id === item.patientId
                ? `${selectedPatient.fullName} · ${selectedPatient.patientCode}` : patientLabels[item.patientId] || `Mã hồ sơ: ${item.patientId}`}</td><td>{formatDate(item.createdAt)}</td>
              <td className="invoice-amount">{formatCurrency(item.totalAmount, item.currency)}</td>
              <td><Badge tone={item.status}>{item.status}</Badge></td>
              <td><button type="button" className="invoice-row-action" disabled={paymentBusy}
                onClick={(event) => openDetail(item.id, event.currentTarget)} aria-label={`Xem hóa đơn ${shortId(item.id)}`}>Chi tiết <ArrowRight size={14} /></button></td>
            </tr>)}</tbody></table>
        </div>
        {!filtered.length && <p className="invoice-empty" role="status">{rows.length ? 'Không có hóa đơn phù hợp với bộ lọc trên trang này.' : isPatient ? 'Bạn chưa có hóa đơn.' : staffScope === 'directory' ? 'Chưa có hóa đơn nào được phát hành trong hệ thống.' : 'Chưa có hóa đơn cho bệnh nhân này.'}</p>}
        {!isStaffDirectory && filtered.length > PAGE_SIZE && <nav className="invoice-pagination" aria-label="Phân trang hóa đơn">
          <span>Hiển thị {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} / {filtered.length}</span>
          <div><button type="button" disabled={paymentBusy || currentPage === 1} onClick={() => { setPage((value) => Math.max(1, value - 1)); setSelectedId(''); }}><ChevronLeft size={16} /> Trước</button>
            <span>Trang {currentPage}/{pages}</span><button type="button" disabled={paymentBusy || currentPage >= pages} onClick={() => { setPage((value) => Math.min(pages, value + 1)); setSelectedId(''); }}>Sau <ChevronRight size={16} /></button></div>
        </nav>}
        {isStaffDirectory && directoryPages > 1 && <nav className="invoice-pagination" aria-label="Chuyển trang danh sách hóa đơn phòng khám">
          <span>Trang danh sách {directoryPage + 1}/{directoryPages} · {directoryTotal} hóa đơn</span>
          <div><button type="button" disabled={paymentBusy || directoryLoading || directoryPage === 0} onClick={() => setDirectoryPage((value) => Math.max(0, value - 1))}><ChevronLeft size={16} /> Trang trước</button>
          <button type="button" disabled={paymentBusy || directoryLoading || directoryPage + 1 >= directoryPages} onClick={() => setDirectoryPage((value) => value + 1)}>Trang tiếp <ChevronRight size={16} /></button></div>
        </nav>}
        {!isPatient && <p className="invoice-list-note">{staffScope === 'directory' ? 'Mỗi trang máy chủ tải tối đa 20 hóa đơn. Bộ lọc chỉ áp dụng trên trang này; nhập mã bệnh nhân để tra cứu riêng.' : 'Bạn đang xem các hóa đơn trong phạm vi đã chọn.'}</p>}
      </section>
    </>}

    {!hasLoaded && !loading && !lookupBusy && !directoryLoading && <section className="panel invoice-welcome"><span><FileText size={35} /></span><h3>{isPatient ? 'Chưa tải được hóa đơn' : staffScope === 'directory' ? 'Chưa tải được danh sách hóa đơn' : 'Bắt đầu tra cứu'}</h3>
      <p>{isPatient ? 'Tải lại để kiểm tra hóa đơn của bạn.' : staffScope === 'directory' ? 'Nhấn Tải danh sách để thử lại.' : 'Hóa đơn sẽ xuất hiện tại đây sau khi tra cứu.'}</p></section>}

    {selected && <div className={isPatient ? 'invoice-detail-inline' : 'invoice-detail-overlay'}>
      {!isPatient && <button type="button" className="invoice-detail-backdrop" tabIndex={-1} aria-hidden="true" disabled={paymentBusy} onClick={closeDetail} />}
      <section ref={detailPanel} tabIndex={-1} className="panel invoice-detail-panel"
        role={isPatient ? undefined : 'dialog'} aria-modal={isPatient ? undefined : true}
        aria-labelledby={isPatient ? undefined : 'invoice-detail-title'}
        aria-label={isPatient ? `Chi tiết hóa đơn INV-${shortId(selected.id)}` : undefined}
        onKeyDown={isPatient ? undefined : handleDetailKeyDown}>
      <div className="invoice-section-head"><div><span className="invoice-section-kicker">HÓA ĐƠN ĐÃ PHÁT HÀNH</span><h3 id={isPatient ? undefined : 'invoice-detail-title'}>Chi tiết INV-{shortId(selected.id)}</h3>
        <p>Mã hóa đơn đầy đủ: {selected.id}</p></div><div className="invoice-detail-heading-actions"><Badge tone={selected.status}>{selected.status}</Badge>
          {!isPatient && <button type="button" className="soft-button invoice-detail-close" disabled={paymentBusy} onClick={closeDetail} aria-label="Đóng chi tiết hóa đơn" title="Đóng chi tiết"><X size={18} aria-hidden="true" /></button>}</div></div>
      <dl className="invoice-detail-grid">
          {!isPatient && <div><dt><UsersRound size={15} /> Bệnh nhân</dt><dd>{selectedPatient?.id === selected.patientId
            ? `${selectedPatient.fullName} · ${selectedPatient.patientCode}` : patientLabels[selected.patientId] || `Mã hồ sơ: ${selected.patientId}`}</dd></div>}
        <div><dt><CalendarDays size={15} /> Mã lịch hẹn</dt><dd>{selected.appointmentId}</dd></div>
        <div><dt><CalendarDays size={15} /> Ngày tạo</dt><dd>{formatDate(selected.createdAt)}</dd></div>
        <div><dt><Banknote size={15} /> Phương thức thanh toán</dt><dd>{selected.paymentMethod || 'Chưa ghi nhận'}</dd></div>
        <div><dt>Đã thanh toán lúc</dt><dd>{selected.paidAt ? formatDate(selected.paidAt) : 'Chưa thanh toán'}</dd></div>
        <div><dt>Phiên bản bảng giá</dt><dd>{selected.catalogRevision || 'Chưa cung cấp'}</dd></div>
        {selected.refundedAt && <div><dt>Hoàn tiền lúc</dt><dd>{formatDate(selected.refundedAt)}</dd></div>}
        {selected.cancelledAt && <div><dt>Đã hủy lúc</dt><dd>{formatDate(selected.cancelledAt)}</dd></div>}
      </dl>
      <div className="invoice-total-banner"><span>Tổng thanh toán</span><strong>{formatCurrency(selected.totalAmount, selected.currency)}</strong></div>
      <div className="invoice-line-items"><h4><ClipboardList size={18} /> Chi tiết dịch vụ / xét nghiệm</h4>
        {selected.items == null ? <p>Chưa có chi tiết dịch vụ cho hóa đơn này.</p> : selected.items.length === 0 ? <p>Hóa đơn chưa có dòng chi phí.</p> :
          <div className="invoice-lines-scroll" tabIndex={0} aria-label="Chi tiết dịch vụ, cuộn ngang khi cần"><table className="invoice-lines"><thead><tr><th scope="col">Dịch vụ</th><th scope="col">Số lượng</th><th scope="col">Đơn giá</th><th scope="col">Thành tiền</th></tr></thead>
            <tbody>{selected.items.map((item) => <tr key={item.id}><td><strong>{item.serviceName}</strong><small>{item.serviceCode} · {formatDate(item.serviceDate)} · Giá: {item.priceId}</small></td><td>{item.quantity}</td>
              <td>{formatCurrency(item.unitPrice, item.currency)}</td><td>{formatCurrency(item.lineAmount, item.currency)}</td></tr>)}</tbody></table></div>}
      </div>
      {selected.status === 'UNPAID' && <Alert tone="info">{isPatient ? 'Vui lòng thanh toán tại quầy thu ngân.' : cashEnabled ? 'Thanh toán trực tuyến chưa khả dụng. Bạn có thể xác nhận tiền mặt nếu đã thu tại phòng khám.' : 'Thanh toán trực tuyến chưa khả dụng. Hãy liên hệ quầy thu ngân.'}</Alert>}
      {selected.status === 'RECONCILIATION_REQUIRED' && <Alert tone="error">Giao dịch cần được đối soát. Hãy liên hệ người phụ trách trước khi thu lại.</Alert>}
      {selected.status === 'REFUNDED' && <Alert tone="info">Hóa đơn đã được hoàn tiền.</Alert>}
      {cashEnabled && selected.status === 'UNPAID' && <form className="invoice-cash-form" onSubmit={(event) => void cashPayment(event)}>
        <h4><Banknote size={19} /> Xác nhận đã nhận tiền mặt</h4><p>Chỉ xác nhận khi thực tế đã nhận tiền tại phòng khám. Không phải thanh toán online.</p>
        <label>Mã biên nhận duy nhất<input ref={receiptInput} required aria-label="Mã biên nhận" maxLength={100}
          aria-invalid={Boolean(receiptError)} aria-describedby={receiptError ? 'invoice-receipt-error' : undefined}
          value={receiptReference} onChange={(event) => { setReceiptReference(event.target.value); setReceiptError(''); }} placeholder="Nhập mã biên nhận thực tế" />
          {receiptError && <span className="invoice-field-error" id="invoice-receipt-error" role="alert">{receiptError}</span>}</label>
        <label className="invoice-cash-check"><input type="checkbox" checked={cashCollected} onChange={(event) => setCashCollected(event.target.checked)} /> Tôi xác nhận đã nhận đủ số tiền mặt ghi trên hóa đơn.</label>
        <button type="submit" disabled={paymentBusy || !cashCollected || !receiptReference.trim()}>
          {paymentBusy ? 'Đang xác nhận...' : 'Xác nhận thu tiền mặt'} <ArrowRight size={16} /></button>
      </form>}
      {cashEnabled && <div className="invoice-transactions"><h4><RefreshCw size={17} /> Giao dịch được ghi nhận</h4>
        {transactionsError && <Alert tone="error">{transactionsError} <button type="button" onClick={() => setTransactionRevision((value) => value + 1)}>Thử lại</button></Alert>}
        {!transactions && !transactionsError && <p role="status">Đang tải lịch sử giao dịch...</p>}
        {transactions?.length === 0 && <p>Chưa có giao dịch được ghi nhận.</p>}
        {transactions?.map((item) => <div className="invoice-transaction" key={item.id}><span><strong>{item.type}</strong><small>{item.externalReference} · {formatDate(item.confirmedAt)}</small></span>
          <span><strong>{formatCurrency(item.amount, item.currency)}</strong><small>{item.status}</small></span></div>)}
      </div>}
      </section>
    </div>}
  </div>;
}
