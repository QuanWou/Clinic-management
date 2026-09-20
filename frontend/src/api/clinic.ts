import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type {
  AppointmentResponse, CreateAppointmentRequest, DoctorProfileResponse, InvoiceResponse,
  MedicalRecordResponse, NotificationResponse, PatientProfileResponse, ReceptionBookingRequest,
  ReceptionRescheduleRequest, ReceptionPatientResponse, RegisterWalkInPatientRequest,
  ReceptionVisitResponse, QueueStatus, AdminDoctorResponse, PageResponse, SpecialtyResponse,
  CatalogServiceResponse, MedicineResponse, PriceResponse, PaymentTransactionResponse,
  NotificationPreferenceResponse, NotificationType
} from '../types/domain';

export function getPatientProfile(): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile);
}

export function updatePatientProfile(request: Pick<PatientProfileResponse, 'dob' | 'gender' | 'address' | 'bloodType'>): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile, { method: 'PUT', body: JSON.stringify(request) });
}

export function getDoctorProfile(): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile);
}

export function updateDoctorProfile(request: { biography: string }): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile, { method: 'PUT', body: JSON.stringify(request) });
}

export function getAdminDoctors(page = 0, size = 100): Promise<PageResponse<AdminDoctorResponse>> {
  return apiRequest<PageResponse<AdminDoctorResponse>>(`${apiEndpoints.doctors.admin}?${new URLSearchParams({ page: String(page), size: String(size) })}`);
}

export function getSpecialties(): Promise<SpecialtyResponse[]> {
  return apiRequest<SpecialtyResponse[]>(apiEndpoints.specialties.collection);
}

export function getCatalogServices(): Promise<CatalogServiceResponse[]> {
  return apiRequest<CatalogServiceResponse[]>(apiEndpoints.catalog.services);
}

export function getCatalogMedicines(): Promise<MedicineResponse[]> {
  return apiRequest<MedicineResponse[]>(apiEndpoints.catalog.medicines);
}

export function getServicePrice(id: string, on?: string): Promise<PriceResponse> {
  return apiRequest<PriceResponse>(`${apiEndpoints.catalog.servicePrice(id)}${on ? `?${new URLSearchParams({ on })}` : ''}`);
}

export function searchReceptionPatients(filters: { name?: string; phone?: string }): Promise<ReceptionPatientResponse[]> {
  const query = new URLSearchParams();
  if (filters.name?.trim()) query.set('name', filters.name.trim());
  if (filters.phone?.trim()) query.set('phone', filters.phone.trim());
  return apiRequest<ReceptionPatientResponse[]>(`${apiEndpoints.patients.reception}${query.size ? `?${query}` : ''}`);
}

export function registerReceptionPatient(request: RegisterWalkInPatientRequest): Promise<ReceptionPatientResponse> {
  return apiRequest<ReceptionPatientResponse>(apiEndpoints.patients.reception, { method: 'POST', body: JSON.stringify(request) });
}

export function getReceptionAppointments(filters: { date?: string; doctorId?: string } = {}): Promise<AppointmentResponse[]> {
  const query = new URLSearchParams();
  if (filters.date) query.set('date', filters.date);
  if (filters.doctorId) query.set('doctorId', filters.doctorId);
  return apiRequest<AppointmentResponse[]>(`${apiEndpoints.appointments.receptionBookings}${query.size ? `?${query}` : ''}`);
}

export function bookReceptionAppointment(request: ReceptionBookingRequest): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.receptionBookings, { method: 'POST', body: JSON.stringify(request) });
}

export function rescheduleReceptionAppointment(id: string, request: ReceptionRescheduleRequest): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.receptionReschedule(id), { method: 'PATCH', body: JSON.stringify(request) });
}

export function cancelReceptionAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.receptionCancel(id), { method: 'PATCH' });
}

export function checkInReceptionAppointment(id: string): Promise<ReceptionVisitResponse> {
  return apiRequest<ReceptionVisitResponse>(apiEndpoints.appointments.receptionCheckIn(id), { method: 'POST' });
}

export function getReceptionQueue(filters: { date?: string; doctorId?: string } = {}): Promise<ReceptionVisitResponse[]> {
  const query = new URLSearchParams();
  if (filters.date) query.set('date', filters.date);
  if (filters.doctorId) query.set('doctorId', filters.doctorId);
  return apiRequest<ReceptionVisitResponse[]>(`${apiEndpoints.appointments.receptionQueue}${query.size ? `?${query}` : ''}`);
}

export function updateReceptionQueue(visitId: string, status: QueueStatus): Promise<ReceptionVisitResponse> {
  return apiRequest<ReceptionVisitResponse>(apiEndpoints.appointments.receptionQueueById(visitId), {
    method: 'PATCH', body: JSON.stringify({ status })
  });
}

export function getMyAppointments(): Promise<AppointmentResponse[]> {
  return apiRequest<AppointmentResponse[]>(apiEndpoints.appointments.my);
}

export function createAppointment(request: CreateAppointmentRequest): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.collection, { method: 'POST', body: JSON.stringify(request) });
}

export function getAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.byId(encodeURIComponent(id)));
}

export function cancelAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.cancel(encodeURIComponent(id)), { method: 'PATCH' });
}

export function confirmAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.confirm(encodeURIComponent(id)), { method: 'PATCH' });
}

export function completeAppointment(id: string): Promise<AppointmentResponse> {
  return apiRequest<AppointmentResponse>(apiEndpoints.appointments.complete(encodeURIComponent(id)), { method: 'PATCH' });
}

export function getMyMedicalRecords(): Promise<MedicalRecordResponse[]> {
  return apiRequest<MedicalRecordResponse[]>(apiEndpoints.medicalRecords.my);
}

export function getPatientMedicalRecords(patientId: string): Promise<MedicalRecordResponse[]> {
  return apiRequest<MedicalRecordResponse[]>(apiEndpoints.medicalRecords.byPatient(encodeURIComponent(patientId)));
}

export function getMyInvoices(): Promise<InvoiceResponse[]> {
  return apiRequest<InvoiceResponse[]>(apiEndpoints.invoices.my);
}

export function getPatientInvoices(patientId: string): Promise<InvoiceResponse[]> {
  return apiRequest<InvoiceResponse[]>(apiEndpoints.invoices.byPatient(encodeURIComponent(patientId)));
}

export function confirmCashPayment(id: string, receiptReference: string): Promise<InvoiceResponse> {
  return apiRequest<InvoiceResponse>(apiEndpoints.invoices.cashPayment(id), {
    method: 'POST', body: JSON.stringify({ receiptReference })
  });
}

export function getInvoiceTransactions(id: string): Promise<PaymentTransactionResponse[]> {
  return apiRequest<PaymentTransactionResponse[]>(apiEndpoints.invoices.transactions(id));
}

export function getNotifications(): Promise<NotificationResponse[]> {
  return apiRequest<NotificationResponse[]>(apiEndpoints.notifications.my);
}

export function markNotificationRead(id: string): Promise<NotificationResponse> {
  return apiRequest<NotificationResponse>(apiEndpoints.notifications.markRead(id), { method: 'PATCH' });
}

export function getNotificationPreferences(): Promise<NotificationPreferenceResponse[]> {
  return apiRequest<NotificationPreferenceResponse[]>(apiEndpoints.notifications.preferences);
}

export function updateNotificationPreference(type: NotificationType, enabled: boolean): Promise<NotificationPreferenceResponse> {
  return apiRequest<NotificationPreferenceResponse>(apiEndpoints.notifications.preference(type), {
    method: 'PUT', body: JSON.stringify({ enabled })
  });
}
