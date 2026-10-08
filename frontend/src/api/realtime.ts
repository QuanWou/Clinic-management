import type {Scope} from './reception';
export type RealtimeState='connected'|'reconnecting'|'disconnected';
export type RealtimeSource='encounter'|'appointment'|'billing'|'medical'|'notification';
export type RealtimeSubscription={source:RealtimeSource;path:string;token?:string;terminalNotFound?:boolean};
const bases={encounter:import.meta.env.VITE_ENCOUNTER_URL??'/s1/encounter',appointment:import.meta.env.VITE_APPOINTMENT_URL??'/s1/appointment',billing:import.meta.env.VITE_BILLING_URL??'/s1/billing',medical:import.meta.env.VITE_MEDICAL_URL??'/s1/medical',notification:import.meta.env.VITE_NOTIFICATION_URL??'/s1/notification'};
const branchPath=(s:Scope)=>'/api/clinics/'+encodeURIComponent(s.clinic)+'/branches/'+encodeURIComponent(s.branch);
export const receptionSubscription=(s:Scope,source:RealtimeSource):RealtimeSubscription=>({source,token:s.token,path:branchPath(s)+'/reception/events'});
export const doctorSubscription=(s:Scope,source:'encounter'|'medical'):RealtimeSubscription=>({source,token:s.token,path:branchPath(s)+'/doctor/events'});
export const patientSubscription=(s:Scope,source:'encounter'|'medical'|'billing'):RealtimeSubscription=>({source,token:s.token,path:'/api/me/clinics/'+encodeURIComponent(s.clinic)+'/branches/'+encodeURIComponent(s.branch)+'/events'});
export const appointmentSubscription=(token:string,clinic:string,patient:string):RealtimeSubscription=>({source:'appointment',token,path:'/api/me/appointment-events?'+new URLSearchParams({clinicId:clinic,patientId:patient})});
export const notificationSubscription=(token:string):RealtimeSubscription=>({source:'notification',token,path:'/api/me/notifications/events'});
export const displaySubscription=(token:string):RealtimeSubscription=>({source:'billing',path:'/api/public/payment-displays/'+encodeURIComponent(token)+'/events',terminalNotFound:true});
type Subscriber={change:()=>void;state:(state:RealtimeState)=>void;denied:()=>void};
type Connection={listeners:Set<Subscriber>;close:()=>void;state:RealtimeState;denied:boolean};
const connections=new Map<string,Connection>();
function diagnostic(source:RealtimeSource,stage:string){window.dispatchEvent(new CustomEvent('clinic:realtime-diagnostic',{detail:{source,stage}}));}

/** Shared authenticated streaming fetch: credentials never appear in a URL or diagnostic. */
export function subscribeRealtime(subscription:RealtimeSubscription,onChange:()=>void,onState:(state:RealtimeState)=>void,onDenied:()=>void){
 const key=JSON.stringify(subscription),listener={change:onChange,state:onState,denied:onDenied};
 let connection=connections.get(key);
 if(!connection){
  const controller=new AbortController();let retry:ReturnType<typeof setTimeout>|undefined,attempt=0;
  const created:Connection={listeners:new Set(),close:()=>{controller.abort();if(retry)clearTimeout(retry);},state:'disconnected',denied:false};connection=created;connections.set(key,created);
  const send=(callback:(subscriber:Subscriber)=>void)=>{for(const subscriber of created.listeners)try{callback(subscriber);}catch{diagnostic(subscription.source,'consumer-failure');}};
  const state=(next:RealtimeState)=>{created.state=next;send(s=>s.state(next));diagnostic(subscription.source,next);};
  async function connect(){
   if(controller.signal.aborted)return;state(attempt?'reconnecting':'disconnected');
   const request=new AbortController();const abort=()=>request.abort();controller.signal.addEventListener('abort',abort);
   let watchdog:ReturnType<typeof setTimeout>|undefined;
   const watch=()=>{if(watchdog)clearTimeout(watchdog);watchdog=setTimeout(()=>request.abort(),45000);};watch();
   try{
    const response=await fetch(bases[subscription.source]+subscription.path,{headers:{...(subscription.token?{Authorization:'Bearer '+subscription.token}:{}),Accept:'text/event-stream'},signal:request.signal,cache:'no-store'});
    if(controller.signal.aborted)return;
    if([401,403].includes(response.status)||(response.status===404&&subscription.terminalNotFound)){
     created.denied=true;state('disconnected');send(s=>s.denied());
     if(response.status===401&&subscription.token)window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer '+subscription.token}}));return;
    }
    if(!response.ok||!response.body||!response.headers.get('content-type')?.includes('text/event-stream'))throw new Error('Realtime unavailable');
    const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';
    const cancelReader=()=>{void reader.cancel().catch(()=>{});};request.signal.addEventListener('abort',cancelReader);
    try{while(!request.signal.aborted){
     const {value,done}=await reader.read();if(done)break;watch();buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');
     let end:number;
     while((end=buffer.indexOf('\n\n'))>=0){
      const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
      if(/^event: *(ready|changed)$/m.test(frame)){attempt=0;state('connected');send(s=>s.change());}
      if(/^event: *denied$/m.test(frame)){created.denied=true;state('disconnected');send(s=>s.denied());return;}
     }
     if(buffer.length>65536)throw new Error('Invalid stream frame');
    }}finally{request.signal.removeEventListener('abort',cancelReader);await reader.cancel().catch(()=>{});reader.releaseLock();}
   }catch{if(controller.signal.aborted)return;diagnostic(subscription.source,'transport-failure');}
   finally{if(watchdog)clearTimeout(watchdog);controller.signal.removeEventListener('abort',abort);}
   if(controller.signal.aborted||created.denied)return;
   state('reconnecting');retry=setTimeout(()=>{attempt++;void connect();},Math.min(30000,1000*2**Math.min(attempt,5)));
  }
  // Register the consumer before the first synchronous lifecycle notification.
  created.listeners.add(listener);void connect();
 }else{connection.listeners.add(listener);onState(connection.state);if(connection.denied)onDenied();else if(connection.state==='connected')onChange();}
 return()=>{connection!.listeners.delete(listener);if(!connection!.listeners.size){connection!.close();connections.delete(key);}};
}
export function subscribeReception(scope:Scope,source:RealtimeSource,onChange:()=>void,onState:(state:RealtimeState)=>void,onDenied:()=>void){return subscribeRealtime(receptionSubscription(scope,source),onChange,onState,onDenied);}
