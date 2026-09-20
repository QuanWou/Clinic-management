import type { AppointmentResponse, InvoiceResponse, MedicalRecordResponse } from '../types/domain';
import type { UiAppointment, UiInvoice, UiMedicalRecord } from '../types/view';
import { shortId } from './format';

// UI labels derived only from API identifiers; no demo records or guessed personal details.
export function getUiAppointments(appointments?: AppointmentResponse[] | null): UiAppointment[] {
  return (appointments ?? []).map((appointment) => ({
    ...appointment,
    patientName: `Patient ${shortId(appointment.patientId)}`,
    doctorName: `Doctor ${shortId(appointment.doctorId)}`,
    department: 'Not available',
    patientAvatar: 'PT',
    doctorAvatar: 'DR'
  }));
}

export function getUiMedicalRecords(records?: MedicalRecordResponse[] | null): UiMedicalRecord[] {
  return (records ?? []).map((record) => ({
    ...record,
    patientName: `Patient ${shortId(record.patientId)}`,
    doctorName: `Doctor ${shortId(record.doctorId)}`,
    recordType: 'Medical record',
    status: 'Recorded'
  }));
}

export function getUiInvoices(invoices?: InvoiceResponse[] | null): UiInvoice[] {
  return (invoices ?? []).map((invoice) => ({
    ...invoice,
    patientName: `Patient ${shortId(invoice.patientId)}`,
    patientAvatar: 'PT'
  }));
}
