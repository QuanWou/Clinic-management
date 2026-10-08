import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {logoutSession,refreshSession,signIn,type AuthChannel} from '../api/booking';
import {requestJson} from '../api/client';
import {contexts} from '../api/reception';
import {current} from '../api/configuration';
import type {UserSession} from './access';
import {navigateLocal,initializeNavigation,guardHistory} from './navigation';
export {navigateLocal} from './navigation';

type Channel=AuthChannel;
type SessionContextValue={
 session:UserSession|null;
 patientSession:UserSession|null;
 workspaceSession:UserSession|null;
 ready:boolean;
 publicVersion:number;
 notice:string;
 authenticate:(email:string,password:string,fullName?:string)=>Promise<UserSession>;
 authenticatePatient:(email:string,password:string,fullName?:string)=>Promise<UserSession>;
 authenticateWorkspace:(email:string,password:string)=>Promise<UserSession>;
 signOut:(notice?:string)=>void;
 signOutPatient:(notice?:string)=>void;
 signOutWorkspace:(notice?:string)=>void;
 refresh:()=>Promise<UserSession|null>;
 refreshPatient:()=>Promise<UserSession|null>;
 refreshWorkspace:()=>Promise<UserSession|null>;
 navigate:(url:string,replace?:boolean)=>void;
};
const SessionContext=createContext<SessionContextValue|null>(null);
export function useSession(){return useContext(SessionContext);}
export function useLocation(){
 const [location,setLocation]=useState(()=>typeof window==='undefined'?'/':window.location.pathname+window.location.search);
 useEffect(()=>{const update=(event:Event)=>{if(event.type==='popstate'&&!guardHistory(event as PopStateEvent))return;setLocation(window.location.pathname+window.location.search);};window.addEventListener('popstate',update);window.addEventListener('clinic:navigate',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener('clinic:navigate',update);};},[]);
 return location;
}
const channelFor=(location:string):Channel=>location.split('?')[0].startsWith('/workspace')?'workspace':'patient';
const patientBase=import.meta.env.VITE_PATIENT_URL??'/s1/patient';

