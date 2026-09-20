import type { AppointmentResponse, CurrentUser, DoctorProfileResponse, InvoiceResponse, MedicalRecordResponse, PatientProfileResponse } from '../types/domain';
import type { UiAppointment, UiInvoice, UiMedicalRecord } from '../types/view';
import { shortId } from './format';

export type Lookup = {
  user?: CurrentUser | null;
  patients?: PatientProfileResponse[] | null;
  doctors?: DoctorProfileResponse[] | null;
};

function patientName(patientId: string, lookup: Lookup): string {
  const profile = lookup.patients?.find((patient) => patient.id === patientId);
  return profile && lookup.user?.id === profile.userId
    ? lookup.user.fullName ?? lookup.user.email
    : `Patient ${shortId(patientId)}`;
}

function doctorName(doctorId: string, lookup: Lookup): string {
  const profile = lookup.doctors?.find((doctor) => doctor.id === doctorId);
  return profile && lookup.user?.id === profile.userId
    ? lookup.user.fullName ?? lookup.user.email
    : `Doctor ${shortId(doctorId)}`;
}

export function getUiAppointments(appointments?: AppointmentResponse[] | null, lookup: Lookup = {}): UiAppointment[] {
  return (appointments ?? []).map((appointment) => ({
      ...appointment,
      patientName: patientName(appointment.patientId, lookup),
      doctorName: doctorName(appointment.doctorId, lookup),
      department: lookup.doctors?.find((doctor) => doctor.id === appointment.doctorId)?.specialtyName ?? 'Not available',
      patientAvatar: 'PT',
      doctorAvatar: 'DR'
    }));
}

export function getUiMedicalRecords(records?: MedicalRecordResponse[] | null, lookup: Lookup = {}): UiMedicalRecord[] {
  return (records ?? []).map((record) => ({
      ...record,
      patientName: patientName(record.patientId, lookup),
      doctorName: doctorName(record.doctorId, lookup),
      recordType: 'Medical record',
      status: 'Completed'
    }));
}

export function getUiInvoices(invoices?: InvoiceResponse[] | null, lookup: Lookup = {}): UiInvoice[] {
  return (invoices ?? []).map((invoice) => ({
      ...invoice,
      patientName: patientName(invoice.patientId, lookup),
      patientAvatar: 'PT'
    }));
}
