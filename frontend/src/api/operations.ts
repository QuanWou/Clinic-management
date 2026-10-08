import { requestJson } from './client';
import { unwrap } from './booking';
import type { Scope } from './reception';

export type EncounterSummary={date:string;measuredAt:string;checkedIn:number;completed:number;openVisits:number;overnight:number;awaitingResults:number;arrivalPending:number;waitingTickets:number;servingTickets:number};
export type BillingSummary={date:string;measuredAt:string;issuedVnd:number;collectedCashVnd:number;collectedBankVnd:number;collectedPosVnd:number;collectedOnlineVnd?:number;paymentReviews?:number;collectedSandboxVnd?:number;receiptCount:number;outstandingVnd:number;openShifts:number;submittedShifts:number;approvedShifts:number};
export type OperationalException={id:string;appointmentId:string;type:string;state:string;notificationMode:string|null};

const get=<T,>(base:string,p:string,token:string)=>unwrap(requestJson<T>(base+p,{headers:{Authorization:`Bearer ${token}`}}));
const summaryPath=(s:Scope,date:string)=>`/api/clinics/${encodeURIComponent(s.clinic)}/branches/${encodeURIComponent(s.branch)}/operations-summary?date=${encodeURIComponent(date)}`;
const branchPath=(s:Scope)=>`/api/clinics/${encodeURIComponent(s.clinic)}/branches/${encodeURIComponent(s.branch)}`;

export const encounters=(s:Scope,date:string)=>get<EncounterSummary>(import.meta.env.VITE_ENCOUNTER_URL??'/s1/encounter',summaryPath(s,date),s.token);
export const billing=(s:Scope,date:string)=>get<BillingSummary>(import.meta.env.VITE_BILLING_URL??'/s1/billing',summaryPath(s,date),s.token);
export const exceptions=(s:Scope)=>get<OperationalException[]>(import.meta.env.VITE_ENCOUNTER_URL??'/s1/encounter',branchPath(s)+'/reception/exceptions',s.token);
