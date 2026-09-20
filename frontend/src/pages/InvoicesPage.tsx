import { type FormEvent, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { confirmCashPayment, getInvoiceTransactions, getPatientInvoices } from '../api/clinic';
import Alert from '../components/Alert';
import { integrations } from '../config/integrations.config';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { InvoiceResponse, PaymentTransactionResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';
import { formatDate, formatMoney, shortId } from '../utils/format';
import { getUiInvoices } from '../utils/uiData';

type InvoicesPageProps = {
  invoices: InvoiceResponse[] | null | undefined;
  role: ClinicRole;
  error: string | null;
  loading: boolean;
  onRefresh: () => void;
};

export default function InvoicesPage({ invoices, role, error, loading, onRefresh }: InvoicesPageProps) {
  const [patientId, setPatientId] = useState('');
  const [staffInvoices, setStaffInvoices] = useState<InvoiceResponse[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptReference, setReceiptReference] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransactionResponse[] | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [transactionRevision, setTransactionRevision] = useState(0);
  const isPatient = role === 'PATIENT';
  const isCashier = role === 'ADMIN' || role === 'RECEPTIONIST';
  const cashEnabled = integrations.billing && isCashier;
  useEffect(() => { setSelectedId(null); }, [invoices]);
  const rows = getUiInvoices(isPatient ? invoices : staffInvoices);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0];

  useEffect(() => {
    if (!cashEnabled || !selected?.id) { setTransactions(null); setTransactionsError(null); return; }
    let active = true;
    setTransactions(null); setTransactionsError(null);
    void getInvoiceTransactions(selected.id).then((result) => {
      if (!active) return;
      if (!Array.isArray(result)) throw new Error('Invalid payment transaction response');
      setTransactions(result);
    }).catch((cause: unknown) => {
      if (active) setTransactionsError(cause instanceof Error ? cause.message : 'Unable to load transactions');
    });
    return () => { active = false; };
  }, [cashEnabled, selected?.id, transactionRevision]);

  async function cashPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setQueryError(null); setNotice(null);
    if (!cashEnabled || !selected || selected.status !== 'UNPAID') return;
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(receiptReference)) {
      setQueryError('Receipt reference must contain 1–100 letters, numbers, underscores or dashes.');
      return;
    }
    setBusy(true);
    try {
      const confirmed = await confirmCashPayment(selected.id, receiptReference);
      if (confirmed.id !== selected.id || confirmed.status !== 'PAID' || confirmed.paymentMethod !== 'CASH'
        || !confirmed.currency || (selected.currency && selected.currency !== confirmed.currency)) {
        throw new Error('Server did not confirm a paid cash invoice. Refresh to verify its status.');
      }
      setStaffInvoices((previous) => previous?.map((invoice) => invoice.id === confirmed.id ? confirmed : invoice) ?? null);
      setReceiptReference('');
      setTransactionRevision((value) => value + 1);
      setNotice('Cash receipt confirmed by the billing service.');
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Cash payment was not confirmed'); }
    finally { setBusy(false); }
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setQueryError(null); setStaffInvoices(null); setSelectedId(null);
    try {
      if (!/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(patientId.trim())) throw new Error('Enter a valid patient UUID.');
      const result = await getPatientInvoices(patientId.trim());
      if (!Array.isArray(result)) throw new Error('Unexpected invoice response');
      setStaffInvoices(result);
    } catch (cause) { setQueryError(cause instanceof Error ? cause.message : 'Unable to load invoices'); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeader title="Invoices" subtitle={isPatient ? 'Your invoices from the clinic.' : 'Look up invoices for a specific patient ID.'}
      actions={isPatient ? <button className="soft-button" type="button" onClick={onRefresh} disabled={loading}>Refresh</button> : undefined} />
    {error && <Alert tone="error">{error} <button type="button" onClick={onRefresh} disabled={loading}>Retry</button></Alert>}
    {queryError && <Alert tone="error">{queryError}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    {!isPatient && <form className="inline-search" onSubmit={(event) => void search(event)}>
      <Search size={16} /><input aria-label="Patient UUID" placeholder="Patient UUID" required value={patientId} onChange={(event) => setPatientId(event.target.value)} />
      <button type="submit" disabled={busy}>Search invoices</button>
    </form>}
    {loading && isPatient && <p role="status">Loading invoices...</p>}
    <section className="split-page">
      <article className="panel table-panel">
        {rows.length === 0 && <p>{busy ? 'Loading invoices...' : !isPatient && !staffInvoices ? 'Enter a patient UUID to load invoices.' : isPatient && !invoices ? 'No invoice data loaded.' : 'No invoices found.'}</p>}
        {rows.length > 0 && <div className="data-table">
          <div className="table-row table-head invoices-grid"><span>Invoice ID</span><span>Patient ID</span><span>Date</span><span>Amount</span><span>Status</span><span>Actions</span></div>
          {rows.map((invoice) => <button type="button" className="table-row invoices-grid" key={invoice.id} aria-pressed={selected?.id === invoice.id} onClick={() => setSelectedId(invoice.id)}>
            <span>INV-{shortId(invoice.id)}</span><span className="person-cell"><Avatar label={invoice.patientAvatar} size="sm" />{invoice.patientName}</span>
            <span>{formatDate(invoice.createdAt)}</span><span>{formatMoney(invoice.totalAmount)} {invoice.currency || '(currency not specified)'}</span>
            <span><Badge tone={invoice.status}>{invoice.status}</Badge></span><span>View</span>
          </button>)}
        </div>}
      </article>
      {selected && <article className="panel detail-panel invoice-detail">
        <div className="panel-heading"><h3>Invoice Details</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
        <strong>INV-{shortId(selected.id)}</strong>
        <dl className="details-list compact">
          <div><dt>Patient ID</dt><dd>{selected.patientId}</dd></div>
          <div><dt>Appointment ID</dt><dd>{selected.appointmentId}</dd></div>
          <div><dt>Created</dt><dd>{formatDate(selected.createdAt)}</dd></div>
          <div><dt>Paid at</dt><dd>{selected.paidAt ? formatDate(selected.paidAt) : 'Not paid'}</dd></div>
          <div><dt>Method</dt><dd>{selected.paymentMethod || 'Not recorded'}</dd></div>
          <div><dt>Pricing revision</dt><dd>{selected.catalogRevision || 'Not provided'}</dd></div>
          <div><dt>Refunded at</dt><dd>{selected.refundedAt ? formatDate(selected.refundedAt) : 'Not refunded'}</dd></div>
          <div><dt>Cancelled at</dt><dd>{selected.cancelledAt ? formatDate(selected.cancelledAt) : 'Not cancelled'}</dd></div>
        </dl>
        <div className="invoice-total"><span>Total</span><strong>{formatMoney(selected.totalAmount)} {selected.currency || '(currency not specified)'}</strong></div>
        {selected.items && <section className="panel"><h4>Invoice item snapshots</h4>
          {selected.items.length === 0 ? <p>No invoice line items returned.</p> :
            selected.items.map((item) => <p key={item.id}>{item.serviceCode} — {item.serviceName}: {item.quantity} × {formatMoney(item.unitPrice)} {item.currency} = {formatMoney(item.lineAmount)} {item.currency}; service date {item.serviceDate}, price version {item.priceId}</p>)}
        </section>}
        {selected.status === 'UNPAID' && <Alert tone="info">Online payment is unavailable without a verified payment provider. This page never marks an invoice paid locally.</Alert>}
        {selected.status === 'RECONCILIATION_REQUIRED' && <Alert tone="error">Payment reconciliation is required. Contact authorized billing staff; do not retry payment blindly.</Alert>}
        {selected.status === 'REFUNDED' && <Alert tone="info">Refund status is reported by the billing service.</Alert>}
        {cashEnabled && selected.status === 'UNPAID' && <form className="settings-form" onSubmit={(event) => void cashPayment(event)}>
          <h4>Confirm cash received at the clinic</h4>
          <p>Only confirm physical cash already collected. The billing service records the receipt and verifies the transaction.</p>
          <label>Unique receipt reference<input required maxLength={100} value={receiptReference}
            onChange={(event) => setReceiptReference(event.target.value)} /></label>
          <button type="submit" disabled={busy}>{busy ? 'Confirming...' : 'Confirm cash receipt'}</button>
        </form>}
        {cashEnabled && <section className="panel"><h4>Recorded payment transactions</h4>
          {transactionsError && <Alert tone="error">{transactionsError} <button type="button" onClick={() => setTransactionRevision((value) => value + 1)}>Retry</button></Alert>}
          {transactions?.length === 0 && <p>No payment transactions reported.</p>}
          {transactions?.map((transaction) => <p key={transaction.id}>{transaction.type} — {formatMoney(transaction.amount)} {transaction.currency}, {transaction.status}, reference {transaction.externalReference}</p>)}
        </section>}
      </article>}
    </section>
  </>;
}
