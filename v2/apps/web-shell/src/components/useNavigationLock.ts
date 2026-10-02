import { useEffect } from 'react';
import {lockNavigation} from '../auth/navigation';

// Keep credentials, draft contents and pending request bodies in component memory.
export function useNavigationLock(reason:string|null,onLock?: (reason:string|null)=>void){
 useEffect(()=>{onLock?.(reason);return()=>onLock?.(null);},[reason,onLock]);
 useEffect(()=>{
  if(!reason)return;
  const unlock=lockNavigation();
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>{unlock();window.removeEventListener('beforeunload',warn);};
 },[reason]);
}
