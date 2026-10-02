import {useEffect,useRef,useState} from 'react';
import * as api from '../api/reception';
import {RequestError} from '../api/booking';
import {stableOperationKey} from '../api/idempotency';
type Attempt={scope:api.Scope;ticket:api.Ticket;body:{expectedVersion:number;reason:string};key:string};
export function OvernightQueuePanel({scope,tickets,onPending,disabled=false}:{scope:api.Scope;tickets:api.Ticket[];onPending:(v:boolean)=>void;disabled?:boolean}){
 const [completed,setCompleted]=useState<string[]>([]);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const candidates=tickets.filter(t=>!completed.includes(t.id)&&t.date<today&&['WAITING','CALLED','SKIPPED'].includes(t.state));
 const [reason,setReason]=useState(''),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');const epoch=useRef(0),running=useRef(false),attempt=useRef<Attempt|null>(null);
 useEffect(()=>{epoch.current++;setCompleted([]);setError('');setMessage('');setBusy(false);setUnknown(false);running.current=false;attempt.current=null;return()=>{epoch.current++;};},[scope.token,scope.clinic,scope.branch]);
 async function advance(ticket?:api.Ticket){if(running.current||disabled)return;const generation=epoch.current;running.current=true;setBusy(true);setError('');onPending(true);
  try{if(!attempt.current){if(!ticket)return;const captured={...scope},body={expectedVersion:ticket.version,reason:reason.trim()};attempt.current={scope:captured,ticket:{...ticket},body,key:await stableOperationKey('queue-roll-forward',{clinic:scope.clinic,branch:scope.branch,ticket:ticket.id,...body})};}if(generation!==epoch.current)return;setUnknown(true);const original=attempt.current!,result=await api.rollForward(original.scope,original.ticket,original.body,original.key);if(generation!==epoch.current)return;attempt.current=null;setCompleted(old=>[...old,original.ticket.id]);setUnknown(false);onPending(false);setMessage('Đã chuyển cùng lượt sang hàng đợi hôm nay: '+result.code+'. Chọn ngày hôm nay và tải lại hàng đợi.');}
  catch(e){if(generation!==epoch.current)return;if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUnknown(false);onPending(false);}else setUnknown(true);setError(e instanceof Error?e.message:'Chưa xác định kết quả chuyển hàng đợi.');}
  finally{if(generation===epoch.current){running.current=false;setBusy(false);if(!attempt.current)onPending(false);}}
 }
 if(!candidates.length&&!unknown&&!message)return null;
 return <section className="booking-appointment" aria-label="Lượt chờ từ ngày trước"><h3>Lượt chờ từ ngày trước</h3><p>Đối chiếu người bệnh đã trở lại và bác sĩ phụ trách trước khi chuyển cùng lượt vào hàng đợi hôm nay. Lượt đang khám hoặc đã hoàn tất cần xử lý theo luồng khám.</p>{busy&&<p role="status">Đang kiểm tra và chuyển hàng đợi…</p>}{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 {unknown&&<><p>Chưa xác định kết quả. Thử lại yêu cầu gốc để giữ cùng lượt.</p><button className="button-secondary" type="button" disabled={busy||disabled} onClick={()=>void advance()}>Thử lại chuyển hàng đợi đang chờ</button></>}
 <fieldset className="configuration-fields reception-actions" disabled={busy||unknown||disabled}><legend>Đối chiếu lượt trở lại</legend><label>Lý do chuyển lượt chờ sang hôm nay<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>{candidates.map(ticket=><button className="button-secondary" type="button" key={ticket.id} disabled={!reason.trim()} onClick={()=>void advance(ticket)}>Chuyển {ticket.code} sang hôm nay</button>)}</fieldset></section>;
}

