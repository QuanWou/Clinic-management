import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type {
  AppointmentResponse, CreateAppointmentRequest, DoctorProfileResponse, InvoiceResponse,
  MedicalRecordResponse, NotificationResponse, PatientProfileResponse, ReceptionBookingRequest,
  ReceptionRescheduleRequest, ReceptionPatientResponse, RegisterWalkInPatientRequest,
  ReceptionVisitResponse, QueueStatus, AdminDoctorResponse, PageResponse, SpecialtyResponse,
  CatalogServiceResponse, MedicineResponse, PriceResponse, PaymentTransactionResponse,
  NotificationPreferenceResponse, NotificationType, ReceptionHistoryResponse,
  PerformedServicesResponse, LabBillableItemsResponse, LabBillingStatusResponse, LabOrderResponse, AppointmentAvailabilityResponse,
  CreateAdminDoctorRequest, UpdateAdminDoctorRequest, AdminDoctorSchedule, DoctorSchedule, AdminUserResponse
} from '../types/domain';

/** Resolve a doctor's linked account by userId. Identity authorizes ADMIN on this route. */
export function getAdminUser(id: string): Promise<AdminUserResponse> {
  return apiRequest<AdminUserResponse>(apiEndpoints.users.adminById(id));
}

export function getPatientProfile(): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile);
}

export function updatePatientProfile(request: Pick<PatientProfileResponse, 'dob' | 'gender' | 'address' | 'bloodType'>): Promise<PatientProfileResponse> {
  return apiRequest<PatientProfileResponse>(apiEndpoints.patients.profile, { method: 'PUT', body: JSON.stringify(request) });
}

export function getDoctorProfile(): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile);
}

/** This endpoint is scoped to the authenticated doctor's own schedule. */
export function getMyDoctorSchedules(): Promise<DoctorSchedule[]> {
  return apiRequest<DoctorSchedule[]>(apiEndpoints.doctors.mySchedules);
}

/** Active public directory: available to authenticated patients and receptionists. */
export async function getDoctors(): Promise<DoctorProfileResponse[]> {
  // Identity returns only names + account IDs of active doctors. Never call its
  // administrator endpoint with a receptionist or patient token.
  const [doctors, accounts] = await Promise.all([
    apiRequest<DoctorProfileResponse[]>(apiEndpoints.doctors.collection),
    apiRequest<Array<{ id: string; fullName: string }>>(apiEndpoints.users.doctorNames)
  ]);
  if (!Array.isArray(doctors) || !Array.isArray(accounts)
    || doctors.some((doctor) => !doctor?.id || !doctor.userId)
    || accounts.some((account) => !account?.id || typeof account.fullName !== 'string')) {
    throw new Error('Danh sách bác sĩ hoặc họ tên từ Identity không hợp lệ.');
  }
  const names = new Map(accounts.filter((account) => account.fullName.trim())
    .map((account) => [account.id, account.fullName.trim()]));
  return doctors.map((doctor) => ({ ...doctor, fullName: names.get(doctor.userId) }));
}

/** Weekly shifts are read-only and do not prove that an appointment slot is available. */
export function getDoctorSchedules(doctorId: string): Promise<DoctorSchedule[]> {
  return apiRequest<DoctorSchedule[]>(apiEndpoints.doctors.schedules(doctorId));
}

export function updateDoctorProfile(request: { biography: string }): Promise<DoctorProfileResponse> {
  return apiRequest<DoctorProfileResponse>(apiEndpoints.doctors.profile, { method: 'PUT', body: JSON.stringify(request) });
}

export function getAdminDoctors(page = 0, size = 100): Promise<PageResponse<AdminDoctorResponse>> {
  return apiRequest<PageResponse<AdminDoctorResponse>>(`${apiEndpoints.doctors.admin}?${new URLSearchParams({ page: String(page), size: String(size) })}`);
}

export function getAdminDoctor(id: string): Promise<AdminDoctorResponse> {
  return apiRequest<AdminDoctorResponse>(apiEndpoints.doctors.adminById(id));
}

export function getAdminDoctorSchedules(id: string): Promise<AdminDoctorSchedule[]> {
  return apiRequest<AdminDoctorSchedule[]>(apiEndpoints.doctors.adminSchedules(id));
}

export function createAdminDoctor(request: CreateAdminDoctorRequest): Promise<AdminDoctorResponse> {
  return apiRequest<AdminDoctorResponse>(apiEndpoints.doctors.admin, { method: 'POST', body: JSON.stringify(request) });
}

export function updateAdminDoctor(id: string, request: UpdateAdminDoctorRequest): Promise<AdminDoctorResponse> {
  return apiRequest<AdminDoctorResponse>(apiEndpoints.doctors.adminById(id), { method: 'PUT', body: JSON.stringify(request) });
}

