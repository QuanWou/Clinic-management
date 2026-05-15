import { demoAppointments, demoDoctors, demoInvoices, demoMedicalRecords, demoPatients } from '../data/demoClinicData';
import type { AppointmentResponse, InvoiceResponse, MedicalRecordResponse } from '../types/domain';
import type { UiAppointment, UiInvoice, UiMedicalRecord } from '../types/view';
import { shortId } from './format';

export function getUiAppointments(appointments?: AppointmentResponse[] | null): UiAppointment[] {
  if (!appointments?.length) {
    return demoAppointments;
  }

  return appointments.map((appointment) => {
    const patient = demoPatients.find((item) => item.id === appointment.patientId);
    const doctor = demoDoctors.find((item) => item.id === appointment.doctorId);

    return {
      ...appointment,
      patientName: patient?.name ?? `Patient ${shortId(appointment.patientId)}`,
      doctorName: doctor?.name ?? `Doctor ${shortId(appointment.doctorId)}`,
      department: doctor?.specialtyName ?? 'General Care',
      patientAvatar: patient?.avatar ?? 'PT',
      doctorAvatar: doctor?.avatar ?? 'DR'
    };
  });
}

export function getUiMedicalRecords(records?: MedicalRecordResponse[] | null): UiMedicalRecord[] {
  if (!records?.length) {
    return demoMedicalRecords;
  }

  return records.map((record) => {
    const patient = demoPatients.find((item) => item.id === record.patientId);
    const doctor = demoDoctors.find((item) => item.id === record.doctorId);

    return {
      ...record,
      patientName: patient?.name ?? `Patient ${shortId(record.patientId)}`,
      doctorName: doctor?.name ?? `Doctor ${shortId(record.doctorId)}`,
      recordType: 'Consultation',
      status: 'Completed'
    };
  });
}

export function getUiInvoices(invoices?: InvoiceResponse[] | null): UiInvoice[] {
  if (!invoices?.length) {
    return demoInvoices;
  }

  return invoices.map((invoice) => {
    const patient = demoPatients.find((item) => item.id === invoice.patientId);

    return {
      ...invoice,
      patientName: patient?.name ?? `Patient ${shortId(invoice.patientId)}`,
      patientAvatar: patient?.avatar ?? 'PT'
    };
  });
}

export function findDemoPatient(id?: string) {
  return demoPatients.find((patient) => patient.id === id) ?? demoPatients[0];
}

export function findDemoDoctor(id?: string) {
  return demoDoctors.find((doctor) => doctor.id === id) ?? demoDoctors[0];
}
