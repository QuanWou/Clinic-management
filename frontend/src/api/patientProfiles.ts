import {requestJson} from './client';
import {unwrap} from './booking';
import type {Session} from './configuration';
import type {PageResponse} from '../types/contracts';

const base=import.meta.env.VITE_PATIENT_URL??'/s1/patient';
export type PatientProfile={patientId:string;patientCode:string;fullName:string;dateOfBirth:string|null;sex:string|null;phone:string|null;email:string|null;status:'PROVISIONAL'|'VERIFIED';hasAccount:boolean;createdAt:string;updatedAt:string;version:number};
export type ProfileInput={fullName:string;dateOfBirth:string|null;sex:string;phone:string;email:string;expectedVersion:number;reason:string};
export type ProfileChange={id:string;action:'CREATE'|'UPDATE';reason:string;changedFields:string;actorUserId:string;createdAt:string};
export type ProfileDetail={profile:PatientProfile;changes:ProfileChange[]};
const path=(s:Session)=>`${base}/api/clinics/${encodeURIComponent(s.clinic)}/patient-profiles`;
export const list=(s:Session,query='',status='',account='',page=0)=>unwrap(requestJson<PageResponse<PatientProfile>>(path(s)+'?'+new URLSearchParams({query,status,account,page:String(page),size:'20'}),{headers:{Authorization:`Bearer ${s.token}`}}));
export const get=(s:Session,id:string)=>unwrap(requestJson<ProfileDetail>(path(s)+'/'+encodeURIComponent(id),{headers:{Authorization:`Bearer ${s.token}`}}));
export const create=(s:Session,input:ProfileInput,key:string)=>unwrap(requestJson<PatientProfile>(path(s),{method:'POST',headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(input)}));
export const update=(s:Session,id:string,input:ProfileInput)=>unwrap(requestJson<PatientProfile>(path(s)+'/'+encodeURIComponent(id),{method:'PUT',headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'},body:JSON.stringify(input)}));
