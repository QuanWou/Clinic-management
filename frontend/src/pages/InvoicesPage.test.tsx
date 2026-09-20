import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { InvoiceResponse } from '../types/domain';
import { filterInvoiceDirectory, invoiceCounts } from '../utils/invoiceDirectory';

vi.mock('../config/integrations.config', () => ({ integrations: { billing: true } }));
import InvoicesPage from './InvoicesPage';

const invoices: InvoiceResponse[] = [
  { id: 'invoice-1', patientId: 'patient-a', appointmentId: 'appointment-1', totalAmount: '100000', currency: 'VND', status: 'UNPAID',
    items: [{ id: 'line-1', sourceType: 'SERVICE', sourceId: 'service-source', serviceId: 'service', serviceCode: 'CONSULT', serviceName: 'Khám tổng quát', priceId: 'price-v1', serviceDate: '2026-09-20', unitPrice: '100000', quantity: 1, lineAmount: '100000', currency: 'VND' }] },
  { id: 'invoice-2', patientId: 'patient-a', appointmentId: 'appointment-2', totalAmount: '200000', currency: 'VND', status: 'PAID' },
  { id: 'invoice-3', patientId: 'patient-a', appointmentId: 'appointment-3', totalAmount: '300000', currency: 'VND', status: 'RECONCILIATION_REQUIRED' }
];
const renderPage = (role: 'PATIENT' | 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR', data: InvoiceResponse[] | null = null) =>
  renderToStaticMarkup(<InvoicesPage role={role} invoices={data} error={null} loading={false} onRefresh={() => {}} />);

describe('real invoice workspace', () => {
  it('does not expose staff patient-search, issuance, transactions or cash collection to patients', () => {
    const html = renderPage('PATIENT', invoices);
    expect(html).toContain('invoice-workspace');
    expect(html).toContain('INV-INVOICE-');
    expect(html).toContain('Khám tổng quát');
    expect(html).toContain('price-v1');
    expect(html).toContain('Online payment is unavailable');
    expect(html).not.toContain('Patient UUID');
    expect(html).not.toContain('Xuất hóa đơn từ dữ liệu thực tế');
    expect(html).not.toContain('Confirm cash receipt');
    expect(html).not.toContain('Giao dịch được ghi nhận');
  });

  it('shows search-first staff UI but no global list or fake totals before API returns', () => {
    for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
      const html = renderPage(role);
      expect(html).toContain('invoice-workspace');
      expect(html).toContain('Patient UUID');
      expect(html).toContain('Xuất hóa đơn');
      expect(html).toContain('Bắt đầu với một mã bệnh nhân');
      expect(html).not.toContain('invoice-metrics');
      expect(html).not.toContain('invoice-table');
      expect(html).not.toContain('Confirm cash receipt');
    }
  });

  it('blocks doctor access even when invoice props are supplied', () => {
    const html = renderPage('DOCTOR', invoices);
    expect(html).toContain('không có quyền');
    expect(html).not.toContain('invoice-workspace');
    expect(html).not.toContain('invoice-1');
  });

  it('filters actual returned invoices and counts only loaded statuses', () => {
    expect(filterInvoiceDirectory(invoices, '', 'ALL')).toEqual(invoices);
    expect(filterInvoiceDirectory(invoices, 'khám tổng quát', 'UNPAID').map((item) => item.id)).toEqual(['invoice-1']);
    expect(filterInvoiceDirectory(invoices, 'appointment-2', 'PAID').map((item) => item.id)).toEqual(['invoice-2']);
    expect(filterInvoiceDirectory(invoices, 'invoice-1', 'PAID')).toEqual([]);
    expect(invoiceCounts(invoices)).toEqual({ total: 3, unpaid: 1, paid: 1, attention: 1 });
    expect(invoiceCounts([])).toEqual({ total: 0, unpaid: 0, paid: 0, attention: 0 });
  });
});
