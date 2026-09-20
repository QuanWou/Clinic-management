import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type {
  AppointmentResponse,
  DoctorSchedule,
  DoctorProfileResponse,
  InvoiceResponse,
  MedicalRecordResponse,
  NotificationResponse,
  PatientProfileResponse,
  SpecialtyResponse,
  UpdateDoctorProfileRequest,
  UpdateDoctorSchedulesRequest,
  UpdatePatientProfileRequest
} from '../types/domain';

export function getPatientProfile(): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile);
}

export function updatePatientProfile(request: UpdatePatientProfileRequest): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile, {
    method: 'PUT',
    body: JSON.stringify(request)
  });
}

export function getDoctorProfile(): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile);
}

export function updateDoctorProfile(request: UpdateDoctorProfileRequest): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile, {
    method: 'PUT',
    body: JSON.stringify(request)
  });
}

export function getDoctors(specialtyId?: string): Promise<DoctorProfileResponse[]> {
  const query = specialtyId ? `?specialtyId=${encodeURIComponent(specialtyId)}` : '';
  return apiRequest<DoctorProfileResponse[]>(`${apiEndpoints.doctors.collection}${query}`);
}

export function getSpecialties(): Promise<SpecialtyResponse[]> {
  return apiRequest<SpecialtyResponse[]>(apiEndpoints.specialties.collection);
}

export function getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]> {
  return apiRequest<DoctorSchedule[]>(apiEndpoints.doctors.schedules(doctorId));
}

export function getMyDoctorSchedules(): Promise<DoctorSchedule[]> {
  return apiRequest<DoctorSchedule[]>(apiEndpoints.doctors.profileSchedules);
}

export function updateMyDoctorSchedules(request: UpdateDoctorSchedulesRequest): Promise<DoctorSchedule[]> {
  return apiRequest<DoctorSchedule[]>(apiEndpoints.doctors.profileSchedules, {
    method: 'PUT',
    body: JSON.stringify(request)
  });
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
