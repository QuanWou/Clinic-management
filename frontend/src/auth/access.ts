import type {CurrentActor,IamContextView} from '../types/contracts';

export type WorkspaceView=
 'overview'|'profile'|'members'|'customers'|'patients'|'schedules'|'services'|'prices'|'catalog'|
 'operations'|'finance'|'exceptions'|'permissions'|'audit'|
 'reception'|'doctor'|'lab'|'billing'|'system'|'settings';

export type UserSession={token:string;email:string;displayName?:string;actor:CurrentActor;contexts:IamContextView[]};

const admin=['ADMIN'];
const clinicWide=new Set<WorkspaceView>(['profile','members','customers','patients','schedules','services','prices','catalog','permissions','audit']);
const grants:Record<WorkspaceView,string[]>={
 overview:admin,
 profile:admin,
 members:admin,
 customers:admin,
 patients:admin,
 schedules:admin,
 services:admin,
 prices:admin,
 catalog:admin,
 operations:admin,
 finance:admin,
 exceptions:admin,
 permissions:admin,
 audit:admin,
 reception:['STAFF'],
 doctor:['DOCTOR'],
 lab:['DOCTOR'],
 billing:['STAFF'],
 system:[],
 settings:[]
};

export const roleNames:Record<string,string>={
 ADMIN:'Quản trị phòng khám',
 STAFF:'Lễ tân / Thu ngân',
 DOCTOR:'Bác sĩ',
 PATIENT:'Bệnh nhân'
};

export function clinicContexts(session:UserSession,requested?:string|null){
 const ids=[...new Set(session.contexts.map(c=>c.clinicId))];
 const clinic=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
 return {clinic,contexts:clinic?session.contexts.filter(c=>c.clinicId===clinic):[]};
}

export function canOpen(view:WorkspaceView,contexts:IamContextView[]){
 if(view==='settings')return true;
 if(view==='system')return false;
 return contexts.some(c=>grants[view].includes(c.role)&&(!clinicWide.has(view)||c.allBranches));
}

export function homeView(contexts:IamContextView[]):WorkspaceView{
 for(const view of ['overview','reception','doctor','lab','billing'] as WorkspaceView[])if(canOpen(view,contexts))return view;
 return 'settings';
}

export function workspaceUrl(session:UserSession,requested?:string|null){
 const scope=clinicContexts(session,requested);
 const view=session.actor.platformOperator&&!scope.contexts.length?'system':homeView(scope.contexts);
 return '/workspace?'+new URLSearchParams({view,...(scope.clinic?{clinicId:scope.clinic}:{})});
}
