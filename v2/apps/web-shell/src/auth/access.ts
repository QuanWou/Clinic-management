import type {CurrentActor,IamContextView} from '../types/contracts';

export type WorkspaceView='overview'|'profile'|'members'|'schedules'|'catalog'|'reception'|'doctor'|'lab'|'billing'|'settings';
export type UserSession={token:string;email:string;actor:CurrentActor;contexts:IamContextView[]};
const admin=['CLINIC_OWNER','CLINIC_MANAGER'];
const grants:Record<WorkspaceView,string[]>={overview:admin,profile:admin,members:admin,schedules:admin,catalog:admin,reception:[...admin,'RECEPTIONIST'],doctor:['DOCTOR'],lab:['LAB'],billing:[...admin,'CASHIER'],settings:[]};
export const roleNames:Record<string,string>={CLINIC_OWNER:'Chủ phòng khám',CLINIC_MANAGER:'Quản lý',RECEPTIONIST:'Lễ tân',DOCTOR:'Bác sĩ',LAB:'Nhân sự lab',CASHIER:'Thu ngân',NURSE:'Điều dưỡng'};
export function clinicContexts(session:UserSession,requested?:string|null){
 const ids=[...new Set(session.contexts.map(c=>c.clinicId))];
 const clinic=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
 return {clinic,contexts:clinic?session.contexts.filter(c=>c.clinicId===clinic):[]};
}
export function canOpen(view:WorkspaceView,contexts:IamContextView[]){return view==='settings'||contexts.some(c=>grants[view].includes(c.role)&&(!['profile','members','schedules','catalog'].includes(view)||c.allBranches));}
export function homeView(contexts:IamContextView[]):WorkspaceView{
 for(const view of ['overview','reception','doctor','lab','billing'] as WorkspaceView[])if(canOpen(view,contexts))return view;
 return 'settings';
}
export function workspaceUrl(session:UserSession,requested?:string|null){const scope=clinicContexts(session,requested);return '/workspace?'+new URLSearchParams({view:homeView(scope.contexts),...(scope.clinic?{clinicId:scope.clinic}:{})});}
