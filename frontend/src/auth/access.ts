import type {CurrentActor,IamContextView} from '../types/contracts';

export type WorkspaceView='overview'|'profile'|'members'|'schedules'|'catalog'|'reception'|'doctor'|'lab'|'billing'|'system'|'settings';
export type UserSession={token:string;email:string;displayName?:string;actor:CurrentActor;contexts:IamContextView[]};
const admin=['ADMIN'];
const grants:Record<WorkspaceView,string[]>={overview:admin,profile:admin,members:admin,schedules:admin,catalog:admin,reception:[...admin,'STAFF'],doctor:['DOCTOR'],lab:['DOCTOR'],billing:[...admin,'STAFF'],system:admin,settings:[]};
export const roleNames:Record<string,string>={ADMIN:'Quản trị',STAFF:'Lễ tân kiêm thu ngân',DOCTOR:'Bác sĩ',PATIENT:'Bệnh nhân'};
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
