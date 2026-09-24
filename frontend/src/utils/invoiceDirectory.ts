import type { InvoiceResponse, InvoiceStatus } from '../types/domain';

export type InvoiceFilter = 'ALL' | InvoiceStatus;

/** Only filters invoices already returned for the authenticated patient / searched patient. */
export function filterInvoiceDirectory(invoices: InvoiceResponse[], text: string, status: InvoiceFilter): InvoiceResponse[] {
  const term = text.trim().toLocaleLowerCase('vi-VN');
  return invoices.filter((invoice) => {
    if (status !== 'ALL' && invoice.status !== status) return false;
    return !term || [invoice.id, invoice.appointmentId, invoice.patientId,
      ...(invoice.items ?? []).flatMap((item) => [item.serviceCode, item.serviceName])]
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(term));
  });
}

export function invoiceCounts(invoices: InvoiceResponse[]) {
  return {
    total: invoices.length,
    unpaid: invoices.filter((item) => item.status === 'UNPAID').length,
    paid: invoices.filter((item) => item.status === 'PAID').length,
    attention: invoices.filter((item) => item.status === 'RECONCILIATION_REQUIRED').length
  };
}

/** Staff directory rows have already been paged by the server; do not paginate them again. */
export function paginateInvoices(invoices: InvoiceResponse[], requestedPage: number, size: number, serverPaged: boolean) {
  const pages = serverPaged ? 1 : Math.max(1, Math.ceil(invoices.length / size));
  const currentPage = Math.min(Math.max(1, requestedPage), pages);
  return {
    pages,
    currentPage,
    visible: serverPaged ? invoices : invoices.slice((currentPage - 1) * size, currentPage * size)
  };
}
