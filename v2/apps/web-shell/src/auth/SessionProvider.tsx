import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import {signIn} from '../api/booking';
import {contexts} from '../api/reception';
import {current} from '../api/configuration';
import type {UserSession} from './access';
import {navigateLocal,initializeNavigation,guardHistory} from './navigation';
export {navigateLocal} from './navigation';

type SessionContextValue={session:UserSession|null;publicVersion:number;notice:string;authenticate:(email:string,password:string,fullName?:string)=>Promise<UserSession>;signOut:(notice?:string)=>void;refresh:()=>Promise<UserSession|null>;navigate:(url:string,replace?:boolean)=>void};
const SessionContext=createContext<SessionContextValue|null>(null);
export function useSession(){return useContext(SessionContext);}
export function useLocation(){
 const [location,setLocation]=useState(()=>typeof window==='undefined'?'/':window.location.pathname+window.location.search);
 useEffect(()=>{const update=(event:Event)=>{if(event.type==='popstate'&&!guardHistory(event as PopStateEvent))return;setLocation(window.location.pathname+window.location.search);};window.addEventListener('popstate',update);window.addEventListener('clinic:navigate',update);return()=>{window.removeEventListener('popstate',update);window.removeEventListener('clinic:navigate',update);};},[]);
 return location;
}
export function SessionProvider({children}:{children:ReactNode}){
 useEffect(()=>{initializeNavigation();},[]);
 const [session,setSession]=useState<UserSession|null>(null),[notice,setNotice]=useState('');
 const [publicVersion,setPublicVersion]=useState(0);
 const active=useRef<UserSession|null>(null),generation=useRef(0);
 const signOut=useCallback((message='')=>{generation.current++;active.current=null;setSession(null);setPublicVersion(v=>v+1);setNotice(message);},[]);
 const authenticate=useCallback(async(email:string,password:string,fullName?:string)=>{
  const version=++generation.current;
  const response=await signIn(email,password,fullName);
  const token=response.data.accessToken;
  const [actor,grants]=await Promise.all([current(token),contexts(token)]);
  if(version!==generation.current)throw new Error('Lần đăng nhập này đã kết thúc.');
  const user={token,email,actor,contexts:grants};if(active.current&&active.current.actor.userId!==actor.userId)setPublicVersion(v=>v+1);active.current=user;setSession(user);setNotice('');return user;
 },[]);
 const refresh=useCallback(async()=>{
  const previous=active.current,version=generation.current;if(!previous)return null;
  const [actor,grants]=await Promise.all([current(previous.token),contexts(previous.token)]);
  if(version!==generation.current)return null;
  const user={...previous,actor,contexts:grants};active.current=user;setSession(user);return user;
 },[]);
 useEffect(()=>{const invalid=(event:Event)=>{if((event as CustomEvent).detail?.authorization==='Bearer '+active.current?.token)signOut('Phiên đăng nhập đã hết hạn hoặc bị thu hồi. Vui lòng đăng nhập lại.');};window.addEventListener('clinic:session-invalid',invalid);return()=>window.removeEventListener('clinic:session-invalid',invalid);},[signOut]);
 useEffect(()=>{
  if(!session)return;
  const token=session.token;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{const payload=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(typeof payload.exp==='number')timer=setTimeout(()=>signOut('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'),Math.max(0,payload.exp*1000-Date.now()));}catch{/* Server remains the authentication authority. */}
  const focus=()=>{void refresh().catch(()=>{/* Destination APIs still re-authorize every request. */});};window.addEventListener('focus',focus);
  return()=>{if(timer)clearTimeout(timer);window.removeEventListener('focus',focus);};
 },[session?.token,refresh,signOut]);
 const value=useMemo(()=>({session,publicVersion,notice,authenticate,signOut,refresh,navigate:navigateLocal}),[session,publicVersion,notice,authenticate,signOut,refresh]);
 return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

/** Load each source with the common memory session; independent component tests retain their own sign-in harness. */
export function usePanelSession(load:()=>Promise<void>){
 const shared=useSession(),latest=useRef(load);latest.current=load;
 useEffect(()=>{let mounted=true;if(shared?.session)queueMicrotask(()=>{if(mounted)void latest.current();});return()=>{mounted=false;};},[shared?.session?.token]);
 return shared;
}
export function useSessionBranch(shared:ReturnType<typeof useSession>,token:string,directory:{id:string;branches:{id:string;active?:boolean}[]}|null,branch:string,choose:(id:string)=>Promise<void>){
 const latest=useRef(choose);latest.current=choose;
 useEffect(()=>{let mounted=true;const branches=directory?.branches.filter(b=>b.active!==false)??[];if(shared&&token&&!branch&&branches.length===1)queueMicrotask(()=>{if(mounted)void latest.current(branches[0].id);});return()=>{mounted=false;};},[!!shared,token,directory?.id,branch]);
}
