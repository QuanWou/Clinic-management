import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { useRef,useState } from 'react';
import * as api from '../api/medical';
import { contexts,type Scope,type Directory } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { useNavigationLock } from './useNavigationLock';
export function LabPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState('');
 const [orders,setOrders]=useState<api.Order[]|null>(null),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[source,setSource]=useState(''),[content,setContent]=useState('');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const running=useRef(false),pending=useRef<(()=>Promise<api.Order>)|null>(null);const scope:Scope={token,clinic:directory?.id??'',branch};const order=orders?.find(x=>x.id===selected);
 const resultDirty=!!selected&&(source!==(order?.result?.sourceRef??'')||content!==(order?.result?.content??''));
 const scopeLocked=busy||uncertain||resultDirty;
 const navigationReason=uncertain?'Thử lại thao tác lab đang chờ trước khi rời màn hình.':busy?'Đợi thao tác lab xử lý xong trước khi rời màn hình.':resultDirty?'Ghi phiên bản kết quả hoặc xóa nội dung đang sửa trước khi đổi chỉ định, địa điểm hoặc rời màn hình.':null;
 useNavigationLock(navigationReason,onNavigationLock);
 async function run(work:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await work();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định kết quả');}finally{running.current=false;setBusy(false);}}
 async function login(){let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}const list=await contexts(auth);const ids=[...new Set(list.filter(m=>m.role==='LAB').map(m=>m.clinicId))];const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;if(!id)throw new Error('Cần quyền lab tại phòng khám được cấp.');const d=await api.labDirectory(auth,id);setToken(auth);setDirectory(d);onClinic?.(d.name);}
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function chooseBranch(id:string){setBranch(id);setOrders(null);setSelected('');setContent('');setSource('');setReason('');if(id)setOrders(await api.lab({...scope,branch:id}));}
 async function execute(action?:string){
  if(!pending.current){if(!order||!action)return;const snapshot={...scope},selectedOrder={...order},body={sourceRef:source,content,reason};const key=await stableOperationKey('medical-lab',{clinic:scope.clinic,branch,actorEmail:email,id:order.id,version:order.version,action,...body});pending.current=()=>action==='result'?api.result(snapshot,selectedOrder,body,key):api.transition(snapshot,selectedOrder,action,body.reason,key);}
  try{const updated=await pending.current();pending.current=null;setUncertain(false);setOrders(current=>current?.map(o=>o.id===updated.id?updated:o)??[updated]);setMessage(updated.state==='RESULTED'?'Đã ghi kết quả có tác giả và nguồn. Chờ bác sĩ duyệt.':'Đã cập nhật chỉ định.');}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){pending.current=null;setUncertain(false);setOrders(null);throw new Error(e.message+' Tải lại danh sách chỉ định.');}setUncertain(true);throw e;}
 }
 function logout(){setToken('');setDirectory(null);setOrders(null);setContent('');setSource('');setReason('');setBranch('');setSelected('');pending.current=null;setUncertain(false);setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}
 return <section className="booking-panel reception-panel doctor-panel" aria-labelledby="lab-title"><h1 id="lab-title">Chỉ định và kết quả lab</h1><p>Nhận chỉ định, xác định nguồn và ghi kết quả. Bác sĩ phân công duyệt kết quả ở bước riêng.</p>{error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void run(login)}/>:!token?<form className="booking-form" onSubmit={e=>{e.preventDefault();void run(login);}}><label>Email nhân sự lab<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu nhân sự lab<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="booking-primary" disabled={busy}>Đăng nhập lab</button></form>:<>
   {!shared&&<button type="button" disabled={scopeLocked} onClick={logout}>Đăng xuất lab</button>}<fieldset className="reception-actions" disabled={scopeLocked}><label>Địa điểm lab<select value={branch} onChange={e=>void run(()=>chooseBranch(e.target.value))}><option value="">Chọn địa điểm được cấp</option>{directory?.branches.filter(x=>x.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></fieldset>
   {branch&&<button type="button" disabled={busy} onClick={()=>void run(async()=>{setOrders(null);setOrders(await api.lab(scope));})}>Tải lại chỉ định lab</button>}
   {uncertain&&<p role="status">Yêu cầu được giữ nguyên để xác nhận lại. <button type="button" disabled={busy} onClick={()=>void run(()=>execute())}>Thử lại thao tác lab đang chờ</button></p>}
   {navigationReason&&!onNavigationLock&&<p role="status">{navigationReason}</p>}
   {resultDirty&&<details><summary>Hủy thay đổi kết quả chưa ghi</summary><p>Nội dung đang sửa sẽ được thay bằng kết quả đã ghi tại máy chủ, nếu có.</p><button type="button" disabled={busy||uncertain} onClick={()=>{setContent(order?.result?.content??'');setSource(order?.result?.sourceRef??'');}}>Dùng lại kết quả đã ghi</button></details>}
   {orders?.length===0&&<p role="status">Không có chỉ định cần xử lý.</p>}
   <fieldset className="reception-actions" disabled={busy||uncertain}><ul className="doctor-worklist" aria-label="Danh sách chỉ định lab">{orders?.map(o=><li key={o.id}><strong>{o.name}</strong><span>{o.state}</span><small>Mã lượt: {o.encounterId}</small><button type="button" disabled={resultDirty} onClick={()=>{setSelected(o.id);setContent(o.result?.content??'');setSource(o.result?.sourceRef??'');setReason('');}} aria-pressed={selected===o.id}>Chọn chỉ định {o.name}</button></li>)}</ul>
   {order&&<div className="booking-confirm"><h2>{order.name}</h2><label>Lý do xử lý lab<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    {order.state==='ORDERED'&&<><button type="button" disabled={!reason.trim()} onClick={()=>void run(()=>execute('accept'))}>Nhận chỉ định</button><button type="button" disabled={!reason.trim()} onClick={()=>void run(()=>execute('reject'))}>Từ chối chỉ định có lý do</button></>}
    {order.state==='ACCEPTED'&&<button type="button" disabled={!reason.trim()} onClick={()=>void run(()=>execute('process'))}>Bắt đầu xử lý lab</button>}
    {['PROCESSING','RESULTED'].includes(order.state)&&<><label>Nguồn kết quả<input maxLength={200} value={source} onChange={e=>setSource(e.target.value)}/></label><label>Nội dung kết quả<textarea maxLength={8000} value={content} onChange={e=>setContent(e.target.value)}/></label><button type="button" className="booking-primary" disabled={!reason.trim()||!source.trim()||!content.trim()} onClick={()=>void run(()=>execute('result'))}>Ghi phiên bản kết quả</button></>}
   </div>}</fieldset>
  </>}
 </section>;
}

