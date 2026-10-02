import { requestJson } from './client';
import { unwrap } from './booking';
import type { Scope } from './reception';
export type EncounterSummary={date:string;measuredAt:string;checkedIn:number;completed:number;openVisits:number;overnight:number;awaitingResults:number;arrivalPending:number;waitingTickets:number;servingTickets:number};
export type BillingSummary={date:string;measuredAt:string;issuedVnd:number;collectedCashVnd:number;collectedBankVnd:number;collectedPosVnd:number;receiptCount:number;outstandingVnd:number;openShifts:number;submittedShifts:number;approvedShifts:number};
const get=<T,>(base:string,p:string,token:string)=>unwrap(requestJson<T>(base+p,{headers:{Authorization:`Bearer ${token}`}}));
const path=(s:Scope,date:string)=>`/api/v2/clinics/${encodeURIComponent(s.clinic)}/branches/${encodeURIComponent(s.branch)}/operations-summary?date=${encodeURIComponent(date)}`;
export const encounters=(s:Scope,date:string)=>get<EncounterSummary>(import.meta.env.VITE_ENCOUNTER_V2_URL??'/s1/encounter',path(s,date),s.token);
export const billing=(s:Scope,date:string)=>get<BillingSummary>(import.meta.env.VITE_BILLING_V2_URL??'/s1/billing',path(s,date),s.token);
