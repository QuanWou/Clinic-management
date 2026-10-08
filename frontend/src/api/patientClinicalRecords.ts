import {requestJson} from './client';
import {unwrap,RequestError} from './booking';
import type {Scope} from './configuration';
import type {PageResponse} from '../types/contracts';
import type {Note} from './medical';
const encounter=import.meta.env.VITE_ENCOUNTER_URL??'/s1/encounter';
const medical=import.meta.env.VITE_MEDICAL_URL??'/s1/medical';
const path=(s:Scope,patient:string)=>`/api/clinics/${encodeURIComponent(s.clinic)}/branches/${encodeURIComponent(s.branch)}/admin/patients/${encodeURIComponent(patient)}/visits`;
export type PatientVisit={encounterId:string;visitCode:string|null;doctorId:string;status:string;createdAt:string;checkedInAt:string|null;completedAt:string|null;serviceName:string|null;walkIn:boolean};
export type ClinicalOrder={id:string;name:string;state:string;orderedAt:string;result:string|null;resultAt:string|null;reviewedAt:string|null};
export type ClinicalRecord={encounterId:string;status:'OPEN'|'VALIDATED';documentVersion:number;content:Note|null;savedAt:string|null;authorUserId:string|null;orders:ClinicalOrder[]};
export const visits=(s:Scope,patient:string,page=0)=>unwrap(requestJson<PageResponse<PatientVisit>>(encounter+path(s,patient)+'?'+new URLSearchParams({page:String(page),size:'20'}),{headers:{Authorization:`Bearer ${s.token}`}}));
export async function record(s:Scope,patient:string,id:string){
 try{return await unwrap(requestJson<ClinicalRecord>(medical+path(s,patient)+'/'+encodeURIComponent(id)+'/medical-record',{headers:{Authorization:`Bearer ${s.token}`}}));}
 catch(e){if(e instanceof RequestError&&e.status===404)return null;throw e;}
}
