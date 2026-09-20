import { Search } from 'lucide-react';
import { useState } from 'react';
import Alert from '../components/Alert';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { InvoiceResponse } from '../types/domain';
import { formatDate, formatMoney, shortId } from '../utils/format';
import { getUiInvoices, type Lookup } from '../utils/uiData';

type InvoicesPageProps = {
  invoices: InvoiceResponse[] | null | undefined;
  lookup: Lookup;
  error?: string;
  supported: boolean;
  loading: boolean;
};

export default function InvoicesPage({ invoices, lookup, error, supported, loading }: InvoicesPageProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const rows = getUiInvoices(invoices, lookup).filter((invoice) =>
    `${invoice.id} ${invoice.patientName} ${invoice.status}`.toLowerCase().includes(query.toLowerCase())
  );
  const selected = rows.find((invoice) => invoice.id === selectedId) ?? rows[0];

  return (
    <>
      <PageHeader title="Invoices" subtitle="Invoices available to your account." actions={
        <div className="inline-search"><Search size={16} /><input aria-label="Search invoices" placeholder="Search invoice..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      } />
      {error && <Alert tone="error">Unable to load invoices: {error}</Alert>}
      {!supported && <Alert>The backend currently exposes a patient invoice list only. Staff invoice lists are not available yet.</Alert>}
      {supported && !loading && !error && rows.length === 0 && <Alert>{query ? 'No invoices match your search.' : 'No invoices found.'}</Alert>}
      {supported && rows.length > 0 && (
        <section className="split-page">
          <article className="panel table-panel">
            <div className="data-table">
              <div className="table-row table-head invoices-grid">
                <span>Invoice ID</span><span>Patient</span><span>Date</span><span>Amount</span><span>Status</span><span>Details</span>
              </div>
              {rows.map((invoice) => (
                <button className="table-row invoices-grid" type="button" key={invoice.id} aria-pressed={selected.id === invoice.id} onClick={() => setSelectedId(invoice.id)}>
                  <span>INV-{shortId(invoice.id)}</span>
                  <span className="person-cell"><Avatar label={invoice.patientAvatar} size="sm" />{invoice.patientName}</span>
                  <span>{formatDate(invoice.createdAt)}</span>
                  <span>{formatMoney(invoice.totalAmount)}</span>
                  <span><Badge tone={invoice.status}>{invoice.status}</Badge></span>
                  <span>View</span>
                </button>
              ))}
            </div>
          </article>
          {selected && (
            <article className="panel detail-panel invoice-detail">
              <div className="panel-heading"><h3>Invoice Details</h3><Badge tone={selected.status}>{selected.status}</Badge></div>
              <strong>INV-{shortId(selected.id)}</strong>
              <dl className="details-list compact">
                <div><dt>Patient</dt><dd>{selected.patientName}</dd></div>
                <div><dt>Created</dt><dd>{formatDate(selected.createdAt)}</dd></div>
                <div><dt>Paid at</dt><dd>{formatDate(selected.paidAt)}</dd></div>
                <div><dt>Method</dt><dd>{selected.paymentMethod ?? 'Not recorded'}</dd></div>
                <div><dt>Appointment ID</dt><dd>{selected.appointmentId}</dd></div>
              </dl>
              <div className="invoice-total"><span>Total</span><strong>{formatMoney(selected.totalAmount)}</strong></div>
            </article>
          )}
        </section>
      )}
    </>
  );
}
