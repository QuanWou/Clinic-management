import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type {
  AppointmentResponse,
  DoctorProfileResponse,
  InvoiceResponse,
  MedicalRecordResponse,
  NotificationResponse,
  PatientProfileResponse
} from '../types/domain';

export function getPatientProfile(): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile);
}

export function getDoctorProfile(): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile);
}

export function getMyAppointments(): Promise<AppointmentResponse[]> {
  return apiRequest<AppointmentResponse[]>(apiEndpoints.appointments.my);
}

export function getAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.byId(id));
}

export function cancelAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.cancel(id), { method: 'PATCH' });
}

export function confirmAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.confirm(id), { method: 'PATCH' });
}

export function completeAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.complete(id), { method: 'PATCH' });
}

export function getMyMedicalRecords(): Promise<MedicalRecordResponse[]> {
  return apiRequest<MedicalRecordResponse[]>(apiEndpoints.medicalRecords.my);
}

export function getMyInvoices(): Promise<InvoiceResponse[]> {
  return apiRequest<InvoiceResponse[]>(apiEndpoints.invoices.my);
}

export function getNotifications(): Promise<NotificationResponse[]> {
  return apiRequest<NotificationResponse[]>(apiEndpoints.notifications.collection);
}
