const PATIENT_ALLOWED=['/dat-lich','/tai-khoan','/public/account'];
const WORKSPACE_ALLOWED=['/workspace'];

function safePath(value:string|null,allowed:string[]){
 if(!value)return null;
 try{
  const url=new URL(value,window.location.origin);
  if(url.origin!==window.location.origin)return null;
  const path=url.pathname;
  if(!allowed.some(prefix=>path===prefix||path.startsWith(prefix+'/')))return null;
  if(path==='/workspace/login')return null;
  return path+url.search+url.hash;
 }catch{return null;}
}

export const patientReturnTo=(value:string|null)=>safePath(value,PATIENT_ALLOWED);
export const workspaceReturnTo=(value:string|null)=>safePath(value,WORKSPACE_ALLOWED);

export function loginUrl(channel:'patient'|'workspace',returnTo?:string){
 const base=channel==='patient'?'/public/login':'/workspace/login';
 const safe=channel==='patient'?patientReturnTo(returnTo??null):workspaceReturnTo(returnTo??null);
 return safe?base+'?'+new URLSearchParams({returnTo:safe}):base;
}