export function deactivateAdminDoctor(id: string): Promise<AdminDoctorResponse> {
  return apiRequest<AdminDoctorResponse>(apiEndpoints.doctors.adminById(id), { method: 'DELETE' });
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

/** Admin listing includes inactive entries; public catalog contains active entries only. */
export function getAdminCatalogServices(): Promise<CatalogServiceResponse[]> {
  return apiRequest<CatalogServiceResponse[]>(apiEndpoints.catalog.adminServices);
}

export function getAdminCatalogMedicines(): Promise<MedicineResponse[]> {
  return apiRequest<MedicineResponse[]>(apiEndpoints.catalog.adminMedicines);
}

export function getServicePriceHistory(id: string): Promise<PriceResponse[]> {
  return apiRequest<PriceResponse[]>(apiEndpoints.catalog.servicePrices(id));
}

export function getServicePrice(id: string, on?: string): Promise<PriceResponse> {
  return apiRequest<PriceResponse>(`${apiEndpoints.catalog.servicePrice(id)}${on ? `?${new URLSearchParams({ on })}` : ''}`);
}

export function createCatalogService(request: { code: string; name: string; description: string; active: true }): Promise<CatalogServiceResponse> {
  return apiRequest<CatalogServiceResponse>(apiEndpoints.catalog.adminServices, { method: 'POST', body: JSON.stringify(request) });
}

export function createCatalogMedicine(request: { code: string; name: string; unit: string; description: string; active: true }): Promise<MedicineResponse> {
  return apiRequest<MedicineResponse>(apiEndpoints.catalog.adminMedicines, { method: 'POST', body: JSON.stringify(request) });
}

export function publishCatalogPrice(serviceId: string, request: { amount: string; currency: 'VND'; effectiveFrom: string; effectiveUntil: string | null }): Promise<PriceResponse> {
  return apiRequest<PriceResponse>(apiEndpoints.catalog.adminServicePrices(serviceId), { method: 'POST', body: JSON.stringify(request) });
}

export function deactivateCatalogService(serviceId: string): Promise<CatalogServiceResponse> {
  return apiRequest<CatalogServiceResponse>(apiEndpoints.catalog.adminService(serviceId), { method: 'DELETE' });
}

export function deactivateCatalogMedicine(medicineId: string): Promise<MedicineResponse> {
  return apiRequest<MedicineResponse>(apiEndpoints.catalog.adminMedicine(medicineId), { method: 'DELETE' });
}

export function searchReceptionPatients(filters: { name?: string; phone?: string }): Promise<ReceptionPatientResponse[]> {
  const query = new URLSearchParams();
  if (filters.name?.trim()) query.set('name', filters.name.trim());
  if (filters.phone?.trim()) query.set('phone', filters.phone.trim());
  return apiRequest<ReceptionPatientResponse[]>(`${apiEndpoints.patients.reception}${query.size ? `?${query}` : ''}`);
}

/** Admin/reception-only, bounded patient directory with names and server pagination. */
export function getReceptionPatientDirectory(page = 0, size = 20): Promise<PageResponse<ReceptionPatientResponse>> {
  return apiRequest<PageResponse<ReceptionPatientResponse>>(
    `${apiEndpoints.patients.receptionList}?${new URLSearchParams({ page: String(page), size: String(size) })}`
  );
}

/** Role-scoped receptionist/admin lookup for the exact patient referenced by a selected appointment. */
export function getReceptionPatientById(id: string): Promise<ReceptionPatientResponse> {
  return apiRequest<ReceptionPatientResponse>(apiEndpoints.patients.receptionById(id));
}

/** Staff-only lookup: the visible BN code resolves to an internal UUID before billing lookup. */
export function getReceptionPatientByCode(code: string): Promise<ReceptionPatientResponse> {
  return apiRequest<ReceptionPatientResponse>(apiEndpoints.patients.receptionByCode(code));
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

export function getReceptionHistory(from: string, to: string): Promise<ReceptionHistoryResponse> {
  return apiRequest<ReceptionHistoryResponse>(`${apiEndpoints.appointments.receptionHistory}?${new URLSearchParams({ from, to })}`);
}

export function getAppointmentAvailability(doctorId: string, date: string, startTime: string, endTime: string): Promise<AppointmentAvailabilityResponse> {
  return apiRequest<AppointmentAvailabilityResponse>(`${apiEndpoints.appointments.availability(doctorId)}?${new URLSearchParams({ date, startTime, endTime })}`);
}

export function getPerformedServices(appointmentId: string): Promise<PerformedServicesResponse> {
  return apiRequest<PerformedServicesResponse>(apiEndpoints.appointments.performedServices(appointmentId));
}

export function addPerformedService(appointmentId: string, request: { serviceId: string; quantity: number; serviceDate: string }): Promise<PerformedServicesResponse> {
  return apiRequest<PerformedServicesResponse>(apiEndpoints.appointments.performedServices(appointmentId),
    { method: 'POST', body: JSON.stringify(request) });
}

export function removePerformedService(appointmentId: string, itemId: string): Promise<PerformedServicesResponse> {
  return apiRequest<PerformedServicesResponse>(apiEndpoints.appointments.performedServiceItem(appointmentId, itemId), { method: 'DELETE' });
}

export function finalizePerformedServices(appointmentId: string): Promise<PerformedServicesResponse> {
  return apiRequest<PerformedServicesResponse>(apiEndpoints.appointments.performedServicesFinalize(appointmentId), { method: 'POST' });
}

export function getLabBillableItems(appointmentId: string): Promise<LabBillableItemsResponse> {
  return apiRequest<LabBillableItemsResponse>(apiEndpoints.medicalRecords.labBillable(appointmentId));
}

export function finalizeLabBillableItems(appointmentId: string): Promise<LabBillableItemsResponse> {
  return apiRequest<LabBillableItemsResponse>(apiEndpoints.medicalRecords.labBillableFinalize(appointmentId), { method: 'POST' });
}

export function createMedicalRecord(request: { appointmentId: string; symptoms: string; diagnosis: string; notes: string; prescriptionItems: [] }): Promise<MedicalRecordResponse> {
  return apiRequest<MedicalRecordResponse>(apiEndpoints.medicalRecords.collection, { method: 'POST', body: JSON.stringify(request) });
}

export function getLabOrders(recordId: string): Promise<LabOrderResponse[]> {
  return apiRequest<LabOrderResponse[]>(apiEndpoints.medicalRecords.labOrders(recordId));
}

/** Status-only lookup scoped to the authenticated treating doctor; billing details are not exposed. */
export function getDoctorLabBillingStatus(recordId: string): Promise<LabBillingStatusResponse> {
  return apiRequest<LabBillingStatusResponse>(apiEndpoints.medicalRecords.labBillingStatus(recordId));
}

export function createLabOrder(recordId: string, request: { testCode: string; testName: string; serviceId: string; performedOn: string }): Promise<LabOrderResponse> {
  return apiRequest<LabOrderResponse>(apiEndpoints.medicalRecords.labOrders(recordId), { method: 'POST', body: JSON.stringify(request) });
}

export function changeLabOrder(orderId: string, action: 'sample' | 'processing' | 'result' | 'release', body?: object): Promise<LabOrderResponse> {
  return apiRequest<LabOrderResponse>(apiEndpoints.medicalRecords.labOrderStatus(orderId, action),
    { method: 'PATCH', ...(body ? { body: JSON.stringify(body) } : {}) });
}

export function createInvoice(appointmentId: string): Promise<InvoiceResponse> {
  return apiRequest<InvoiceResponse>(apiEndpoints.invoices.collection,
    { method: 'POST', body: JSON.stringify({ appointmentId }) });
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

/** Server-paginated records owned by the currently authenticated doctor only. */
export function getMyDoctorMedicalRecords(page = 0, size = 8): Promise<PageResponse<MedicalRecordResponse>> {
  return apiRequest<PageResponse<MedicalRecordResponse>>(
    `${apiEndpoints.medicalRecords.doctorMy}?${new URLSearchParams({ page: String(page), size: String(size) })}`);
}

/** Resolve public BN number within the treating doctor's authorized records. */
export function getDoctorPatientMedicalRecordsByCode(code: string): Promise<MedicalRecordResponse[]> {
  return apiRequest<MedicalRecordResponse[]>(apiEndpoints.medicalRecords.doctorPatientByCode(code));
}

export function getPatientMedicalRecords(patientId: string): Promise<MedicalRecordResponse[]> {
  return apiRequest<MedicalRecordResponse[]>(apiEndpoints.medicalRecords.byPatient(encodeURIComponent(patientId)));
}

export function getMyInvoices(): Promise<InvoiceResponse[]> {
  return apiRequest<InvoiceResponse[]>(apiEndpoints.invoices.my);
}

/** ADMIN/RECEPTIONIST only. Actual invoices, most recent first, bounded at the server. */
export function getStaffInvoiceDirectory(page = 0, size = 20): Promise<PageResponse<InvoiceResponse>> {
  return apiRequest<PageResponse<InvoiceResponse>>(
    `${apiEndpoints.invoices.staff}?${new URLSearchParams({ page: String(page), size: String(size) })}`
  );
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
