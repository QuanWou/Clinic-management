import { requestJson } from './client';
import { unwrap } from './booking';

export type PatientReceipt = { id: string; amountVnd: number; currency: string; method: string; receiptCode: string; createdAt: string; label: string };
export type PatientBill = { id: string; currency: string; subtotalVnd: number; adjustmentVnd: number; paidVnd: number; remainingVnd: number; status: string; issuedAt: string; lines: { name: string; amountVnd: number }[]; receipts: PatientReceipt[] };
const billing = import.meta.env.VITE_BILLING_V2_URL ?? '/s1/billing';
const clinic = import.meta.env.VITE_CLINIC_V2_URL ?? '/s1/clinic';
const medical = import.meta.env.VITE_MEDICAL_V2_URL ?? '/s1/medical';
export type FollowUpPlan = { encounterId: string; clinicId: string; branchId: string; caseVersion: number; proposedDate: string };
export function ownFollowUps(token: string, clinic: string, branch: string) {
 return unwrap(requestJson<FollowUpPlan[]>(`${medical}/api/v2/me/clinics/${encodeURIComponent(clinic)}/branches/${encodeURIComponent(branch)}/follow-up-plans`, { headers: { Authorization: `Bearer ${token}` } }));
}
export type PatientClinic = { clinicId: string; name: string; branches: { branchId: string; name: string; active: boolean }[] };
export function ownClinics(token: string) {
 return unwrap(requestJson<PatientClinic[]>(`${clinic}/api/v2/me/patient-clinics`, { headers: { Authorization: `Bearer ${token}` } }));
}
export function ownBills(token: string, clinic: string, branch: string) {
 return unwrap(requestJson<PatientBill[]>(`${billing}/api/v2/me/clinics/${encodeURIComponent(clinic)}/branches/${encodeURIComponent(branch)}/bills`, { headers: { Authorization: `Bearer ${token}` } }));
}
