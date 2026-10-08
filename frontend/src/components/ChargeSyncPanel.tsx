import {useAuthoritativeSync} from './useAuthoritativeSync';

import {useEffect,useRef,useState} from 'react';
import * as api from '../api/billing';
import type {Scope} from '../api/reception';
type Source='billing'|'medical'|'encounter';
const labels:Record<Source,string>={billing:'Ghi nhận khoản phí',medical:'Dịch vụ cận lâm sàng',encounter:'Hoàn tất lượt khám'};
const states:Record<string,string>={PENDING:'Đang chờ',CLAIMED:'Đang xử lý',DLQ:'Cần quản lý xử lý',APPLIED:'Đã ghi nhận',PUBLISHED:'Đã gửi'};
export function ChargeSyncPanel({scope,encounterId,onRetry,canRetry}:{scope:Scope;encounterId:string;onRetry?:(source:Source,eventId:string)=>void;canRetry:boolean}){
 const [sources,setSources]=useState<Partial<Record<Source,api.ChargeSyncState>>>({}),[errors,setErrors]=useState<Source[]>([]),[busy,setBusy]=useState(false);const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setSources({});setErrors([]);setBusy(false);return()=>{epoch.current++;};},[scope.token,scope.clinic,scope.branch,encounterId]);
 useAuthoritativeSync({key:scope.token+scope.clinic+scope.branch+encounterId,enabled:!!scope.token&&!!encounterId,blocked:busy,intervalMs:30000,refresh:async context=>{
  const current=epoch.current,names:Source[]=['billing','medical','encounter'];const results=await Promise.allSettled(names.map(name=>name==='billing'?api.chargeState(scope,encounterId):api.deliveryState(scope,encounterId,name)));if(!context.current()||current!==epoch.current)return;
  const received:Partial<Record<Source,api.ChargeSyncState>>={},missing:Source[]=[];results.forEach((result,i)=>{if(result.status==='fulfilled')received[names[i]]=result.value;else missing.push(names[i]);});setSources(received);setErrors(missing);if(missing.length)throw new Error('Charge delivery unavailable');
 }});
 async function read(){const current=++epoch.current;setSources({});setErrors([]);setBusy(true);const names:Source[]=['billing','medical','encounter'];const results=await Promise.allSettled(names.map(name=>name==='billing'?api.chargeState(scope,encounterId):api.deliveryState(scope,encounterId,name)));if(current!==epoch.current)return;const received:Partial<Record<Source,api.ChargeSyncState>>={},missing:Source[]=[];results.forEach((result,i)=>{if(result.status==='fulfilled')received[names[i]]=result.value;else missing.push(names[i]);});setSources(received);setErrors(missing);setBusy(false);}
 useEffect(()=>{if(encounterId)void read();},[scope.token,scope.clinic,scope.branch,encounterId]);
 return <article className="booking-appointment"><h2>Đồng bộ khoản phí</h2>{busy&&<p role="status">Đang kiểm tra các nguồn dịch vụ…</p>}
 {errors.map(source=><p key={source} role="alert">Chưa kiểm tra được: {labels[source]}. Dữ liệu sẽ được đồng bộ lại trước khi kết luận dịch vụ đã hoàn tất.</p>)}
 {(['medical','encounter','billing'] as Source[]).map(source=>sources[source]&&<section key={source} aria-label={labels[source]}><h3>{labels[source]}</h3>{source==='billing'&&<p>Khoản phí đã ghi nhận: {sources[source]!.chargeCount??0}</p>}{sources[source]!.events.length===0?<p>Chưa có bản ghi từ nguồn này.</p>:<ul>{sources[source]!.events.map(event=><li key={event.eventId}>{states[event.status]??'Chưa xác định'} · Đã thử {event.attempts} lần {event.status==='DLQ'&&<><p>Kiểm tra kết nối và dữ liệu dịch vụ trước khi yêu cầu xử lý lại.</p>{onRetry&&<button type="button" disabled={!canRetry||busy} onClick={()=>onRetry(source,event.eventId)}>Yêu cầu xử lý lại {labels[source].toLowerCase()}</button>}</>}</li>)}</ul>}</section>)}
 <p>Đồng bộ dịch vụ không tự lập phiếu thu hoặc ghi nhận tiền.</p></article>;
}
