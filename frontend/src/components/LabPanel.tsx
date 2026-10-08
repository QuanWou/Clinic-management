import {useAuthoritativeSync} from './useAuthoritativeSync';
import {doctorSubscription} from '../api/realtime';
import {DatePreview} from './DatePreview';
import {PatientIdentity} from './PatientIdentity';
import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { useRef,useState } from 'react';
import * as api from '../api/medical';
import { contexts,type Scope,type Directory } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { useNavigationLock } from './useNavigationLock';
import {WorklistTools} from './WorklistTools';
const stateText:Record<string,string>={ORDERED:'Chờ tiếp nhận',ACCEPTED:'Đã tiếp nhận',PROCESSING:'Đang xử lý',RESULTED:'Chờ bác sĩ duyệt',REVIEWED:'Bác sĩ đã duyệt',REJECTED:'Đã từ chối',CANCELLED:'Đã hủy'};
export function LabPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState('');
 const [orders,setOrders]=useState<api.Order[]|null>(null),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[source,setSource]=useState(''),[content,setContent]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const running=useRef(false),pending=useRef<(()=>Promise<api.Order>)|null>(null);const scope:Scope={token,clinic:directory?.id??'',branch};const order=orders?.find(x=>x.id===selected);
 const resultDirty=!!selected&&(source!==(order?.result?.sourceRef??'')||content!==(order?.result?.content??''));
 const scopeLocked=busy||uncertain||resultDirty;
 const [historyMode,setHistoryMode]=useState(false),[nextHistory,setNextHistory]=useState<string|null>(null),[from,setFrom]=useState(()=>new Date(Date.now()-30*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})),[to,setTo]=useState(()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})),[versions,setVersions]=useState<NonNullable<api.Order['result']>[]>([]);
 async function loadOrders(history=historyMode,append=false,snapshot=scope){const page=history?await api.labHistory(snapshot,from,to,append?nextHistory??undefined:undefined):{items:await api.lab(snapshot),nextAfter:null};setOrders(old=>append?[...(old??[]),...page.items.filter(o=>!old?.some(x=>x.id===o.id))]:page.items);setNextHistory(page.nextAfter);}
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const filtered=orders?.filter(o=>(!filter||o.state===filter)&&(!query.trim()||`${o.patient?.fullName??''} ${o.patient?.patientCode??''} ${o.patient?.dateOfBirth??''} ${o.name} ${o.encounterId} ${o.id}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))))??[];
 const navigationReason=uncertain?'Thử lại thao tác kết quả đang chờ trước khi rời màn hình.':busy?'Đợi thao tác kết quả xử lý xong trước khi rời màn hình.':resultDirty?'Ghi phiên bản kết quả hoặc xóa nội dung đang sửa trước khi đổi chỉ định, địa điểm hoặc rời màn hình.':null;
 useNavigationLock(navigationReason,onNavigationLock);
 useAuthoritativeSync({key:scope.token+scope.clinic+scope.branch+historyMode+from+to,enabled:!!token&&!!branch&&!historyMode,blocked:scopeLocked,subscriptions:[doctorSubscription(scope,'medical')],refresh:async context=>{
  try{const rows=await api.lab(scope);if(!context.current()||running.current)return;setOrders(rows);setNextHistory(null);const chosen=rows.find(row=>row.id===selected);if(chosen){setContent(chosen.result?.content??'');setSource(chosen.result?.sourceRef??'');}setError('');}
  catch(e){if(context.current())setError('Chưa cập nhật được chỉ định. Hệ thống sẽ thử lại.');throw e;}
 },onDenied:()=>{setOrders(null);setError('Quyền truy cập chỉ định đã thay đổi.');}});
 async function run(work:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định kết quả');}finally{running.current=false;setBusy(false);}}
 async function login(){let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}const list=await contexts(auth);const ids=[...new Set(list.filter(m=>m.role==='DOCTOR').map(m=>m.clinicId))];const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;if(!id)throw new Error('Cần quyền Bác sĩ tại phòng khám được cấp.');const d=await api.labDirectory(auth,id);setToken(auth);setDirectory(d);onClinic?.(d.name);}
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function chooseBranch(id:string){setQuery('');setFilter('');setBranch(id);setOrders(null);setSelected('');setContent('');setSource('');setReason('');setVersions([]);if(id)await loadOrders(historyMode,false,{...scope,branch:id});}
 async function execute(action?:string){
  if(!pending.current){if(!order||!action)return;const snapshot={...scope},selectedOrder={...order},body={sourceRef:source,content,reason};const key=await stableOperationKey('medical-lab',{clinic:scope.clinic,branch,actorEmail:email,id:order.id,version:order.version,action,...body});pending.current=()=>action==='result'?api.result(snapshot,selectedOrder,body,key):api.transition(snapshot,selectedOrder,action,body.reason,key);}
  try{const updated=await pending.current();pending.current=null;setUncertain(false);setOrders(current=>current?.map(o=>o.id===updated.id?{...updated,patient:updated.patient??o.patient,visitCode:updated.visitCode??o.visitCode}:o)??[updated]);setMessage(updated.state==='RESULTED'?'Đã ghi kết quả có tác giả và nguồn. Chờ bác sĩ duyệt.':'Đã cập nhật chỉ định.');}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){pending.current=null;setUncertain(false);setOrders(null);throw new Error(e.message+' Tải lại danh sách chỉ định.');}setUncertain(true);throw e;}
 }
 function logout(){setToken('');setDirectory(null);setOrders(null);setContent('');setSource('');setReason('');setBranch('');setSelected('');pending.current=null;setUncertain(false);setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}
 return <section className="booking-panel reception-panel lab-panel" aria-labelledby="lab-title">
  <header className="task-panel-header"><div><span className="eyebrow">Xét nghiệm</span><h1 id="lab-title">Kết quả xét nghiệm</h1><p>Ghi kết quả cho chỉ định của bạn, sau đó xác nhận kết quả trong hồ sơ khám.</p></div></header>
  {error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status" className="task-success">{message}</p>}{busy&&<p role="status">Đang xử lý xét nghiệm…</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void run(login)}/>:!token?<form className="booking-form" onSubmit={e=>{e.preventDefault();void run(login);}}>
   <label>Email bác sĩ<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Mật khẩu bác sĩ<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="booking-primary" disabled={busy}>Đăng nhập bác sĩ</button>
  </form>:<>
   <div className="doctor-toolbar">
    {!shared&&<button type="button" disabled={scopeLocked} onClick={logout}>Đăng xuất bác sĩ</button>}
    <fieldset hidden={!!shared&&directory?.branches.filter(b=>b.active).length===1} className="reception-actions" disabled={scopeLocked}><label>Địa điểm xét nghiệm<select aria-label="Địa điểm xét nghiệm" value={branch} onChange={e=>void run(()=>chooseBranch(e.target.value))}><option value="">Chọn địa điểm được cấp</option>{directory?.branches.filter(x=>x.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></fieldset>
    {branch&&<button type="button" disabled={busy||uncertain||(resultDirty&&orders!==null)} onClick={()=>void run(async()=>{await loadOrders();})}>Tải lại chỉ định xét nghiệm</button>}
   </div>
   {uncertain&&<p role="status" className="navigation-lock">Yêu cầu được giữ nguyên để xác nhận lại. <button type="button" disabled={busy} onClick={()=>void run(()=>execute())}>Thử lại thao tác kết quả đang chờ</button></p>}
   {navigationReason&&!onNavigationLock&&<p role="status">{navigationReason}</p>}
   {resultDirty&&<details className="task-disclosure"><summary>Hủy thay đổi kết quả chưa ghi</summary><p>Nội dung đang sửa sẽ được thay bằng kết quả đã ghi tại máy chủ, nếu có. {orders===null?'Tải lại chỉ định để đối chiếu trước khi bỏ nội dung đang sửa.':''}</p>{order?.result&&<p className="result-content">Kết quả đã ghi: {order.result.content}</p>}<button type="button" disabled={busy||uncertain||!order} onClick={()=>{setContent(order?.result?.content??'');setSource(order?.result?.sourceRef??'');}}>Dùng lại kết quả đã ghi</button></details>}
   {orders?.length===0&&<p role="status">{historyMode?'Không có chỉ định trong khoảng ngày này.':'Không có chỉ định cần xử lý.'}</p>}
   <div className="task-tabs" aria-label="Công việc kết quả"><button type="button" aria-pressed={!historyMode} disabled={scopeLocked} onClick={()=>void run(async()=>{setHistoryMode(false);setSelected('');setVersions([]);setOrders(null);await loadOrders(false);})}>Cần xử lý</button><button type="button" aria-pressed={historyMode} disabled={scopeLocked} onClick={()=>void run(async()=>{setHistoryMode(true);setSelected('');setVersions([]);setOrders(null);await loadOrders(true);})}>Lịch sử kết quả</button></div>{historyMode&&<form className="doctor-toolbar" onSubmit={e=>{e.preventDefault();void run(async()=>{setSelected('');setVersions([]);await loadOrders(true);});}}><label>Từ ngày<input aria-label="Từ ngày" type="date" required disabled={scopeLocked} value={from} onChange={e=>setFrom(e.target.value)}/><DatePreview value={from}/></label><label>Đến ngày<input aria-label="Đến ngày" type="date" required disabled={scopeLocked} value={to} onChange={e=>setTo(e.target.value)}/><DatePreview value={to}/></label><button disabled={scopeLocked}>Tra lịch sử kết quả</button></form>}<div className="doctor-layout">
    <fieldset className="reception-actions doctor-queue" disabled={busy||uncertain}>
     <legend>Chỉ định đã tải{orders?` (${orders.length})`:''}</legend>
     <WorklistTools query={query} onQuery={setQuery} state={filter} onState={setFilter} states={stateText} disabled={scopeLocked} count={filtered.length} total={orders?.length??0}/>
     {orders&&filtered.length===0&&orders.length>0&&<p role="status" className="task-empty">Không có chỉ định khớp bộ lọc. Xóa bộ lọc để xem lại danh sách đã tải.</p>}
     <ul className="doctor-worklist" aria-label="Danh sách chỉ định xét nghiệm">{filtered.map(o=><li key={o.id} className={selected===o.id?'worklist-selected':''}>
      <PatientIdentity patient={o.patient}/><strong>{o.name}</strong><span className="task-status" data-state={o.state}>{stateText[o.state]??o.state}</span><small>{o.visitCode}</small>
      <button type="button" disabled={resultDirty} onClick={()=>{setSelected(o.id);setVersions([]);setContent(o.result?.content??'');setSource(o.result?.sourceRef??'');setReason('');}} aria-pressed={selected===o.id}>Chọn chỉ định {o.name}</button>
     </li>)}</ul>{historyMode&&nextHistory&&<button type="button" disabled={scopeLocked} onClick={()=>void run(()=>loadOrders(true,true))}>Tải thêm lịch sử kết quả</button>}
    </fieldset>
    <fieldset className="reception-actions doctor-case" disabled={busy||uncertain}>
     {order?<div className="task-card lab-order-detail">
      <span className="eyebrow">Chỉ định đang chọn</span><h2>{order.name}</h2><span className="task-status" data-state={order.state}>{stateText[order.state]??order.state}</span>
      <PatientIdentity patient={order.patient}/><p>{order.visitCode}</p>
      <label>Lý do xử lý xét nghiệm<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      {order.state==='ORDERED'&&<div className="task-button-row"><button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('accept'))}>Nhận chỉ định</button><button type="button" disabled={!reason.trim()} onClick={()=>void run(()=>execute('reject'))}>Từ chối chỉ định có lý do</button></div>}
      {order.state==='ACCEPTED'&&<button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('process'))}>Bắt đầu xử lý xét nghiệm</button>}
      {['PROCESSING','RESULTED'].includes(order.state)&&<><label>Nguồn kết quả<input maxLength={200} value={source} onChange={e=>setSource(e.target.value)}/></label><label>Nội dung kết quả<textarea className="lab-result-input" maxLength={8000} value={content} onChange={e=>setContent(e.target.value)}/></label><button type="button" className="booking-primary" disabled={!reason.trim()||!source.trim()||!content.trim()} onClick={()=>void run(()=>execute('result'))}>Ghi phiên bản kết quả</button></>}
      {['REVIEWED','RESULTED'].includes(order.state)&&order.result&&<article className="booking-confirm"><h3>Kết quả đã ghi</h3><p>Nguồn: {order.result.sourceRef}</p><p className="result-content">{order.result.content}</p></article>}{order.result&&<details className="task-disclosure"><summary>Các phiên bản kết quả đã ghi</summary><button type="button" disabled={busy} onClick={()=>void run(async()=>setVersions(await api.resultHistory(scope,order.id)))}>Tải các phiên bản kết quả</button>{versions.map(v=><article key={v.id}><h3>Phiên bản {v.version}</h3><p>{new Date(v.createdAt).toLocaleString('vi-VN')} · {v.sourceRef}</p><p className="result-content">{v.content}</p></article>)}</details>}
     </div>:branch&&<div className="task-empty"><h2>Chọn chỉ định cần xử lý</h2><p>Thông tin chỉ định và nội dung kết quả sẽ hiện ở đây.</p></div>}
    </fieldset>
   </div>
  </>}
 </section>;
}
