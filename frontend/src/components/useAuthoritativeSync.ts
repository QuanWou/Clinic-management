import {useEffect,useRef,useState} from 'react';
import {subscribeRealtime,type RealtimeSubscription,type RealtimeState,type RealtimeSource} from '../api/realtime';

export type SyncContext={current:()=>boolean;sources?:RealtimeSource[]};
type Options={key:string;enabled:boolean;refresh:(context:SyncContext)=>Promise<void>;blocked?:boolean;subscriptions?:RealtimeSubscription[];intervalMs?:number;fallbackMs?:number;initial?:boolean;onDenied?:()=>void};

/** Serialized, coalesced authoritative reads. A hint during an edit/write remains pending.
 * Call current() before committing fetched state; a superseded scope must never receive old data.
 */
export function useAuthoritativeSync({key,enabled,refresh,blocked=false,subscriptions=[],intervalMs=0,fallbackMs=30000,initial=false,onDenied}:Options){
 const [state,setState]=useState<RealtimeState>('disconnected');
 const latest=useRef({refresh,blocked,onDenied});latest.current={refresh,blocked,onDenied};
 const editEpoch=useRef(0),wasBlocked=useRef(blocked);
 if(blocked&&!wasBlocked.current)editEpoch.current++;
 wasBlocked.current=blocked;
 const wake=useRef<()=>void>(()=>{});
 const signature=JSON.stringify(subscriptions);
 useEffect(()=>{
  if(!enabled){setState('disconnected');return;}
  let active=true,denied=false,pending=false,inFlight=false,failures=0;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const states=subscriptions.map(()=> 'disconnected' as RealtimeState);
  const changedSources=new Set<RealtimeSource>();
  const schedule=(delay=120)=>{pending=true;if(timer)clearTimeout(timer);timer=setTimeout(()=>void drain(),delay);};
  async function drain(){
   timer=undefined;
   if(!active||denied||inFlight||latest.current.blocked||document.visibilityState==='hidden'||!pending)return;
   pending=false;inFlight=true;const sources=[...changedSources],startedEpoch=editEpoch.current;changedSources.clear();
   try{await latest.current.refresh({current:()=>active&&!denied&&!latest.current.blocked&&startedEpoch===editEpoch.current,sources});failures=0;}
   catch{pending=true;sources.forEach(source=>changedSources.add(source));failures++;}
   finally{inFlight=false;if(latest.current.blocked||startedEpoch!==editEpoch.current){pending=true;sources.forEach(source=>changedSources.add(source));}if(active&&!denied&&pending&&!latest.current.blocked)timer=setTimeout(()=>void drain(),failures?Math.min(30000,2000*2**Math.min(failures-1,4)):120);}
  }
  const stop=()=>{if(!active||denied)return;denied=true;pending=false;if(timer)clearTimeout(timer);setState('disconnected');latest.current.onDenied?.();};
  const cleanups=subscriptions.map((subscription,index)=>subscribeRealtime(subscription,()=>{changedSources.add(subscription.source);schedule();},next=>{
   if(!active||denied)return;states[index]=next;
   setState(states.every(s=>s==='connected')?'connected':states.some(s=>s==='reconnecting')?'reconnecting':'disconnected');
  },stop));
  // Fallback is scoped to mounted, visible consumers. No global network polling.
  const period=intervalMs|| (subscriptions.length?fallbackMs:0);
  const fallback=period?setInterval(()=>{if(intervalMs||states.some(s=>s!=='connected'))schedule();},Math.max(5000,period)):undefined;
  const resume=()=>{if(document.visibilityState!=='hidden')schedule();};
  window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  wake.current=()=>{if(pending)schedule(0);};
  if(initial)schedule();
  return()=>{active=false;wake.current=()=>{};if(timer)clearTimeout(timer);if(fallback)clearInterval(fallback);cleanups.forEach(close=>close());window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
 },[key,enabled,signature,intervalMs,fallbackMs,initial]);
 useEffect(()=>{if(!blocked)wake.current();},[blocked]);
 return state;
}
