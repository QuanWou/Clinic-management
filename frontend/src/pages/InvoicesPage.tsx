import { MoreHorizontal, Search } from 'lucide-react';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import type { InvoiceResponse } from '../types/domain';
import { formatDate, formatMoney, shortId } from '../utils/format';
import { getUiInvoices } from '../utils/uiData';

type InvoicesPageProps = {
  invoices: InvoiceResponse[] | null | undefined;
};

export default function InvoicesPage({ invoices }: InvoicesPageProps) {
  const rows = getUiInvoices(invoices);
  const selected = rows[0];

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Manage invoices and payments."
        actions={<div className="inline-search"><Search size={16} /><input aria-label="Search invoices" placeholder="Search invoice..." /></div>}
      />

      <section className="split-page">
        <article className="panel table-panel">
          <div className="data-table">
            <div className="table-row table-head invoices-grid">
              <span>Invoice ID</span>
              <span>Patient</span>
              <span>Date</span>
              <span>Amount</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {rows.map((invoice) => (
              <div className="table-row invoices-grid" key={invoice.id}>
                <span>INV-{shortId(invoice.id)}</span>
                <span className="person-cell"><Avatar label={invoice.patientAvatar} size="sm" />{invoice.patientName}</span>
                <span>{formatDate(invoice.createdAt)}</span>
                <span>{formatMoney(invoice.totalAmount)}</span>
                <span><Badge tone={invoice.status}>{invoice.status}</Badge></span>
                <span><MoreHorizontal size={17} /></span>
              </div>
            ))}
          </div>
        </article>

        {selected && (
          <article className="panel detail-panel invoice-detail">
            <div className="panel-heading">
              <h3>Invoice Details</h3>
              <Badge tone={selected.status}>{selected.status}</Badge>
            </div>
            <strong>INV-{shortId(selected.id)}</strong>
            <dl className="details-list compact">
              <div><dt>Patient</dt><dd>{selected.patientName}</dd></div>
              <div><dt>Date</dt><dd>{formatDate(selected.createdAt)}</dd></div>
              <div><dt>Due Date</dt><dd>December 12, 2024</dd></div>
              <div><dt>Method</dt><dd>{selected.paymentMethod ?? 'Not paid'}</dd></div>
            </dl>
            <div className="invoice-total">
              <span>Total</span>
              <strong>{formatMoney(selected.totalAmount)}</strong>
            </div>
          </article>
        )}
      </section>
    </>
  );
}
