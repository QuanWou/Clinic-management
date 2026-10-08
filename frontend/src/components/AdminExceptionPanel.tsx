import {useAuthoritativeSync} from './useAuthoritativeSync';
import {receptionSubscription} from '../api/realtime';
import {useEffect,useMemo,useRef,useState} from 'react';
import {AlertTriangle,CheckCircle2,ClipboardList,RefreshCw} from 'lucide-react';
import {useSession} from '../auth/SessionProvider';
import * as api from '../api/reception';
import {receptionRequestNames} from './ReceptionExceptionCenter';

type BranchExceptions={id:string;name:string;requests:api.ReceptionRequest[];exceptions:api.Exception[];error:string|null};

const exceptionName:Record<string,string>={DOCTOR_ABSENT:'Bác sĩ vắng',LATE:'Bệnh nhân đến muộn',NO_SHOW:'Bệnh nhân không đến'};

export function AdminExceptionPanel({clinicId,onClinic}:{clinicId:string;onClinic?:(name:string)=>void}){
 const auth=useSession()!,session=auth.workspaceSession,token=session?.token??'';
 const [rows,setRows]=useState<BranchExceptions[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const [selected,setSelected]=useState<{branch:string;request:api.ReceptionRequest}|null>(null),[reason,setReason]=useState('');
 const syncScope=useRef('');syncScope.current=token+clinicId;
 const allowedBranch=(id:string)=>session?.contexts.some(context=>context.clinicId===clinicId&&context.role==='ADMIN'&&(context.allBranches||context.branchIds.includes(id)));
 const pending=useMemo(()=>rows?.flatMap(row=>row.requests.map(request=>({row,request})))??[],[rows]);
 const source=useMemo(()=>rows?.flatMap(row=>row.exceptions.map(exception=>({row,exception})))??[],[rows]);

 useAuthoritativeSync({key:token+clinicId,enabled:!!token,blocked:busy||!!selected||!!reason,subscriptions:(rows??[]).filter(row=>allowedBranch(row.id)).flatMap(row=>['encounter','appointment'].map(source=>receptionSubscription({token,clinic:clinicId,branch:row.id},source as 'encounter'|'appointment'))),refresh:async context=>{
  if(!rows){await load(true);return;}
  const updated=await Promise.all((rows??[]).filter(row=>allowedBranch(row.id)).map(async row=>{const scope={token,clinic:clinicId,branch:row.id};const [requests,exceptions]=await Promise.all([api.requests(scope),api.openExceptions(scope)]);return {...row,requests,exceptions,error:null};}));if(context.current()){setRows(updated);setLastUpdated(new Date());}
 },onDenied:()=>{setRows(null);setError('Quyền truy cập ngoại lệ đã thay đổi.');}});
 async function load(background=false){
  if(!token||busy)return;
  const original=syncScope.current;setBusy(true);setError('');setNotice('');
  try{
   const clinic=await api.directory(token,clinicId);onClinic?.(clinic.name);
   const next=await Promise.all(clinic.branches.filter(branch=>branch.active&&allowedBranch(branch.id)).map(async branch=>{
    const scope:api.Scope={token,clinic:clinicId,branch:branch.id};
    const [requests,exceptions]=await Promise.allSettled([api.requests(scope),api.openExceptions(scope)]);
    return {id:branch.id,name:branch.name,requests:requests.status==='fulfilled'?requests.value:[],exceptions:exceptions.status==='fulfilled'?exceptions.value:[],error:requests.status==='rejected'||exceptions.status==='rejected'?'Một nguồn ngoại lệ của chi nhánh chưa tải được.':null} satisfies BranchExceptions;
   }));
   if(original!==syncScope.current)return;setRows(next);setLastUpdated(new Date());
  }catch(e){if(original!==syncScope.current)return;setRows(null);setError(e instanceof Error?e.message:'Không thể tải trung tâm ngoại lệ.');if(background)throw e;}
  finally{if(original===syncScope.current)setBusy(false);}
 }
 useEffect(()=>{void load();},[token,clinicId]);

 async function resolve(){
  if(!selected||!reason.trim()||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   await api.resolveRequest({token,clinic:clinicId,branch:selected.branch},selected.request.id,reason.trim());
   setSelected(null);setReason('');setNotice('Yêu cầu đã được xác nhận xử lý tại nguồn vận hành.');
   setBusy(false);await load();return;
  }catch(e){setError(e instanceof Error?e.message:'Không thể xác nhận xử lý yêu cầu.');}
  finally{setBusy(false);}
 }

 return <section className="booking-panel reception-panel doctor-panel">
  <header className="task-panel-header admin-page-header"><div><span className="eyebrow">GIÁM SÁT</span><h1>Ngoại lệ cần xử lý</h1><p>Quản trị xử lý yêu cầu được chuyển lên từ quầy và theo dõi ngoại lệ lịch hẹn. Không thực hiện check-in, gọi số hoặc thao tác hàng đợi tại đây.</p></div></header>
  {busy&&<p role="status">Đang đối chiếu ngoại lệ…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="dashboard-metrics">
   <article className="dashboard-metric"><ClipboardList size={22}/><span>Yêu cầu từ quầy</span><strong>{pending.length}</strong><small>Cần quản trị đối chiếu</small></article>
   <article className="dashboard-metric"><AlertTriangle size={22}/><span>Ngoại lệ lịch hẹn</span><strong>{source.length}</strong><small>Bác sĩ vắng, đến muộn hoặc không đến</small></article>
   <article className="dashboard-metric"><CheckCircle2 size={22}/><span>Chi nhánh đã tải</span><strong>{rows?.filter(r=>!r.error).length??0}</strong><small>Trong phạm vi phòng khám</small></article>
  </div>
  <div className="dashboard-toolbar admin-refresh-only"><span className="admin-refresh-meta">Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật ngoại lệ" title="Cập nhật ngoại lệ" disabled={busy} onClick={()=>void load()}><RefreshCw size={17}/></button></div>
  {rows?.some(r=>r.error)&&<p role="alert">Một số chi nhánh chưa tải đủ dữ liệu; không suy diễn số liệu còn thiếu.</p>}
  <section className="dashboard-card"><h2>Yêu cầu cần Quản trị</h2>{!pending.length?<p>Không có yêu cầu đang mở.</p>:pending.map(({row,request})=><article className="booking-appointment" key={request.id}><span className="task-status" data-state="OPEN">Cần xử lý</span><strong>{receptionRequestNames[request.type]??request.type}</strong><p>{request.reason}</p><small>{row.name} · {new Date(request.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small><button className="button-secondary" disabled={busy} onClick={()=>{setSelected({branch:row.id,request});setReason('');}}>Xử lý yêu cầu</button></article>)}</section>
  <section className="dashboard-card"><h2>Ngoại lệ lịch hẹn từ nguồn</h2>{!source.length?<p>Không có ngoại lệ lịch hẹn đang mở.</p>:source.map(({row,exception})=><article className="booking-appointment" key={exception.id}><span className="task-status" data-state="OPEN">{exception.type==='DOCTOR_ABSENT'?'Cần quản trị':'Theo dõi'}</span><strong>{exceptionName[exception.type]??exception.type}</strong><p>{row.name} · Trạng thái {exception.state}</p><small>{exception.notificationMode==='MANUAL_CONTACT_REQUIRED'?'Cần phối hợp quầy để liên hệ bệnh nhân':'Thông báo đang theo dõi qua hệ thống'}</small></article>)}</section>
  {selected&&<form className="booking-form" onSubmit={e=>{e.preventDefault();void resolve();}}><h2>Xác nhận xử lý escalation</h2><p>{receptionRequestNames[selected.request.type]??selected.request.type}: {selected.request.reason}</p><label>Kết quả đối chiếu / lý do xử lý<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="booking-primary" disabled={busy||!reason.trim()}>Xác nhận đã xử lý</button><button type="button" disabled={busy} onClick={()=>{setSelected(null);setReason('');}}>Hủy</button></form>}
 </section>;
}
