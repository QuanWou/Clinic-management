import {useAuthoritativeSync,type SyncContext} from './useAuthoritativeSync';
import {doctorSubscription} from '../api/realtime';
import {PatientIdentity} from './PatientIdentity';
import {formatVnd} from '../utils/vnd';
import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { lazy,useEffect,useRef,useState } from 'react';
import * as care from '../api/care';
import * as medical from '../api/medical';
import { contexts,type Directory,type Scope,type Visit } from '../api/reception';
import { RequestError,signIn } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { useNavigationLock } from './useNavigationLock';
import {AsyncPanel} from './AsyncPanel';
const MedicalPanel=lazy(()=>import('./MedicalPanel').then(m=>({default:m.MedicalPanel})));
type Attempt={scope:Scope;id:string;action:care.CareAction;input:care.CareInput;key:string};
const statusText:Record<string,string>={ARRIVAL_PENDING:'Chờ xác nhận tiếp nhận',WAITING:'Chờ khám',IN_PROGRESS:'Đang khám',AWAITING_RESULTS:'Chờ kết quả',CLINICALLY_COMPLETED:'Đã hoàn tất chuyên môn',CLOSED:'Đã đóng lượt khám'};
const visitStages=[['ARRIVAL_PENDING','Tiếp nhận'],['WAITING','Chờ khám'],['IN_PROGRESS','Đang khám'],['AWAITING_RESULTS','Chờ kết quả'],['CLINICALLY_COMPLETED','Hoàn tất chuyên môn'],['CLOSED','Đóng lượt']] as const;
export function DoctorPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState('');
 const [directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState('');
 const [visits,setVisits]=useState<Visit[]|null>(null),[summaries,setSummaries]=useState<Record<string,medical.WorklistSummary>>({}),[selected,setSelected]=useState(''),[reason,setReason]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false);
 const [medicalLock,setMedicalLock]=useState<string|null>(null);
 const [nextAfter,setNextAfter]=useState<string|null>(null);
 const [consultationConfirmed,setConsultationConfirmed]=useState(false);
 const [lastSynced,setLastSynced]=useState<Date|null>(null);
 const [query,setQuery]=useState('');
 const filtered=visits?.filter(v=>!query.trim()||`${v.patient?.fullName??''} ${v.patient?.dateOfBirth??''} ${statusText[v.status]??''} ${v.ticket?.code??''} ${v.consultation?.name??''}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')))??[];
 useNavigationLock(uncertain?'Xác minh hoặc thử lại thao tác khám đang chờ trước khi rời màn hình.':medicalLock??(busy?'Đợi thao tác khám xử lý xong trước khi rời màn hình.':null),onNavigationLock);
 const running=useRef(false),attempt=useRef<Attempt|null>(null);const [medicalVersion,setMedicalVersion]=useState<number|null>(null);
 const scope:Scope={token,clinic:directory?.id??'',branch};const visit=visits?.find(v=>v.id===selected);
 const resultReady=(v:Visit)=>v.status==='AWAITING_RESULTS'&&(summaries[v.id]?.unreviewedResultCount??0)>0;
 const groups=[
  {key:'active',label:'Đang khám',items:filtered.filter(v=>v.status==='IN_PROGRESS')},
  {key:'results',label:'Có kết quả mới',items:filtered.filter(resultReady)},
  {key:'action',label:'Cần xử lý',items:filtered.filter(v=>v.status==='WAITING')},
  {key:'awaiting',label:'Chờ kết quả',items:filtered.filter(v=>v.status==='AWAITING_RESULTS'&&!resultReady(v))},
  {key:'completed',label:'Đã hoàn tất',items:filtered.filter(v=>v.status==='CLINICALLY_COMPLETED')}
 ];
 const actionable=(visits??[]).filter(v=>v.status==='WAITING').length,activeCount=(visits??[]).filter(v=>v.status==='IN_PROGRESS').length,resultCount=(visits??[]).filter(resultReady).length,awaitingCount=(visits??[]).filter(v=>v.status==='AWAITING_RESULTS'&&!resultReady(v)).length;
 const selectVisit=(v:Visit)=>{if(v.id!==selected)setMedicalVersion(null);setSelected(v.id);setReason('');setConsultationConfirmed(false);};
 const waitMinutes=(v:Visit)=>v.checkedInAt?Math.max(0,Math.floor((Date.now()-Date.parse(v.checkedInAt))/60000)):null;
 const operationalLabel=(v:Visit)=>v.status==='IN_PROGRESS'?'ĐANG KHÁM':resultReady(v)?'CÓ KẾT QUẢ':v.ticket?.state==='CALLED'?'ĐÃ GỌI':v.status==='WAITING'?'CHỜ KHÁM':v.status==='AWAITING_RESULTS'?'CHỜ KẾT QUẢ':v.status==='CLINICALLY_COMPLETED'?'ĐÃ HOÀN TẤT':statusText[v.status]??v.status;
 const workRef=(v:Visit)=>v.ticket?.code??v.patient?.fullName??v.id;
 const canCall=(v:Visit)=>{
  if(!v.ticket||v.ticket.state!=='WAITING'||!['WAITING','AWAITING_RESULTS'].includes(v.status)||activeCount>0)return false;
  const samePoint=(visits??[]).filter(item=>item.ticket?.servicePointId===v.ticket!.servicePointId);
  if(samePoint.some(item=>item.id!==v.id&&['CALLED','SERVING'].includes(item.ticket?.state??'')))return false;
  const first=Math.min(...samePoint.filter(item=>item.ticket?.state==='WAITING').map(item=>item.ticket!.number));
  return Number.isFinite(first)&&v.ticket.number===first;
 };
 const worklistAction=(v:Visit)=>{
  const locked=busy||uncertain||!!medicalLock&&selected!==v.id;
  if(v.status==='IN_PROGRESS')return <button type="button" aria-label={'Tiếp tục hồ sơ '+workRef(v)} className="booking-primary" disabled={locked} onClick={()=>selectVisit(v)}>Tiếp tục hồ sơ</button>;
  if(resultReady(v)&&!v.ticket)return <button type="button" aria-label={'Tiếp tục xử lý '+workRef(v)} className="booking-primary" disabled={locked||activeCount>0} onClick={()=>void run(()=>execute('resume-queue',v,'Tiếp tục xử lý sau khi có kết quả'))}>Tiếp tục xử lý</button>;
  if(['WAITING','AWAITING_RESULTS'].includes(v.status)&&v.ticket?.state==='WAITING')return <button type="button" aria-label={(canCall(v)?'Gọi bệnh nhân ':'Chờ lượt trước ')+workRef(v)} className="booking-primary doctor-call-action" disabled={locked||!canCall(v)} onClick={()=>void run(()=>execute('call',v,'Bác sĩ gọi bệnh nhân'))}>{canCall(v)?'Gọi bệnh nhân':'Chờ lượt trước'}</button>;
  if(['WAITING','AWAITING_RESULTS'].includes(v.status)&&v.ticket?.state==='CALLED')return <button type="button" aria-label={(v.status==='AWAITING_RESULTS'?'Tiếp tục xử lý ':'Bắt đầu khám ')+workRef(v)} className="booking-primary" disabled={locked||activeCount>0} onClick={()=>void run(()=>execute('start',v,v.status==='AWAITING_RESULTS'?'Tiếp tục xử lý kết quả':'Bắt đầu khám'))}>{v.status==='AWAITING_RESULTS'?'Tiếp tục xử lý':'Bắt đầu khám'}</button>;
  if(v.status==='AWAITING_RESULTS')return <button type="button" aria-label={'Xem trạng thái '+workRef(v)} disabled={locked} onClick={()=>selectVisit(v)}>Xem trạng thái</button>;
  if(v.status==='CLINICALLY_COMPLETED')return <button type="button" aria-label={'Đóng lượt khám '+workRef(v)} className="booking-primary" disabled={locked||!!v.ticket} onClick={()=>void run(()=>execute('close',v,'Bác sĩ đóng lượt sau khi hoàn tất chuyên môn'))}>Đóng lượt khám</button>;
  return <button type="button" aria-label={'Xem lượt khám '+workRef(v)} disabled={locked} onClick={()=>selectVisit(v)}>Xem lượt khám</button>;
 };
 async function run(body:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await body();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định được kết quả. Danh sách sẽ được đồng bộ lại tự động.');}finally{running.current=false;setBusy(false);}}
 async function login(){
  let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}
  const memberships=await contexts(auth);const ids=[...new Set(memberships.filter(m=>m.role==='DOCTOR').map(m=>m.clinicId))];
  const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
  if(!id)throw new Error('Cần quyền bác sĩ tại một phòng khám. Dùng đường dẫn Workspace được cấp nếu bạn làm việc ở nhiều phòng khám.');
  const d=await care.directory(auth,id);setToken(auth);setDirectory(d);onClinic?.(d.name);
 }
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function loadSummaries(s:Scope,rows:Visit[]){try{const data=await medical.worklistSummaries(s,rows.map(v=>v.id));setSummaries(Object.fromEntries(data.map(item=>[item.encounterId,item])));}catch{setSummaries({});setMessage('Hàng đợi đã tải, nhưng trạng thái kết quả cận lâm sàng đang tạm thời chưa đồng bộ.');}}
 async function chooseBranch(id:string){setQuery('');setNextAfter(null);setBranch(id);setVisits(null);setSummaries({});setSelected('');setReason('');setLastSynced(null);if(!id)return;const s={...scope,branch:id};const v=await care.worklist(s);setVisits(v);setNextAfter(v.length===200?v.at(-1)!.id:null);await loadSummaries(s,v);setLastSynced(new Date());}
 async function refresh(silent=false,context?:SyncContext){
  try{const rows=await care.worklist(scope);let cursor=rows.length===200?rows.at(-1)!.id:null;
   const loadedCount=visits?.length??0;
   while(cursor&&rows.length<loadedCount){const page=await care.worklistPage(scope,cursor);rows.push(...page.items);cursor=page.nextAfter;}
   // Keep the selected encounter mounted even if ordering or pagination moved it.
   // It remains an individually authorized REST read, never an old event payload.
   if(selected&&!rows.some(row=>row.id===selected)){try{rows.push(await care.read(scope,selected));}catch(e){if(!(e instanceof RequestError&&[403,404].includes(e.status)))throw e;}}
   const data:medical.WorklistSummary[]=[];for(let i=0;i<rows.length;i+=200)data.push(...await medical.worklistSummaries(scope,rows.slice(i,i+200).map(v=>v.id)));
   if(context&&!context.current())return;
   setVisits(rows);setNextAfter(cursor);setSummaries(Object.fromEntries(data.map(item=>[item.encounterId,item])));setLastSynced(new Date());
  }catch(e){if(context&&!context.current())return;if(!silent)throw e;setMessage('Chưa đồng bộ được hàng đợi. Hệ thống sẽ thử lại tự động.');throw e;}
 }
 useAuthoritativeSync({key:token+scope.clinic+branch,enabled:!!token&&!!branch,blocked:busy||uncertain,subscriptions:[doctorSubscription(scope,'encounter'),doctorSubscription(scope,'medical')],refresh:context=>refresh(true,context),onDenied:()=>{setVisits(null);setSummaries({});setError('Quyền truy cập đã thay đổi. Xác minh lại phiên đăng nhập.');}});
 async function loadMore(){
  if(!nextAfter)return;
  try{const page=await care.worklistPage(scope,nextAfter);setVisits(current=>{const ids=new Set(current?.map(v=>v.id));return [...current??[],...page.items.filter(v=>!ids.has(v.id))];});const extra=await medical.worklistSummaries(scope,page.items.map(v=>v.id));setSummaries(current=>({...current,...Object.fromEntries(extra.map(item=>[item.encounterId,item]))}));setNextAfter(page.nextAfter);}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){setVisits(null);setNextAfter(null);setSelected('');setMedicalVersion(null);throw new Error('Quyền hoặc dữ liệu vừa thay đổi. Danh sách đang được đồng bộ lại để bạn kiểm tra trước khi tải tiếp.');}throw e;}
 }
 async function execute(action?:care.CareAction,target:Visit|undefined=visit,reasonOverride?:string,versionOverride?:number){
  if(!attempt.current){
   if(!target||!action)return;
   let current=target;
   if(action==='call'){
    current=await care.read(scope,target.id);
    setVisits(rows=>rows?.map(item=>item.id===current.id?current:item)??[current]);
    setSelected(current.id);
    if(current.ticket?.state==='CALLED'){
     setMessage('Bệnh nhân đã được gọi. Có thể bắt đầu khám khi bệnh nhân vào phòng.');
     return;
    }
    if(!['WAITING','AWAITING_RESULTS'].includes(current.status)||current.ticket?.state!=='WAITING'){
     await refresh(true);
     setMessage('Trạng thái lượt khám đã được cập nhật. Hãy tiếp tục theo thao tác đang hiển thị.');
     return;
    }
   }
   const version=versionOverride??medicalVersion;if(action==='complete'&&version===null)return;
   const input={expectedVersion:current.version,reason:(reasonOverride??reason).trim(),...(action==='complete'?{medicalCaseVersion:version!,consultationConfirmed}:{})};
   attempt.current={scope:{...scope},id:current.id,action,input,key:await stableOperationKey('doctor-care',{clinic:scope.clinic,branch,actorEmail:email,id:current.id,action,...input})};
  }
  const original=attempt.current!;
  let result:Visit;try{result=await care.command(original.scope,original.id,original.action,original.input,original.key);}catch(e){
   if(e instanceof RequestError&&e.status===409&&original.action==='call'){
    attempt.current=null;setUncertain(false);
    const latest=await care.read(original.scope,original.id);
    setVisits(rows=>rows?.map(item=>item.id===latest.id?latest:item)??[latest]);setSelected(latest.id);
    if(latest.ticket?.state==='CALLED'){setMessage('Bệnh nhân đã được gọi. Có thể bắt đầu khám khi bệnh nhân vào phòng.');return;}
    await refresh(true);
    throw new Error('Lượt khám vừa được cập nhật trong hàng đợi. Hệ thống đã đồng bộ trạng thái mới; hãy dùng thao tác đang hiển thị.');
   }
   if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUncertain(false);await refresh(true);throw new Error(e.message);}
   setUncertain(true);throw e;
  }
  attempt.current=null;setUncertain(false);setReason('');setVisits(current=>current?.map(v=>v.id===result.id?result:v)??[result]);setSelected(result.id);
  setMessage(original.action==='call'?'Đã gọi bệnh nhân. Có thể bắt đầu khám khi bệnh nhân vào phòng.':original.action==='complete'?'Đã hoàn tất chuyên môn. Lượt khám đã rời nhóm đang xử lý.':original.action==='close'?'Đã đóng lượt khám. Có thể gọi bệnh nhân tiếp theo.':original.action==='await-results'?'Đã chuyển sang chờ kết quả và nhường lượt khám hiện tại.':original.action==='resume-queue'?'Đã đưa lượt có kết quả trở lại hàng đợi để tiếp tục xử lý.':'Đã bắt đầu hoặc tiếp tục khám.');
  await refresh(true);
 }
 function logout(){setNextAfter(null);setToken('');setDirectory(null);setVisits(null);setSummaries({});setBranch('');setSelected('');setReason('');setPassword('');setUncertain(false);attempt.current=null;setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}
 return <section className="booking-panel reception-panel doctor-panel" aria-labelledby="doctor-title">
  <header className="task-panel-header"><div><span className="eyebrow">Khám bệnh</span><h1 id="doctor-title">Hàng đợi khám của bác sĩ</h1>
  <p>Ưu tiên lượt đang khám, kết quả mới cần xem và bệnh nhân đang chờ được gọi.</p></div></header>
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
   </div>
   {medicalLock&&!onNavigationLock&&<p role="status">{medicalLock}</p>}
   {uncertain&&<div role="status"><p>Chưa nhận được xác nhận. Yêu cầu được giữ nguyên để thử lại; bạn có thể tải lại hàng đợi để đối chiếu.</p><button type="button" disabled={busy} onClick={()=>void run(()=>execute())}>Thử lại thao tác khám đang chờ</button></div>}
   {visits?.length===0&&<p role="status">Chưa có lượt khám được phân công tại địa điểm này.</p>}
   <div className="doctor-layout">
   <fieldset className="reception-actions doctor-queue doctor-operational-worklist" disabled={busy||uncertain}>
    <legend className="sr-only">Hàng đợi khám hôm nay</legend>
    <div className="doctor-worklist-header"><div><strong>Hàng đợi hôm nay</strong><div className="doctor-worklist-metrics"><span>Cần xử lý <b>{actionable}</b></span><span>Đang khám <b>{activeCount}</b></span><span>Có kết quả <b>{resultCount}</b></span><span>Chờ kết quả <b>{awaitingCount}</b></span></div></div><div className="doctor-worklist-refresh"><small>{visits===null?'Đang tải…':lastSynced?'Cập nhật '+lastSynced.toLocaleTimeString('vi-VN'):'Sẵn sàng'}</small><button type="button" aria-label="Cập nhật hàng đợi" title="Cập nhật hàng đợi" disabled={busy||!!medicalLock||!branch} onClick={()=>void run(()=>refresh())}>↻</button></div></div>
    <label className="doctor-worklist-search">Tìm trong hàng đợi<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tên, ngày sinh, số lượt hoặc dịch vụ…" disabled={busy||uncertain||!!medicalLock}/></label>
    {visits&&filtered.length===0&&visits.length>0&&<p className="task-empty" role="status">Không có lượt khớp tìm kiếm.</p>}
    <div className="doctor-worklist-groups">{groups.map(group=>group.items.length>0&&<section className={'doctor-work-group is-'+group.key} key={group.key} aria-labelledby={'work-group-'+group.key}><header><h3 id={'work-group-'+group.key}>{group.label}</h3><span>{group.items.length}</span></header><ul className="doctor-worklist">{group.items.map(v=>{const summary=summaries[v.id],wait=waitMinutes(v);return <li key={v.id} data-work-state={group.key} className={selected===v.id?'worklist-selected':''}>
      <div className="doctor-work-item-top"><span className="doctor-ticket-code">{v.ticket?.code??'Không có số lượt'}</span>{group.key==='action'&&<span className="task-status" data-state={v.ticket?.state==='CALLED'?'CALLED':'WAITING'}>{v.ticket?.state==='CALLED'?'ĐÃ GỌI':'CHỜ KHÁM'}</span>}</div>
      <PatientIdentity patient={v.patient}/>
      <div className="doctor-work-meta"><span>{v.consultation?.name??'Dịch vụ khám chưa xác định'}</span><span>{v.appointmentId?'Đặt lịch':'Khám trực tiếp'}</span>{v.checkedInAt&&<span>Tiếp nhận {new Date(v.checkedInAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</span>}</div>
      {v.status==='WAITING'&&wait!==null&&<small>Đã chờ {wait} phút</small>}
      {summary?.unreviewedResultCount>0&&<div className="doctor-result-signal"><strong>{summary.latestResultName??'Kết quả cận lâm sàng'}</strong><span>Đã có kết quả{summary.latestResultAt?' · '+new Date(summary.latestResultAt).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):''}</span><small>Chưa được bác sĩ xem xét</small></div>}
      {v.status==='AWAITING_RESULTS'&&!summary?.unreviewedResultCount&&summary?.pendingOrderCount>0&&<small>{summary.pendingOrderCount} chỉ định đang chờ kết quả</small>}
      <div className="doctor-work-actions">{worklistAction(v)}{v.status!=='IN_PROGRESS'&&<button type="button" aria-label={(v.status==='CLINICALLY_COMPLETED'?'Xem hồ sơ ':'Xem chi tiết ')+workRef(v)} className="doctor-secondary-action" disabled={!!medicalLock&&selected!==v.id} onClick={()=>selectVisit(v)}>{v.status==='CLINICALLY_COMPLETED'?'Xem hồ sơ':'Xem chi tiết'}</button>}</div>
     </li>;})}</ul></section>)}</div>
    {nextAfter&&<button type="button" className="doctor-load-more" disabled={!!medicalLock} onClick={()=>void run(loadMore)}>Tải thêm lượt khám</button>}
   </fieldset>
   <div className="doctor-case">{visit&&<section className="patient-hub" aria-labelledby="patient-hub-title"><div className="patient-banner"><div className="patient-hub-title"><span className="eyebrow">Hồ sơ đang mở</span><h2 id="patient-hub-title">{visit.patient?.fullName??'Bệnh nhân'}</h2></div><span className="task-status" data-state={visit.status}>{statusText[visit.status]??'Lượt khám'}</span><div className="patient-hub-meta"><PatientIdentity patient={visit.patient}/>{visit.ticket?.code&&<span className="patient-hub-token">Số lượt {visit.ticket.code}</span>}{visit.consultation?.name&&<span>{visit.consultation.name}</span>}</div></div><ol className="visit-progress" aria-label="Tiến trình lượt khám">{visitStages.map(([key,label],index)=>{const current=visitStages.findIndex(([stage])=>stage===visit.status);return <li key={key} data-state={index<current?'complete':index===current?'current':'upcoming'} aria-current={index===current?'step':undefined}><span>{index+1}</span>{label}</li>;})}</ol></section>}
   {visit&&<section className="doctor-encounter-actions" aria-label="Thao tác lượt khám đang chọn">
    <div className="doctor-encounter-action-head"><div><span className="eyebrow">Thao tác tiếp theo</span><h2>{operationalLabel(visit)}</h2></div>{visit.appointmentId?<span className="doctor-source-label">Đặt lịch</span>:<span className="doctor-source-label">Khám trực tiếp</span>}</div>
    {visit.consultation&&<div className="consultation-review"><h3>Dịch vụ khám đã tiếp nhận</h3><p>{visit.consultation.name} · {formatVnd(visit.consultation.price.amountVnd)}</p>{visit.status==='IN_PROGRESS'&&<label><input type="checkbox" checked={consultationConfirmed} onChange={e=>setConsultationConfirmed(e.target.checked)}/>Tôi đã xem lại và thực hiện dịch vụ khám này</label>}{visit.consultationPerformedAt&&<p>Đã xác nhận thực hiện dịch vụ.</p>}</div>}
    <div className="doctor-encounter-action-row">
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket?.state==='WAITING'&&<button type="button" className="booking-primary doctor-call-action" disabled={busy||uncertain||!!medicalLock||!canCall(visit)} onClick={()=>void run(()=>execute('call',visit,'Bác sĩ gọi bệnh nhân'))}>{canCall(visit)?'Gọi bệnh nhân':'Chờ lượt trước'}</button>}
     {['WAITING','AWAITING_RESULTS'].includes(visit.status)&&visit.ticket?.state==='CALLED'&&<button type="button" className="booking-primary" disabled={busy||uncertain||!!medicalLock||activeCount>0} onClick={()=>void run(()=>execute('start',visit,visit.status==='AWAITING_RESULTS'?'Tiếp tục xử lý kết quả':'Bắt đầu khám'))}>{visit.status==='AWAITING_RESULTS'?'Tiếp tục xử lý':'Bắt đầu khám'}</button>}
     {visit.status==='AWAITING_RESULTS'&&!visit.ticket&&resultReady(visit)&&<button type="button" className="booking-primary" disabled={busy||uncertain||!!medicalLock||activeCount>0} onClick={()=>void run(()=>execute('resume-queue',visit,'Tiếp tục xử lý sau khi có kết quả'))}>Tiếp tục xử lý</button>}
     {visit.status==='IN_PROGRESS'&&<button type="button" disabled={busy||uncertain||!!medicalLock||medicalVersion!==null} onClick={()=>void run(()=>execute('await-results',visit,'Chờ kết quả chỉ định'))}>Chuyển sang chờ kết quả</button>}
      {visit.status==='CLINICALLY_COMPLETED'&&<button type="button" className="booking-primary" disabled={busy||uncertain||!!medicalLock||!!visit.ticket} onClick={()=>void run(()=>execute('close',visit,'Bác sĩ đóng lượt sau khi hoàn tất chuyên môn'))}>Đóng lượt khám</button>}
    </div>
    {visit.status==='AWAITING_RESULTS'&&!resultReady(visit)&&<p className="doctor-action-guidance">Lượt khám đang chờ kết quả nên không chiếm phiên khám đang hoạt động. Khi có kết quả, lượt này sẽ được đưa vào nhóm “Có kết quả mới”.</p>}
    {visit.status==='CLINICALLY_COMPLETED'&&<p className="doctor-action-guidance">Công việc chuyên môn đã hoàn tất. Đóng lượt để đưa hồ sơ ra khỏi hàng đợi vận hành và tiếp tục gọi bệnh nhân tiếp theo.</p>}
    {activeCount>0&&visit.status!=='IN_PROGRESS'&&['WAITING','AWAITING_RESULTS'].includes(visit.status)&&<p className="doctor-action-guidance">Đang có một bệnh nhân được khám. Hãy hoàn tất hoặc chuyển lượt đang khám sang chờ kết quả trước khi bắt đầu lượt khác.</p>}
   </section>}
   {visit&&['IN_PROGRESS','AWAITING_RESULTS','CLINICALLY_COMPLETED'].includes(visit.status)&&<AsyncPanel key={scope.clinic+scope.branch+visit.id} label="Đang mở hồ sơ khám…"><MedicalPanel scope={scope} id={visit.id} status={visit.status} onValidated={setMedicalVersion} onNavigationLock={setMedicalLock} onWorklistChanged={()=>void refresh(true)} completionBlockReason={visit.status==='IN_PROGRESS'&&visit.consultation&&!consultationConfirmed?'Cần xác nhận đã xem lại và thực hiện dịch vụ khám trước khi hoàn tất chuyên môn.':undefined} onComplete={visit.status==='IN_PROGRESS'?async version=>{await execute('complete',visit,'Hoàn tất chuyên môn',version);}:undefined}/></AsyncPanel>}
   {!visit&&branch&&<p className="doctor-selection-hint">Chọn một lượt trong danh sách để xem hồ sơ và thao tác khám.</p>}
   </div></div>
  </>}
 </section>;
}

