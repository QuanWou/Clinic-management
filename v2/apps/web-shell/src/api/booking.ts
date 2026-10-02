import { requestJson } from './client';
import type { ApiResult,ClinicPublicView,PageResponse } from '../types/contracts';

export type Branch = { branchId: string; name: string; address: string; openingHours: string };
export type Clinic = { clinicId: string; name: string; description?: string; locationText?: string; branches: Branch[] };
export type Doctor = { doctorId: string; clinicId: string; branchId: string; displayName: string; specialtyName?: string;professionalTitle?:string };
export type Offering = { offeringId: string; clinicId: string; branchId: string; name: string; amountVnd: number; priceVersionId: string };
export type SearchResult = { clinics: Clinic[]; doctors: Doctor[]; offerings: Offering[] };
export type Profile = { patientId: string; fullName: string; dateOfBirth: string; sex: string; phone: string; email: string; version: number };
export type ProfileInput = Omit<Profile, 'patientId' | 'version'> & { expectedVersion: number };
export type Price = { amountVnd: number; currency: string; priceVersionId: string; effectiveFrom: string; taxPolicyCode?: string; discountPolicyCode?: string };
export type Slot = { slotId: string; startsAt: string; endsAt: string; remaining: number; price: Price };
export type Hold = { holdId: string; state: string; expiresAt: string; price: Price };
export type PendingHold = { hold: Hold & {clinicId: string; branchId: string}; doctorId: string; offeringId: string; startsAt: string; endsAt: string };
export type Appointment = { id: string; appointmentCode: string; status: string; startsAt: string; endsAt: string; clinicId: string; price: Price; priorEncounterId?: string|null; priorBranchId?: string|null };
export type BookingInput = { clinicId: string; branchId: string; offeringId: string; doctorId: string; slotId: string; patientId: string };
export type FollowUpBookingInput = BookingInput & { priorEncounterId: string; priorBranchId: string };
const search = import.meta.env.VITE_SEARCH_V2_URL ?? '/s1/search';
const clinicSource = import.meta.env.VITE_CLINIC_V2_URL ?? '/s1/clinic';
const patient = import.meta.env.VITE_PATIENT_V2_URL ?? '/s1/patient';
const appointment = import.meta.env.VITE_APPOINTMENT_V2_URL ?? '/s1/appointment';
const auth = import.meta.env.VITE_AUTH_URL ?? '/s1/auth';
const notification = import.meta.env.VITE_NOTIFICATION_V2_URL ?? '/s1/notification';
export type Notification = { id: string; message: string; kind: string; created_at: string };
export const getNotifications = (token: string) => unwrap(requestJson<Notification[]>(`${notification}/api/v2/me/notifications`, { headers: { Authorization: `Bearer ${token}` } }));
export const getReminderPreference = (token: string) => unwrap(requestJson<{remindersEnabled: boolean}>(`${notification}/api/v2/me/notification-preferences`, { headers: { Authorization: `Bearer ${token}` } }));
export const setReminderPreference = (token: string, remindersEnabled: boolean) => write<{remindersEnabled: boolean}>(`${notification}/api/v2/me/notification-preferences`, token, { remindersEnabled }, undefined, 'PUT');
export class RequestError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = 'RequestError'; }
}
export async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok || result.data === undefined) throw new RequestError(result.message ?? 'Dịch vụ trả về dữ liệu không hợp lệ.', result.status);
  return result.data;
}
function write<T>(url: string, token: string, body: unknown, key?: string, method = 'POST') {
  return unwrap(requestJson<T>(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) }));
}
/** Bind this website to one published clinic; never pick the first of several tenants. */
export async function getSiteClinic(configuredId=(import.meta.env.VITE_PUBLIC_CLINIC_ID??'').trim()):Promise<Clinic>{
 let source:ClinicPublicView;
 if(configuredId)source=await unwrap(requestJson<ClinicPublicView>(`${clinicSource}/api/v2/public/clinics/by-id/${encodeURIComponent(configuredId)}`));
 else{
  const page=await unwrap(requestJson<PageResponse<ClinicPublicView>>(`${clinicSource}/api/v2/public/clinics?page=0&size=2`));
  if(page.totalElements!==1||page.content.length!==1)throw new RequestError('Trang đặt lịch hiện chưa sẵn sàng. Vui lòng liên hệ phòng khám hoặc thử lại sau.',503);
  source=page.content[0];
 }
 return {clinicId:source.id,name:source.name,description:source.publicDescription,branches:source.branches.filter(b=>b.active!==false).map(b=>({branchId:b.id,name:b.name,address:b.address,openingHours:b.openingHours}))};
}
export const getClinic = (id: string) => unwrap(requestJson<Clinic>(`${search}/api/v2/public/clinics/${encodeURIComponent(id)}`));
export const getDoctors = (id: string, branch?: string) => unwrap(requestJson<Doctor[]>(`${search}/api/v2/public/clinics/${id}/doctors${branch?'?branchId='+encodeURIComponent(branch):''}`));
export const getOfferings = (id: string, branch?: string) => unwrap(requestJson<Offering[]>(`${search}/api/v2/public/clinics/${id}/offerings${branch?'?branchId='+encodeURIComponent(branch):''}`));
export const getSlots = (query: Record<string, string>) => unwrap(requestJson<Slot[]>(`${appointment}/api/v2/public/availability?${new URLSearchParams(query)}`));
export const getProfile = (token: string) => unwrap(requestJson<Profile>(`${patient}/api/v2/me/patient-profile`, { headers: { Authorization: `Bearer ${token}` } }));
export const getPendingHolds = (token: string, clinicId: string, patientId: string) => unwrap(requestJson<PendingHold[]>(`${appointment}/api/v2/me/appointment-holds?${new URLSearchParams({clinicId,patientId})}`,{headers:{Authorization:`Bearer ${token}`}}));
export const saveProfile = (token: string, input: ProfileInput) => write<Profile>(`${patient}/api/v2/me/patient-profile`, token, input, undefined, 'PUT');
export const holdSlot = (token: string, input: BookingInput, key: string) => write<Hold>(`${appointment}/api/v2/appointments/holds`, token, input, key);
export const holdFollowUp = (token: string, input: FollowUpBookingInput, key: string) => write<Hold>(`${appointment}/api/v2/appointments/follow-up-holds`, token, input, key);
export const confirmHold = (token: string, clinicId: string, patientId: string, holdId: string, key: string) => write<Appointment>(`${appointment}/api/v2/appointments`, token, { clinicId, patientId, holdId }, key);
export const myAppointments = (token: string, clinicId: string, patientId: string) => unwrap(requestJson<Appointment[]>(`${appointment}/api/v2/me/appointments?${new URLSearchParams({ clinicId, patientId })}`, { headers: { Authorization: `Bearer ${token}` } }));
export const cancelAppointment = (token: string, a: Appointment, patientId: string) => write<Appointment>(`${appointment}/api/v2/appointments/${a.id}/cancel`, token, { clinicId: a.clinicId, patientId, reason: 'Patient requested cancellation' });
export const rescheduleAppointment = (token: string, a: Appointment, patientId: string, newHoldId: string) => write<Appointment>(`${appointment}/api/v2/appointments/${a.id}/reschedule`, token, { clinicId: a.clinicId, patientId, newHoldId, reason: 'Patient requested reschedule' });
export const signIn = (email: string, password: string, fullName?: string) => write<{ data: { accessToken: string } }>(`${auth}/api/auth/${fullName ? 'register' : 'login'}`, '', { email, password, ...(fullName ? { fullName } : {}) });