export function SessionProvider({children}:{children:ReactNode}){
 useEffect(()=>{initializeNavigation();},[]);
 const location=useLocation();
 const channel=channelFor(location);
 const [patientSession,setPatientSession]=useState<UserSession|null>(null);
 const [workspaceSession,setWorkspaceSession]=useState<UserSession|null>(null);
 const [patientReady,setPatientReady]=useState(false),[workspaceReady,setWorkspaceReady]=useState(false);
 const [patientNotice,setPatientNotice]=useState(''),[workspaceNotice,setWorkspaceNotice]=useState('');
 const [publicVersion,setPublicVersion]=useState(0);
 const patientActive=useRef<UserSession|null>(null),workspaceActive=useRef<UserSession|null>(null);
 const patientGeneration=useRef(0),workspaceGeneration=useRef(0);

 const clearPatient=useCallback((message='')=>{
  patientGeneration.current++;
  patientActive.current=null;
  setPatientSession(null);
  setPatientNotice(message);
  setPublicVersion(value=>value+1);
 },[]);
 const clearWorkspace=useCallback((message='')=>{
  workspaceGeneration.current++;
  workspaceActive.current=null;
  setWorkspaceSession(null);
  setWorkspaceNotice(message);
 },[]);

 const resolveSession=useCallback(async(target:Channel,email:string,password:string,fullName?:string)=>{
  const response=await signIn(email,password,fullName,target);
  const token=response.data.accessToken;
  const [actor,grants]=await Promise.all([current(token),contexts(token)]);
  return {token,email:response.data.email??email,displayName:response.data.fullName??fullName,actor,contexts:grants} satisfies UserSession;
 },[]);

 const authenticatePatient=useCallback(async(email:string,password:string,fullName?:string)=>{
  const version=++patientGeneration.current;
  const user=await resolveSession('patient',email,password,fullName);
  if(user.contexts.length||user.actor.platformOperator){
   const profile=await requestJson<unknown>(patientBase+'/api/me/patient-profile',{headers:{Authorization:'Bearer '+user.token}});
   if(!profile.ok){
    void logoutSession('patient').catch(()=>{});
    throw new Error('Tài khoản này chưa có hồ sơ bệnh nhân được liên kết. Vui lòng sử dụng tài khoản bệnh nhân hoặc liên hệ phòng khám.');
   }
  }
  if(version!==patientGeneration.current)throw new Error('Lần đăng nhập này đã kết thúc.');
  if(patientActive.current&&patientActive.current.actor.userId!==user.actor.userId)setPublicVersion(value=>value+1);
  patientActive.current=user;setPatientSession(user);setPatientNotice('');return user;
 },[resolveSession]);

 const authenticateWorkspace=useCallback(async(email:string,password:string)=>{
  const version=++workspaceGeneration.current;
  const user=await resolveSession('workspace',email,password);
  if(!user.contexts.length&&!user.actor.platformOperator){
   void logoutSession('workspace').catch(()=>{});
   throw new Error('Tài khoản không có quyền truy cập không gian làm việc của phòng khám.');
  }
  if(version!==workspaceGeneration.current)throw new Error('Lần đăng nhập này đã kết thúc.');
  workspaceActive.current=user;setWorkspaceSession(user);setWorkspaceNotice('');return user;
 },[resolveSession]);

 const refreshChannel=useCallback(async(target:Channel)=>{
  const active=target==='patient'?patientActive:workspaceActive;
  const versionRef=target==='patient'?patientGeneration:workspaceGeneration;
  const previous=active.current,version=versionRef.current;if(!previous)return null;
  const [actor,grants]=await Promise.all([current(previous.token),contexts(previous.token)]);
  if(version!==versionRef.current)return null;
  if(target==='workspace'&&!grants.length&&!actor.platformOperator){clearWorkspace('Quyền truy cập không gian làm việc đã hết hiệu lực. Vui lòng đăng nhập lại.');return null;}
  if(JSON.stringify(actor)===JSON.stringify(previous.actor)&&JSON.stringify(grants)===JSON.stringify(previous.contexts))return previous;
  const user={...previous,actor,contexts:grants};active.current=user;
  if(target==='patient')setPatientSession(user);else setWorkspaceSession(user);
  return user;
 },[clearWorkspace]);

 const refreshPatient=useCallback(()=>refreshChannel('patient'),[refreshChannel]);
 const refreshWorkspace=useCallback(()=>refreshChannel('workspace'),[refreshChannel]);

 const renewChannel=useCallback(async(target:Channel)=>{
  const active=target==='patient'?patientActive:workspaceActive;
  const versionRef=target==='patient'?patientGeneration:workspaceGeneration;
  const previous=active.current,version=versionRef.current;
  if(!previous)return null;
  try{
   const response=await refreshSession(target);
   const token=response.data.accessToken;
   const [actor,grants]=await Promise.all([current(token),contexts(token)]);
   if(version!==versionRef.current)return null;
   if(target==='workspace'&&!grants.length&&!actor.platformOperator){void logoutSession('workspace').catch(()=>{});clearWorkspace('Quyền truy cập không gian làm việc đã hết hiệu lực. Vui lòng đăng nhập lại.');return null;}
   if(target==='patient'&&(grants.length||actor.platformOperator)){
    const profile=await requestJson<unknown>(patientBase+'/api/me/patient-profile',{headers:{Authorization:'Bearer '+token}});
    if(!profile.ok){void logoutSession('patient').catch(()=>{});clearPatient('Tài khoản không còn có quyền truy cập hồ sơ bệnh nhân. Vui lòng đăng nhập lại.');return null;}
   }
   const user={...previous,token,email:response.data.email??previous.email,displayName:response.data.fullName??previous.displayName,actor,contexts:grants};
   active.current=user;
   if(target==='patient')setPatientSession(user);else setWorkspaceSession(user);
   return user;
  }catch{
   if(version!==versionRef.current)return null;
   if(target==='patient')clearPatient('Phiên bệnh nhân đã hết hạn. Vui lòng đăng nhập lại.');
   else clearWorkspace('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
   return null;
  }
 },[clearPatient,clearWorkspace]);

 const signOutPatient=useCallback((message='')=>{
  void logoutSession('patient').catch(()=>{});
  clearPatient(message);
 },[clearPatient]);
 const signOutWorkspace=useCallback((message='')=>{
  void logoutSession('workspace').catch(()=>{});
  clearWorkspace(message);
 },[clearWorkspace]);

 useEffect(()=>{
  let mounted=true;
  const restore=async(target:Channel)=>{
   const active=target==='patient'?patientActive:workspaceActive;
   const versionRef=target==='patient'?patientGeneration:workspaceGeneration;
   const version=versionRef.current;
   try{
    const response=await refreshSession(target);
    const token=response.data.accessToken;
    const [actor,grants]=await Promise.all([current(token),contexts(token)]);
    if(!mounted||version!==versionRef.current)return;
    if(target==='workspace'&&!grants.length&&!actor.platformOperator){void logoutSession('workspace').catch(()=>{});return;}
    if(target==='patient'&&(grants.length||actor.platformOperator)){
     const profile=await requestJson<unknown>(patientBase+'/api/me/patient-profile',{headers:{Authorization:'Bearer '+token}});
     if(!profile.ok){void logoutSession('patient').catch(()=>{});return;}
    }
    const user={token,email:response.data.email??'',displayName:response.data.fullName,actor,contexts:grants} satisfies UserSession;
    active.current=user;
    if(target==='patient')setPatientSession(user);else setWorkspaceSession(user);
   }catch{/* No valid HttpOnly refresh cookie means this channel starts signed out. */}
   finally{
    if(!mounted)return;
    if(target==='patient')setPatientReady(true);else setWorkspaceReady(true);
   }
  };
  void restore('patient');void restore('workspace');
  return()=>{mounted=false;};
 },[]);

 useEffect(()=>{
  const invalid=(event:Event)=>{
   const authorization=(event as CustomEvent).detail?.authorization;
   const patientMatch=!!patientActive.current&&authorization==='Bearer '+patientActive.current.token;
   const workspaceMatch=!!workspaceActive.current&&authorization==='Bearer '+workspaceActive.current.token;
   if(patientMatch&&workspaceMatch){
    if(channelFor(window.location.pathname+window.location.search)==='workspace')clearWorkspace('Phiên làm việc đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
    else clearPatient('Phiên bệnh nhân đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
    return;
   }
   if(patientMatch)clearPatient('Phiên bệnh nhân đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
   if(workspaceMatch)clearWorkspace('Phiên làm việc đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');
  };
  window.addEventListener('clinic:session-invalid',invalid);
  return()=>window.removeEventListener('clinic:session-invalid',invalid);
 },[clearPatient,clearWorkspace]);

 useEffect(()=>{
  const timers:ReturnType<typeof setTimeout>[]=[];
  const arm=(target:Channel,user:UserSession|null)=>{
   if(!user)return;
   try{
    const payload=JSON.parse(atob(user.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(typeof payload.exp==='number')timers.push(setTimeout(()=>void renewChannel(target),Math.max(0,payload.exp*1000-Date.now()-30000)));
   }catch{/* Server remains the authentication authority. */}
  };
  arm('patient',patientSession);arm('workspace',workspaceSession);
  return()=>timers.forEach(clearTimeout);
 },[patientSession?.token,workspaceSession?.token,renewChannel]);

 useEffect(()=>{
  if(!patientSession&&!workspaceSession)return;
  const verify=()=>{
   if(document.visibilityState==='hidden')return;
   if(patientActive.current)void refreshPatient().catch(()=>{/* Destination APIs remain authoritative. */});
   if(workspaceActive.current)void refreshWorkspace().catch(()=>{/* Destination APIs remain authoritative. */});
  };
  window.addEventListener('focus',verify);document.addEventListener('visibilitychange',verify);
  const permissions=setInterval(verify,45000);
  return()=>{clearInterval(permissions);window.removeEventListener('focus',verify);document.removeEventListener('visibilitychange',verify);};
 },[patientSession?.token,workspaceSession?.token,refreshPatient,refreshWorkspace]);

 const session=channel==='workspace'?workspaceSession:patientSession;
 const ready=channel==='workspace'?workspaceReady:patientReady;
 const notice=channel==='workspace'?workspaceNotice:patientNotice;
 const authenticate=channel==='workspace'?authenticateWorkspace:authenticatePatient;
 const signOut=channel==='workspace'?signOutWorkspace:signOutPatient;
 const refresh=channel==='workspace'?refreshWorkspace:refreshPatient;
 const value=useMemo(()=>({
  session,patientSession,workspaceSession,ready,publicVersion,notice,authenticate,authenticatePatient,authenticateWorkspace,
  signOut,signOutPatient,signOutWorkspace,refresh,refreshPatient,refreshWorkspace,navigate:navigateLocal
 }),[session,patientSession,workspaceSession,ready,publicVersion,notice,authenticate,authenticatePatient,authenticateWorkspace,signOut,signOutPatient,signOutWorkspace,refresh,refreshPatient,refreshWorkspace]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Load each source with the session for the current product channel; standalone component tests keep their own harnesses. */
export function usePanelSession(load:()=>Promise<void>){
 const shared=useSession(),latest=useRef(load);latest.current=load;
 useEffect(()=>{let mounted=true;if(shared?.session)queueMicrotask(()=>{if(mounted)void latest.current();});return()=>{mounted=false;};},[shared?.session?.token,JSON.stringify(shared?.session?.contexts),shared?.session?.actor.platformOperator]);
 return shared;
}
export function useSessionBranch(shared:ReturnType<typeof useSession>,token:string,directory:{id:string;branches:{id:string;active?:boolean}[]}|null,branch:string,choose:(id:string)=>Promise<void>){
 const latest=useRef(choose);latest.current=choose;
 useEffect(()=>{let mounted=true;const branches=directory?.branches.filter(b=>b.active!==false)??[];if(shared&&token&&directory){if(branch&&!branches.some(b=>b.id===branch))queueMicrotask(()=>{if(mounted)void latest.current('');});else if(!branch&&branches.length===1)queueMicrotask(()=>{if(mounted)void latest.current(branches[0].id);});}return()=>{mounted=false;};},[!!shared,token,directory?.id,JSON.stringify(directory?.branches),branch]);
}
