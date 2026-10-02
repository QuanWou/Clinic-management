import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { useRef,useState } from 'react';
import * as care from '../api/care';
import { contexts,type Directory,type Point,type Scope,type Visit } from '../api/reception';
import { RequestError,signIn } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { useNavigationLock } from './useNavigationLock';
import { MedicalPanel } from './MedicalPanel';
type Attempt={scope:Scope;id:string;action:care.CareAction;input:care.CareInput;key:string};
const statusText:Record<string,string>={WAITING:'Chờ khám',IN_PROGRESS:'Đang khám',AWAITING_RESULTS:'Chờ kết quả',CLINICALLY_COMPLETED:'Đã hoàn tất chuyên môn',CLOSED:'Đã đóng lượt khám'};
export function DoctorPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState('');
 const [directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState(''),[points,setPoints]=useState<Point[]>([]);
 const [visits,setVisits]=useState<Visit[]|null>(null),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[point,setPoint]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [medicalLock,setMedicalLock]=useState<string|null>(null);
 const [nextAfter,setNextAfter]=useState<string|null>(null);
 useNavigationLock(uncertain?'Xác minh hoặc thử lại thao tác khám đang chờ trước khi rời màn hình.':medicalLock??(busy?'Đợi thao tác khám xử lý xong trước khi rời màn hình.':null),onNavigationLock);
 const running=useRef(false),attempt=useRef<Attempt|null>(null);const [medicalVersion,setMedicalVersion]=useState<number|null>(null);
 const scope:Scope={token,clinic:directory?.id??'',branch};const visit=visits?.find(v=>v.id===selected);
 async function run(body:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await body();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định được kết quả. Tải lại danh sách hoặc thử lại yêu cầu.');}finally{running.current=false;setBusy(false);}}
 async function login(){
  let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}
  const memberships=await contexts(auth);const ids=[...new Set(memberships.filter(m=>m.role==='DOCTOR').map(m=>m.clinicId))];
  const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
  if(!id)throw new Error('Cần quyền bác sĩ tại một phòng khám. Dùng đường dẫn Workspace được cấp nếu bạn làm việc ở nhiều phòng khám.');
  const d=await care.directory(auth,id);setToken(auth);setDirectory(d);onClinic?.(d.name);
 }
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function chooseBranch(id:string){setNextAfter(null);setBranch(id);setVisits(null);setPoints([]);setSelected('');setReason('');setPoint('');if(!id)return;const s={...scope,branch:id};const [v,p]=await Promise.all([care.worklist(s),care.points(s)]);setVisits(v);setNextAfter(v.length===200?v.at(-1)!.id:null);setPoints(p);}
 async function refresh(){setVisits(null);setNextAfter(null);const rows=await care.worklist(scope);setVisits(rows);setNextAfter(rows.length===200?rows.at(-1)!.id:null);}
 async function loadMore(){
  if(!nextAfter)return;
  try{const page=await care.worklistPage(scope,nextAfter);setVisits(current=>{const ids=new Set(current?.map(v=>v.id));return [...current??[],...page.items.filter(v=>!ids.has(v.id))];});setNextAfter(page.nextAfter);}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){setVisits(null);setNextAfter(null);setSelected('');setMedicalVersion(null);throw new Error('Tải lại danh sách khám để đối chiếu quyền và dữ liệu hiện tại trước khi tải tiếp.');}throw e;}
 }
 async function execute(action?:care.CareAction){
  if(!attempt.current){if(!visit||!action)return;if(action==='complete'&&medicalVersion===null)return;const input={expectedVersion:visit.version,reason:reason.trim(),...(action==='resume-queue'?{servicePointId:point}:{}),...(action==='complete'?{medicalCaseVersion:medicalVersion!}:{})};attempt.current={scope:{...scope},id:visit.id,action,input,key:await stableOperationKey('doctor-care',{clinic:scope.clinic,branch,actorEmail:email,id:visit.id,action,...input})};}
  const original=attempt.current!;
  let result:Visit;try{result=await care.command(original.scope,original.id,original.action,original.input,original.key);}catch(e){
   if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUncertain(false);setVisits(null);throw new Error(e.message+' Tải lại danh sách trước khi thao tác tiếp.');}
   setUncertain(true);throw e;
  }
  attempt.current=null;setUncertain(false);setReason('');setVisits(current=>current?.map(v=>v.id===result.id?result:v)??[result]);
  setMessage(original.action==='complete'?'Đã hoàn tất chuyên môn và nhường điểm phục vụ. Hồ sơ vẫn chưa ký/phát hành.':original.action==='close'?'Đã đóng lượt khám. Thanh toán và phát hành hồ sơ được theo dõi riêng.':original.action==='await-results'?'Đã chuyển sang chờ kết quả và nhường điểm phục vụ.':original.action==='resume-queue'?'Đã đưa lượt khám trở lại hàng đợi. Chờ tiếp nhận gọi lượt.':'Đã bắt đầu hoặc tiếp tục khám.');
  // Preserve acknowledged success even if a later list refresh is unavailable.
 }
 function logout(){setNextAfter(null);setToken('');setDirectory(null);setVisits(null);setPoints([]);setBranch('');setSelected('');setReason('');setPassword('');setUncertain(false);attempt.current=null;setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}
 return <section className="booking-panel reception-panel doctor-panel" aria-labelledby="doctor-title">
  <h1 id="doctor-title">Danh sách khám của bác sĩ</h1>
  <p>Các lượt được phân công tại phòng khám của bạn. Lượt chờ kết quả được giữ qua ngày và quay lại cùng hồ sơ.</p>
  {error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status">{message}</p>}{busy&&<p role="status">Đang xử lý…</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void run(login)}/>:!token?<form onSubmit={e=>{e.preventDefault();void run(login);}} className="booking-form">
   <label>Email bác sĩ<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
   <label>Mật khẩu bác sĩ<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
   <button className="booking-primary" disabled={busy}>Đăng nhập bác sĩ</button>
  </form>:<>
   <div className="doctor-toolbar">
   {!shared&&<button type="button" disabled={busy||uncertain||!!medicalLock} onClick={logout}>Đăng xuất bác sĩ</button>}
   <fieldset className="reception-actions" disabled={busy||uncertain||!!medicalLock}>
    <label>Địa điểm khám<select value={branch} onChange={e=>void run(()=>chooseBranch(e.target.value))}><option value="">Chọn địa điểm được cấp quyền</option>{directory?.branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   </fieldset>
   {branch&&<button type="button" disabled={busy||!!medicalLock} onClick={()=>void run(refresh)}>Tải lại danh sách khám</button>}
   </div>
   {medicalLock&&!onNavigationLock&&<p role="status">{medicalLock}</p>}
   {uncertain&&<div role="status"><p>Chưa nhận được xác nhận. Yêu cầu được giữ nguyên để thử lại; bạn có thể tải lại danh sách để đối chiếu.</p><button type="button" disabled={busy} onClick={()=>void run(()=>execute())}>Thử lại thao tác khám đang chờ</button></div>}
   {visits?.length===0&&<p role="status">Chưa có lượt khám được phân công tại địa điểm này.</p>}
   <div className="doctor-layout">
   <fieldset className="reception-actions doctor-queue" disabled={busy||uncertain}>
    <legend>Lượt khám đã tải{visits?` (${visits.length})`:''}</legend>
    <ul className="doctor-worklist" aria-label="Lượt khám được phân công">{visits?.map(v=><li key={v.id}>
     <strong>{v.ticket?.code??statusText[v.status]??'Lượt khám'}</strong><span>{statusText[v.status]??v.status}</span><small>Mã lượt: {v.id}</small>
     {v.ticket&&<small>{v.ticket.state==='CALLED'?'Đã gọi lượt':v.ticket.state==='SERVING'?'Đang phục vụ':'Đang trong hàng đợi'} · {v.ticket.date}</small>}
     <button type="button" disabled={!!medicalLock&&selected!==v.id} onClick={()=>{if(v.id!==selected)setMedicalVersion(null);setSelected(v.id);setReason('');setPoint('');}} aria-pressed={selected===v.id}>Chọn lượt {v.ticket?.code??v.id}</button>
    </li>)}</ul>
    {nextAfter&&<button type="button" disabled={!!medicalLock} onClick={()=>void run(loadMore)}>Tải thêm lượt khám</button>}
   </fieldset>
   <div className="doctor-case">
   <fieldset className="reception-actions" disabled={busy||uncertain||!!medicalLock}>
    {visit&&<div className="booking-confirm">
     <h2>Lượt đang chọn</h2><p>Mã lượt: {visit.id} · {statusText[visit.status]??visit.status}</p>
     <label>Lý do chuyển trạng thái khám<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
     {visit.status==='AWAITING_RESULTS'&&!visit.ticket&&<label>Điểm phục vụ khi quay lại<select value={point} onChange={e=>setPoint(e.target.value)}><option value="">Chọn điểm phục vụ</option>{points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket?.state==='CALLED'&&<button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('start'))}>Bắt đầu hoặc tiếp tục khám</button>}
     {visit.status==='IN_PROGRESS'&&<><button type="button" className="booking-primary" disabled={!reason.trim()||medicalVersion!==null} onClick={()=>void run(()=>execute('await-results'))}>Chuyển sang chờ kết quả</button><button type="button" className="booking-primary" disabled={!reason.trim()||medicalVersion===null} onClick={()=>void run(()=>execute('complete'))}>Hoàn tất chuyên môn</button>{medicalVersion===null&&<p>Xác nhận nội dung chuyên môn và xử lý mọi chỉ định trước khi hoàn tất lượt khám.</p>}</>}
     {visit.status==='CLINICALLY_COMPLETED'&&<button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('close'))}>Đóng lượt khám</button>}
     {visit.status==='AWAITING_RESULTS'&&!visit.ticket&&<button type="button" className="booking-primary" disabled={!reason.trim()||!point} onClick={()=>void run(()=>execute('resume-queue'))}>Đưa lại vào hàng đợi</button>}
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket&&visit.ticket.state!=='CALLED'&&<p>Chờ tiếp nhận gọi lượt trước khi bắt đầu khám.</p>}
    </div>}
   </fieldset>
   {visit&&<MedicalPanel key={scope.clinic+scope.branch+visit.id} scope={scope} id={visit.id} status={visit.status} onValidated={setMedicalVersion} onNavigationLock={setMedicalLock}/>}
   {!visit&&branch&&<p className="doctor-selection-hint">Chọn một lượt trong danh sách để xem hồ sơ và thao tác khám.</p>}
   </div></div>
  </>}
 </section>;
}

