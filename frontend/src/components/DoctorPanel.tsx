import {PatientIdentity} from './PatientIdentity';
import {formatVnd} from '../utils/vnd';
import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { lazy,useEffect,useRef,useState } from 'react';
import * as care from '../api/care';
import { contexts,type Directory,type Point,type Scope,type Visit } from '../api/reception';
import { RequestError,signIn } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { useNavigationLock } from './useNavigationLock';
import {AsyncPanel} from './AsyncPanel';
import {WorklistTools} from './WorklistTools';
const MedicalPanel=lazy(()=>import('./MedicalPanel').then(m=>({default:m.MedicalPanel})));
type Attempt={scope:Scope;id:string;action:care.CareAction;input:care.CareInput;key:string};
const statusText:Record<string,string>={ARRIVAL_PENDING:'Chờ xác nhận tiếp nhận',WAITING:'Chờ khám',IN_PROGRESS:'Đang khám',AWAITING_RESULTS:'Chờ kết quả',CLINICALLY_COMPLETED:'Đã hoàn tất chuyên môn',CLOSED:'Đã đóng lượt khám'};
const visitStages=[['ARRIVAL_PENDING','Tiếp nhận'],['WAITING','Chờ khám'],['IN_PROGRESS','Đang khám'],['AWAITING_RESULTS','Chờ kết quả'],['CLINICALLY_COMPLETED','Hoàn tất chuyên môn'],['CLOSED','Đóng lượt']] as const;
export function DoctorPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState('');
 const [directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState(''),[points,setPoints]=useState<Point[]>([]);
 const [visits,setVisits]=useState<Visit[]|null>(null),[selected,setSelected]=useState(''),[reason,setReason]=useState(''),[point,setPoint]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [medicalLock,setMedicalLock]=useState<string|null>(null);
 const [nextAfter,setNextAfter]=useState<string|null>(null);
 const [consultationConfirmed,setConsultationConfirmed]=useState(false);
 const [lastSynced,setLastSynced]=useState<Date|null>(null);
 const [query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const filtered=visits?.filter(v=>(!filter||v.status===filter)&&(!query.trim()||`${v.patient?.fullName??''} ${v.patient?.dateOfBirth??''} ${statusText[v.status]??''} ${v.ticket?.code??''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN'))))??[];
 useNavigationLock(uncertain?'Xác minh hoặc thử lại thao tác khám đang chờ trước khi rời màn hình.':medicalLock??(busy?'Đợi thao tác khám xử lý xong trước khi rời màn hình.':null),onNavigationLock);
 const running=useRef(false),attempt=useRef<Attempt|null>(null);const [medicalVersion,setMedicalVersion]=useState<number|null>(null);
 const scope:Scope={token,clinic:directory?.id??'',branch};const visit=visits?.find(v=>v.id===selected);
 async function run(body:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await body();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định được kết quả. Danh sách sẽ được đồng bộ lại tự động.');}finally{running.current=false;setBusy(false);}}
 async function login(){
  let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}
  const memberships=await contexts(auth);const ids=[...new Set(memberships.filter(m=>m.role==='DOCTOR').map(m=>m.clinicId))];
  const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
  if(!id)throw new Error('Cần quyền bác sĩ tại một phòng khám. Dùng đường dẫn Workspace được cấp nếu bạn làm việc ở nhiều phòng khám.');
  const d=await care.directory(auth,id);setToken(auth);setDirectory(d);onClinic?.(d.name);
 }
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function chooseBranch(id:string){setQuery('');setFilter('');setNextAfter(null);setBranch(id);setVisits(null);setPoints([]);setSelected('');setReason('');setPoint('');setLastSynced(null);if(!id)return;const s={...scope,branch:id};const [v,p]=await Promise.all([care.worklist(s),care.points(s)]);setVisits(v);setNextAfter(v.length===200?v.at(-1)!.id:null);setPoints(p);setLastSynced(new Date());}
 async function refresh(silent=false){try{const rows=await care.worklist(scope);setVisits(rows);setNextAfter(rows.length===200?rows.at(-1)!.id:null);setLastSynced(new Date());}catch(e){if(!silent)throw e;setMessage('Chưa đồng bộ được danh sách. Hệ thống sẽ thử lại tự động.');}}
 useEffect(()=>{if(!token||!branch)return;const sync=()=>{if(document.visibilityState==='visible'&&!running.current&&!uncertain&&!medicalLock&&!selected)void refresh(true);};const timer=window.setInterval(sync,30000);window.addEventListener('focus',sync);document.addEventListener('visibilitychange',sync);return()=>{window.clearInterval(timer);window.removeEventListener('focus',sync);document.removeEventListener('visibilitychange',sync);};},[token,branch,uncertain,medicalLock,selected]);
 async function loadMore(){
  if(!nextAfter)return;
  try{const page=await care.worklistPage(scope,nextAfter);setVisits(current=>{const ids=new Set(current?.map(v=>v.id));return [...current??[],...page.items.filter(v=>!ids.has(v.id))];});setNextAfter(page.nextAfter);}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){setVisits(null);setNextAfter(null);setSelected('');setMedicalVersion(null);throw new Error('Quyền hoặc dữ liệu vừa thay đổi. Danh sách đang được đồng bộ lại để bạn kiểm tra trước khi tải tiếp.');}throw e;}
 }
 async function execute(action?:care.CareAction){
  if(!attempt.current){if(!visit||!action)return;if(action==='complete'&&medicalVersion===null)return;const input={expectedVersion:visit.version,reason:reason.trim(),...(action==='resume-queue'?{servicePointId:point}:{}),...(action==='complete'?{medicalCaseVersion:medicalVersion!,consultationConfirmed}:{})};attempt.current={scope:{...scope},id:visit.id,action,input,key:await stableOperationKey('doctor-care',{clinic:scope.clinic,branch,actorEmail:email,id:visit.id,action,...input})};}
  const original=attempt.current!;
  let result:Visit;try{result=await care.command(original.scope,original.id,original.action,original.input,original.key);}catch(e){
   if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUncertain(false);setVisits(null);throw new Error(e.message+' Danh sách sẽ được đồng bộ lại trước thao tác tiếp theo.');}
   setUncertain(true);throw e;
  }
  attempt.current=null;setUncertain(false);setReason('');setVisits(current=>current?.map(v=>v.id===result.id?result:v)??[result]);
  setMessage(original.action==='complete'?'Đã hoàn tất chuyên môn và nhường điểm phục vụ. Hồ sơ vẫn chưa ký/phát hành.':original.action==='close'?'Đã đóng lượt khám. Thanh toán và phát hành hồ sơ được theo dõi riêng.':original.action==='await-results'?'Đã chuyển sang chờ kết quả và nhường điểm phục vụ.':original.action==='resume-queue'?'Đã đưa lượt khám trở lại hàng đợi. Chờ tiếp nhận gọi lượt.':'Đã bắt đầu hoặc tiếp tục khám.');
  // Preserve acknowledged success even if a later list refresh is unavailable.
 }
 function logout(){setNextAfter(null);setToken('');setDirectory(null);setVisits(null);setPoints([]);setBranch('');setSelected('');setReason('');setPassword('');setUncertain(false);attempt.current=null;setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}
 return <section className="booking-panel reception-panel doctor-panel" aria-labelledby="doctor-title">
  <header className="task-panel-header"><div><span className="eyebrow">Khám bệnh</span><h1 id="doctor-title">Danh sách khám của bác sĩ</h1>
  <p>Chọn lượt được phân công để mở hồ sơ. Lượt chờ kết quả quay lại cùng hồ sơ.</p></div></header>
  {error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status">{message}</p>}{busy&&<p role="status">Đang xử lý…</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void run(login)}/>:!token?<form onSubmit={e=>{e.preventDefault();void run(login);}} className="booking-form">
   <label>Email bác sĩ<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
   <label>Mật khẩu bác sĩ<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} disabled={busy}/></label>
   <button className="booking-primary" disabled={busy}>Đăng nhập bác sĩ</button>
  </form>:<>
   <div className="doctor-toolbar">
   {!shared&&<button type="button" disabled={busy||uncertain||!!medicalLock} onClick={logout}>Đăng xuất bác sĩ</button>}
   <fieldset hidden={!!shared&&directory?.branches.filter(b=>b.active).length===1} className="reception-actions" disabled={busy||uncertain||!!medicalLock}>
    <label>Địa điểm khám<select aria-label="Địa điểm khám" value={branch} onChange={e=>void run(()=>chooseBranch(e.target.value))}><option value="">Chọn địa điểm được cấp quyền</option>{directory?.branches.filter(b=>b.active).map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   </fieldset>
   {branch&&<button type="button" disabled={busy||!!medicalLock} onClick={()=>void run(()=>refresh())}>Đồng bộ ngay</button>}
   </div>
   {medicalLock&&!onNavigationLock&&<p role="status">{medicalLock}</p>}
   {uncertain&&<div role="status"><p>Chưa nhận được xác nhận. Yêu cầu được giữ nguyên để thử lại; bạn có thể tải lại danh sách để đối chiếu.</p><button type="button" disabled={busy} onClick={()=>void run(()=>execute())}>Thử lại thao tác khám đang chờ</button></div>}
   {visits?.length===0&&<p role="status">Chưa có lượt khám được phân công tại địa điểm này.</p>}{branch&&<p className="worklist-sync-status" role="status">{visits===null?'Đang tải lượt khám…':lastSynced?'Đồng bộ lúc '+lastSynced.toLocaleTimeString('vi-VN'):'Danh sách sẵn sàng'}</p>}
   <div className="doctor-layout">
   <fieldset className="reception-actions doctor-queue" disabled={busy||uncertain}>
    <legend>Lượt khám đã tải{visits?` (${visits.length})`:''}</legend>
    <WorklistTools query={query} onQuery={setQuery} state={filter} onState={setFilter} states={statusText} placeholder="Tìm tên hoặc ngày sinh…" disabled={busy||uncertain||!!medicalLock} count={filtered.length} total={visits?.length??0}/>
    {visits&&filtered.length===0&&visits.length>0&&<p className="task-empty" role="status">Không có lượt khớp bộ lọc. Xóa bộ lọc để xem lại danh sách đã tải.</p>}
    <ul className="doctor-worklist" aria-label="Lượt khám được phân công">{filtered.map(v=><li key={v.id} className={selected===v.id?'worklist-selected':''}>
     <PatientIdentity patient={v.patient}/><strong>{statusText[v.status]??'Lượt khám'}</strong><span className="task-status" data-state={v.status}>{statusText[v.status]??v.status}</span>
     {v.ticket&&<><small>{v.ticket.state==='CALLED'?'Đã gọi lượt':v.ticket.state==='SERVING'?'Đang phục vụ':'Đang trong hàng đợi'} · {v.ticket.date}</small><details className="internal-visit-reference"><summary>Thông tin nội bộ</summary><span>Mã lượt khám: <code>{v.ticket.code}</code></span></details></>}
     <button type="button" disabled={!!medicalLock&&selected!==v.id} onClick={()=>{if(v.id!==selected)setMedicalVersion(null);setSelected(v.id);setReason('');setPoint('');setConsultationConfirmed(false);}} aria-label={'Mở hồ sơ '+(v.patient?.fullName??'bệnh nhân')+' · '+(statusText[v.status]??'lượt khám')+' · '+(v.ticket?.date??'')} aria-pressed={selected===v.id}>Mở hồ sơ bệnh nhân</button>
    </li>)}</ul>
    {nextAfter&&<button type="button" disabled={!!medicalLock} onClick={()=>void run(loadMore)}>Tải thêm lượt khám</button>}
   </fieldset>
   <div className="doctor-case">{visit&&<section className="patient-hub" aria-labelledby="patient-hub-title"><div className="patient-banner"><div className="patient-hub-title"><span className="eyebrow">Hồ sơ đang mở</span><h2 id="patient-hub-title">{visit.patient?.fullName??'Bệnh nhân'}</h2></div><span className="task-status" data-state={visit.status}>{statusText[visit.status]??'Lượt khám'}</span><div className="patient-hub-meta"><PatientIdentity patient={visit.patient}/>{visit.ticket?.code&&<span className="patient-hub-token">Số lượt {visit.ticket.code}</span>}{visit.consultation?.name&&<span>{visit.consultation.name}</span>}</div></div><ol className="visit-progress" aria-label="Tiến trình lượt khám">{visitStages.map(([key,label],index)=>{const current=visitStages.findIndex(([stage])=>stage===visit.status);return <li key={key} data-state={index<current?'complete':index===current?'current':'upcoming'} aria-current={index===current?'step':undefined}><span>{index+1}</span>{label}</li>;})}</ol></section>}
   <fieldset className="reception-actions" disabled={busy||uncertain||!!medicalLock}>
    {visit&&<div className="booking-confirm">
     <h2>Lượt đang chọn</h2><PatientIdentity patient={visit.patient}/><p>{statusText[visit.status]??visit.status}</p>{visit.ticket?.code&&<details className="internal-visit-reference"><summary>Thông tin nội bộ</summary><span>Mã lượt khám: <code>{visit.ticket.code}</code></span></details>}{visit.consultation&&<div className="consultation-review"><h3>Dịch vụ khám đã tiếp nhận</h3><p>{visit.consultation.name} · {formatVnd(visit.consultation.price.amountVnd)}</p>{visit.status==='IN_PROGRESS'&&<label><input type="checkbox" checked={consultationConfirmed} onChange={e=>setConsultationConfirmed(e.target.checked)}/>Tôi đã xem lại và thực hiện dịch vụ khám này</label>}{visit.consultationPerformedAt&&<p>Đã xác nhận thực hiện dịch vụ.</p>}</div>}
     <label>Lý do chuyển trạng thái khám<textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500}/></label>
     {visit.status==='AWAITING_RESULTS'&&!visit.ticket&&<label>Điểm phục vụ khi quay lại<select value={point} onChange={e=>setPoint(e.target.value)}><option value="">Chọn điểm phục vụ</option>{points.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket?.state==='CALLED'&&<button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('start'))}>Bắt đầu hoặc tiếp tục khám</button>}
     {visit.status==='IN_PROGRESS'&&<><button type="button" className="booking-primary" disabled={!reason.trim()||medicalVersion!==null} onClick={()=>void run(()=>execute('await-results'))}>Chuyển sang chờ kết quả</button>{medicalVersion===null&&<p>Xác nhận nội dung chuyên môn và xử lý mọi chỉ định trước khi hoàn tất lượt khám.</p>}</>}
     {visit.status==='CLINICALLY_COMPLETED'&&<button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(()=>execute('close'))}>Đóng lượt khám</button>}
     {visit.status==='AWAITING_RESULTS'&&!visit.ticket&&<button type="button" className="booking-primary" disabled={!reason.trim()||!point} onClick={()=>void run(()=>execute('resume-queue'))}>Đưa lại vào hàng đợi</button>}
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket&&visit.ticket.state!=='CALLED'&&<p>Chờ tiếp nhận gọi lượt trước khi bắt đầu khám.</p>}
    </div>}
   </fieldset>
   {visit&&<AsyncPanel key={scope.clinic+scope.branch+visit.id} label="Đang mở hồ sơ khám…"><MedicalPanel scope={scope} id={visit.id} status={visit.status} onValidated={setMedicalVersion} onNavigationLock={setMedicalLock} actions={visit.status==='IN_PROGRESS'?<button type="button" className="booking-primary" disabled={busy||uncertain||!!medicalLock||!reason.trim()||medicalVersion===null||!!visit.consultation&&!consultationConfirmed} onClick={()=>void run(()=>execute('complete'))}>Hoàn tất chuyên môn</button>:undefined}/></AsyncPanel>}
   {!visit&&branch&&<p className="doctor-selection-hint">Chọn một lượt trong danh sách để xem hồ sơ và thao tác khám.</p>}
   </div></div>
  </>}
 </section>;
}

