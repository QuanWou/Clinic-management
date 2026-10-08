import {requestJson} from './client';
import {unwrap} from './booking';
import type {Session} from './configuration';
import type {PageResponse} from '../types/contracts';

const base=import.meta.env.VITE_AUTH_URL??'/s1/auth';
export type AccountStatus='ACTIVE'|'INACTIVE'|'LOCKED';
export type PatientAccount={id:string;fullName:string;email:string;phone:string|null;accountCode:string|null;status:AccountStatus;createdAt:string;updatedAt:string};
export type AccountInput={fullName:string;email:string;phone:string};
const path=(s:Session)=>`${base}/api/clinic-patient-accounts/${encodeURIComponent(s.clinic)}`;
const write=(s:Session,suffix:string,body:unknown,method='POST')=>unwrap(requestJson<PatientAccount>(path(s)+suffix,{method,headers:{Authorization:`Bearer ${s.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)}));
export const list=(s:Session,query='',status='',page=0)=>unwrap(requestJson<PageResponse<PatientAccount>>(path(s)+'?'+new URLSearchParams({query,page:String(page),size:'20',...(status?{status}:{})}),{headers:{Authorization:`Bearer ${s.token}`}}));
export const create=(s:Session,input:AccountInput&{password:string})=>write(s,'',input);
export const get=(s:Session,id:string)=>unwrap(requestJson<PatientAccount>(path(s)+'/'+encodeURIComponent(id),{headers:{Authorization:`Bearer ${s.token}`}}));
export const update=(s:Session,id:string,input:AccountInput)=>write(s,'/'+encodeURIComponent(id),input,'PUT');
export const setStatus=(s:Session,id:string,status:AccountStatus)=>write(s,'/'+encodeURIComponent(id)+'/status',{status},'PATCH');
export const resetPassword=(s:Session,id:string,password:string)=>write(s,'/'+encodeURIComponent(id)+'/reset-password',{password});
