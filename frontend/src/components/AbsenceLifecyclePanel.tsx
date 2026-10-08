import {useAuthoritativeSync} from './useAuthoritativeSync';

import {useEffect,useRef,useState} from 'react';
import * as api from '../api/reception';
import {RequestError} from '../api/booking';
import {stableOperationKey} from '../api/idempotency';
type Attempt={send:()=>Promise<unknown>;label:string};
export function AbsenceLifecyclePanel({scope,doctor,canManage,onPending,appointment,exceptions=[],disabled=false,active=false}:{scope:api.Scope;doctor:string;canManage:boolean;onPending?:(pending:boolean)=>void;appointment?:api.Appointment|null;exceptions?:api.Exception[];disabled?:boolean;active?:boolean}){
 const [sources,setSources]=useState<api.Absence[]>([]),[reason,setReason]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState('');
 const [busy,setBusy]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');const epoch=useRef(0),running=useRef(false),attempt=useRef<Attempt|null>(null);
 useEffect(()=>{epoch.current++;setSources([]);setError('');setMessage('');setBusy(false);setPending(false);attempt.current=null;running.current=false;return()=>{epoch.current++;};},[scope.token,scope.clinic,scope.branch,doctor]);
 async function read(){if(running.current||pending||!doctor||!canManage)return;const generation=epoch.current;running.current=true;setBusy(true);setSources([]);setError('');try{const rows=await api.doctorAbsences(scope,doctor);if(epoch.current===generation)setSources(rows);}catch(e){if(epoch.current===generation)setError(e instanceof Error?e.message:'Chưa đồng bộ được nguồn khoảng vắng.');}finally{if(epoch.current===generation){running.current=false;setBusy(false);}}}
 useEffect(()=>{if(active&&canManage&&doctor)void read();},[active,canManage,doctor,scope.token,scope.clinic,scope.branch]);
 useAuthoritativeSync({key:scope.token+scope.clinic+scope.branch+doctor,enabled:active&&canManage&&!!doctor,blocked:busy||pending||disabled,refresh:async context=>{const generation=epoch.current;const rows=await api.doctorAbsences(scope,doctor);if(context.current()&&generation===epoch.current){setSources(rows);setError('');}}});
 async function send(){if(running.current||!attempt.current)return;const generation=epoch.current,current=attempt.current;running.current=true;setBusy(true);setError('');setPending(true);onPending?.(true);
  try{await current.send();if(epoch.current!==generation)return;attempt.current=null;setPending(false);onPending?.(false);try{if(doctor)setSources(await api.doctorAbsences(scope,doctor));}catch{setSources([]);}setMessage(current.label+' đã được ghi nhận; danh sách nguồn đã đồng bộ.');}
  catch(e){if(epoch.current!==generation)return;if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setPending(false);onPending?.(false);}setError(e instanceof Error?e.message:'Chưa xác định được kết quả.');}
  finally{if(epoch.current===generation){running.current=false;setBusy(false);}}
 }
 async function prepare(operation:string,payload:unknown,build:(key:string)=>Attempt){if(attempt.current||running.current||disabled)return;const generation=epoch.current;running.current=true;setBusy(true);onPending?.(true);try{const key=await stableOperationKey(operation,payload);if(generation!==epoch.current)return;attempt.current=build(key);running.current=false;await send();}catch(e){if(generation===epoch.current){running.current=false;setBusy(false);onPending?.(false);setError(e instanceof Error?e.message:'Chưa tạo được yêu cầu xử lý.');}}}
 async function change(source:api.Absence,operation:'cancel'|'amend'){
  if(!canManage||!source.version)return;const body={expectedVersion:source.version,reason,...(operation==='amend'?{startsAt:new Date(start+':00+07:00').toISOString(),endsAt:new Date(end+':00+07:00').toISOString()}:{})};const captured={...scope};await prepare('absence-'+operation,{clinic:scope.clinic,branch:scope.branch,id:source.id,...body},key=>({send:()=>api.changeAbsence(captured,source,operation,body,key),label:operation==='amend'?'Sửa khoảng vắng':'Hủy khoảng vắng'}));
 }
 async function resolve(exception:api.Exception){if(!canManage||!appointment||appointment.version===undefined)return;const captured={...scope},source={...appointment},body={expectedVersion:appointment.version,reason};await prepare('exception-resolution',{clinic:scope.clinic,branch:scope.branch,appointment:source.id,exception:exception.id,...body},key=>({send:()=>api.resolveException(captured,source,exception,body,key),label:'Khép ngoại lệ'}));}
 return <section className="booking-appointment absence-lifecycle-panel" aria-label="Xử lý nguồn vắng và ngoại lệ"><h3>Xử lý khoảng vắng đã ghi</h3><p>Quản lý hủy hoặc sửa khoảng vắng sau khi đối chiếu. Bản cũ được giữ trong lịch sử; hệ thống cập nhật ngoại lệ theo nguồn.</p>
 <div aria-live="polite">{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}{busy&&<p role="status">Đang xử lý nguồn…</p>}</div>
 {pending&&<div><p>Chưa xác định được kết quả. Yêu cầu gốc đã được giữ với phiên bản, lý do và mã gửi ban đầu.</p><button className="button-secondary" type="button" disabled={busy} onClick={()=>void send()}>Thử lại yêu cầu xử lý đang chờ</button></div>}
 <fieldset className="configuration-fields reception-actions" disabled={busy||pending||disabled}><legend>Đối chiếu và xử lý</legend>
 <label>Lý do xử lý khoảng vắng hoặc ngoại lệ<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <label>Bắt đầu khoảng thay thế (giờ Việt Nam)<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Kết thúc khoảng thay thế (giờ Việt Nam)<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/></label>
 {sources.map(source=><article key={source.id}><p>{new Date(source.startsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} — {new Date(source.endsAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {source.state==='CANCELLED'?'Đã hủy':'Đang áp dụng'}</p>{canManage&&source.state==='ACTIVE'&&source.version&&<><button className="button-secondary" type="button" disabled={!reason.trim()} onClick={()=>void change(source,'cancel')}>Hủy khoảng vắng này</button><button className="button-secondary" type="button" disabled={!reason.trim()||!start||!end||end<=start} onClick={()=>void change(source,'amend')}>Sửa thành khoảng vắng mới</button></>}</article>)}
 {appointment&&exceptions.some(e=>e.state==='OPEN')&&<><p>Chỉ khép ngoại lệ khi nguồn đã hủy hoặc lịch đã được xử lý phù hợp. Lệnh này giữ nguyên trạng thái lịch và khoản phí.</p>{canManage&&exceptions.filter(e=>e.state==='OPEN').map(e=><button className="button-secondary" type="button" key={e.id} disabled={!reason.trim()||appointment.version===undefined} onClick={()=>void resolve(e)}>Khép ngoại lệ {e.type}</button>)}</>}
 {!canManage&&<p>Cần quyền Quản trị để hủy hoặc sửa khoảng vắng và xử lý ngoại lệ.</p>}</fieldset></section>;
}

