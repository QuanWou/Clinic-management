import {useAuthoritativeSync} from './useAuthoritativeSync';
import {receptionSubscription} from '../api/realtime';
import {DatePreview} from './DatePreview';
import {AlertTriangle,CheckCircle2,ClipboardCheck,RefreshCw,Stethoscope,Wallet,UsersRound} from 'lucide-react';
import {usePanelSession} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import {useEffect,useRef,useState} from 'react';
import {signIn} from '../api/booking';
import {contexts,directory,type Directory,type Scope} from '../api/reception';
import * as api from '../api/operations';
import * as config from '../api/configuration';
import {AdminTrendChart,type AdminTrendPoint} from './AdminTrendChart';

export type OperationsMode='overview'|'operations'|'finance'|'exceptions';
type Row={
 id:string;name:string;
 encounter:api.EncounterSummary|null;
 billing:api.BillingSummary|null;
 exceptions:api.OperationalException[];
 missingSchedule:number;
 unlinkedDoctors:number;
 servicesWithoutPrice:number;
 sourceErrors:number;
};
type Attention={key:string;level:'warning'|'danger'|'info';title:string;detail:string;branch:string};

const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateWindow=(end:string,count=7)=>Array.from({length:count},(_,index)=>{const source=new Date(`${end}T12:00:00+07:00`);source.setUTCDate(source.getUTCDate()-(count-1-index));const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(source);return {date,label:`${date.slice(8,10)}/${date.slice(5,7)}`};});
const currentPrice=(prices:config.Price[])=>prices.filter(p=>new Date(p.effectiveFrom).getTime()<=Date.now()).sort((a,b)=>new Date(b.effectiveFrom).getTime()-new Date(a.effectiveFrom).getTime())[0];
const titleByMode:Record<OperationsMode,[string,string,string]>={
 overview:['TỔNG QUAN','Tổng quan vận hành','Tình hình hôm nay, các vấn đề cần xử lý và trạng thái tài chính của phòng khám.'],
 operations:['GIÁM SÁT','Vận hành hôm nay','Theo dõi trạng thái tiếp nhận và luồng khám. Đây là màn giám sát, không thay thế quầy lễ tân.'],
 finance:['GIÁM SÁT','Tài chính & đối soát','Theo dõi thực thu, khoản phải thu, ca thu và giao dịch cần đối chiếu.'],
 exceptions:['GIÁM SÁT','Ngoại lệ cần xử lý','Tập trung các ngoại lệ vận hành và cấu hình cần quyền Quản trị phòng khám.']
};

export function OperationsPanel({onClinic,mode='overview'}:{onClinic?:(name:string)=>void;mode?:OperationsMode}) {
 const shared=usePanelSession(login);
 const [token,setToken]=useState(''),[clinic,setClinic]=useState<Directory|null>(null),[date,setDate]=useState(today);
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rows,setRows]=useState<Row[]|null>(null),[trend,setTrend]=useState<AdminTrendPoint[]|null>(null),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const epoch=useRef(0);

 async function login(){
  if(busy)return;const current=++epoch.current;setBusy(true);setError('');setRows(null);
  try{
   const access=shared?.workspaceSession?.token??(await signIn(email,password)).data.accessToken;
   setEmail(shared?.workspaceSession?.email??email);setPassword('');
   const memberships=(await contexts(access)).filter(m=>m.role==='ADMIN');
   const ids=[...new Set(memberships.map(m=>m.clinicId))];
   const requested=new URLSearchParams(location.search).get('clinicId');
   const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;
   if(!id)throw new Error('Màn quản trị cần quyền Quản trị tại phòng khám trên đường dẫn Workspace.');
   const c=await directory(access,id);if(current!==epoch.current)return;
   setToken(access);setClinic(c);onClinic?.(c.name);
  }catch(e){if(current===epoch.current){setToken('');setClinic(null);setError(e instanceof Error?e.message:'Không thể mở dữ liệu quản trị.');}}
  finally{if(current===epoch.current)setBusy(false);}
 }

 async function reload(background=false){
  if(busy||!clinic)return;const current=++epoch.current;setBusy(true);setError('');
  try{
   const [source,memberships,staff]=await Promise.all([directory(token,clinic.id),contexts(token),config.staff({token,clinic:clinic.id})]);
   if(current!==epoch.current)return;
   setClinic(source);
   const admin=memberships.filter(m=>m.clinicId===source.id&&m.role==='ADMIN');
   const all=admin.some(m=>m.allBranches);
   const branchIds=new Set(admin.flatMap(m=>m.branchIds??[]));
   const chosen=source.branches.filter(b=>b.active!==false&&(all||branchIds.has(b.id)));
   if(!chosen.length)throw new Error('Không còn địa điểm nào trong phạm vi quản trị được cấp.');

   const list=await Promise.all(chosen.map(async b=>{
    const scope:Scope={token,clinic:source.id,branch:b.id};
    const [encounterResult,billingResult,exceptionResult,affResult,assignmentResult]=await Promise.allSettled([
     api.encounters(scope,date),api.billing(scope,date),api.exceptions(scope),config.affiliations(scope),config.assignments(scope)
    ]);
    const affiliations=affResult.status==='fulfilled'?affResult.value:[];
    const activeAffiliations=affiliations.filter(a=>a.active);
    const scheduleResults=await Promise.allSettled(activeAffiliations.map(a=>config.schedules(scope,a.id)));
    const missingSchedule=activeAffiliations.filter((_,i)=>{
     const result=scheduleResults[i];
     return result.status!=='fulfilled'||!result.value.schedules.some(s=>s.active&&s.effectiveFrom<=date&&(!s.effectiveUntil||s.effectiveUntil>date));
    }).length;
    const linkedUsers=new Set(affiliations.map(a=>a.userId));
    const unlinkedDoctors=staff.filter(row=>row.membership.role==='DOCTOR'&&row.membership.status==='ACTIVE'&&(row.membership.allBranches||row.membership.branchIds.includes(b.id))&&!linkedUsers.has(row.membership.userId)).length;
    const assignments=assignmentResult.status==='fulfilled'?assignmentResult.value:[];
    const priceResults=await Promise.allSettled(assignments.filter(a=>a.active).map(a=>config.prices(scope,a.offering.id)));
    const servicesWithoutPrice=assignments.filter(a=>a.active).reduce((count,_,i)=>{
     const result=priceResults[i];return count+(result.status!=='fulfilled'||!currentPrice(result.value)?1:0);
    },0);
    return {
     id:b.id,name:b.name,
     encounter:encounterResult.status==='fulfilled'?encounterResult.value:null,
     billing:billingResult.status==='fulfilled'?billingResult.value:null,
     exceptions:exceptionResult.status==='fulfilled'?exceptionResult.value:[],
     missingSchedule,unlinkedDoctors,servicesWithoutPrice,
     sourceErrors:[encounterResult,billingResult,exceptionResult,affResult,assignmentResult].filter(result=>result.status==='rejected').length
    } satisfies Row;
   }));
   let history:AdminTrendPoint[]|null=null;
    if(mode==='overview'){
     history=await Promise.all(dateWindow(date).map(async period=>{
      const summaries=await Promise.allSettled(chosen.map(branch=>api.encounters({token,clinic:source.id,branch:branch.id},period.date)));
      return summaries.reduce<AdminTrendPoint>((point,result)=>{
       if(result.status==='fulfilled'){
        point.checkedIn=Number(point.checkedIn)+result.value.checkedIn;
        point.completed=Number(point.completed)+result.value.completed;
       }
       return point;
      },{label:period.label,checkedIn:0,completed:0});
     }));
    }
    if(current===epoch.current){setRows(list);setTrend(history);setLastUpdated(new Date());}
  }catch(e){if(current===epoch.current){setRows(null);setTrend(null);setError(e instanceof Error?e.message:'Không thể tải dữ liệu quản trị.');}if(background)throw e;}
  finally{if(current===epoch.current)setBusy(false);}
 }

 function logout(){epoch.current++;setToken('');setClinic(null);setRows(null);setTrend(null);setLastUpdated(null);setPassword('');setError('');setBusy(false);onClinic?.('Phòng khám theo phiên đăng nhập');}
 useEffect(()=>{let active=true;if(shared&&token&&clinic)queueMicrotask(()=>{if(active)void reload();});return()=>{active=false;};},[!!shared,token,clinic?.id,date,mode]);

 useAuthoritativeSync({key:token+(clinic?.id??'')+date,enabled:!!token&&!!clinic,blocked:busy,subscriptions:(rows??[]).flatMap(row=>['encounter','billing','appointment'].map(source=>receptionSubscription({token,clinic:clinic!.id,branch:row.id},source as 'encounter'|'billing'|'appointment'))),refresh:async context=>{
  if(!rows||!context.sources?.length){await reload(true);return;}
  const current=epoch.current,changed=context.sources??[];const needs=(source:string)=>!changed.length||changed.includes(source as 'encounter'|'billing'|'appointment');
  const updated=await Promise.all((rows??[]).map(async row=>{
   const scope:Scope={token,clinic:clinic!.id,branch:row.id};const [encounter,billing,exceptions]=await Promise.all([needs('encounter')?api.encounters(scope,date):Promise.resolve(row.encounter),needs('billing')?api.billing(scope,date):Promise.resolve(row.billing),needs('appointment')?api.exceptions(scope):Promise.resolve(row.exceptions)]);
   return {...row,encounter,billing,exceptions};
  }));if(context.current()&&current===epoch.current){setRows(updated);setLastUpdated(new Date());}
 },onDenied:()=>{epoch.current++;setRows(null);setError('Quyền truy cập vận hành đã thay đổi.');}});
 const encounterComplete=!!rows&&rows.every(row=>!!row.encounter),billingComplete=!!rows&&rows.every(row=>!!row.billing);
 const sumEncounter=(field:keyof api.EncounterSummary)=>encounterComplete?rows!.reduce((v,r)=>v+(typeof r.encounter?.[field]==='number'?Number(r.encounter[field]):0),0):'—';
 const collected=rows?.reduce((v,r)=>v+(r.billing?r.billing.collectedCashVnd+r.billing.collectedBankVnd+r.billing.collectedPosVnd+(r.billing.collectedOnlineVnd??0):0),0)??0;
 const outstanding=rows?.reduce((v,r)=>v+(r.billing?.outstandingVnd??0),0)??0;
 const attention:Attention[]=(rows??[]).flatMap(r=>[
  ...r.exceptions.map(ex=>({key:ex.id,level:'warning' as const,title:ex.type==='DOCTOR_ABSENT'?'Bác sĩ vắng mặt cần điều phối':'Ngoại lệ lịch hẹn cần xem xét',detail:`Mã lịch hẹn ${ex.appointmentId} · Trạng thái ${ex.state}`,branch:r.name})),
  ...(r.unlinkedDoctors?[{key:r.id+'-doctor-link',level:'danger' as const,title:`${r.unlinkedDoctors} tài khoản Bác sĩ chưa có hồ sơ chuyên môn`,detail:'Role IAM và cấu hình Doctor Service đang không nhất quán.',branch:r.name}]:[]),
  ...(r.missingSchedule?[{key:r.id+'-schedule',level:'warning' as const,title:`${r.missingSchedule} bác sĩ đang hoạt động chưa có lịch hiệu lực`,detail:'Booking có thể không tạo được khả dụng cho các bác sĩ này.',branch:r.name}]:[]),
  ...(r.servicesWithoutPrice?[{key:r.id+'-price',level:'warning' as const,title:`${r.servicesWithoutPrice} dịch vụ đang cung cấp chưa có giá hiệu lực`,detail:'Dịch vụ cần một phiên bản giá hợp lệ trước khi vận hành đầy đủ.',branch:r.name}]:[]),
  ...((r.billing?.submittedShifts??0)>0?[{key:r.id+'-shift',level:'info' as const,title:`${r.billing!.submittedShifts} ca thu chờ đối soát`,detail:'Ca đã gửi cần được người có thẩm quyền kiểm tra.',branch:r.name}]:[]),
  ...((r.billing?.paymentReviews??0)>0?[{key:r.id+'-payments',level:'warning' as const,title:`${r.billing!.paymentReviews} giao dịch cần đối chiếu`,detail:'Trạng thái thanh toán đang yêu cầu review.',branch:r.name}]:[]),
  ...(r.sourceErrors?[{key:r.id+'-source',level:'danger' as const,title:'Một phần dữ liệu giám sát chưa tải được',detail:`${r.sourceErrors} nguồn dữ liệu cần kiểm tra lại.`,branch:r.name}]:[])
 ]);

 const [kicker,title,description]=titleByMode[mode];
 return <section className="booking-panel operations-panel admin-operations-panel">
  <header className="task-panel-header"><div><span className="eyebrow">{kicker}</span><h1>{title}</h1><p>{description}</p></div></header>
  {busy&&<p role="status">Đang cập nhật dữ liệu vận hành…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void login()}/>:!token?<form className="booking-form" onSubmit={e=>{e.preventDefault();void login();}}><label>Email quản trị<input type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu<input type="password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="booking-primary">Đăng nhập</button></form>:<>
   {!shared&&<button onClick={logout}>Đăng xuất</button>}
   <div className="admin-monitor-toolbar"><label>Ngày theo dõi<input type="date" aria-label="Ngày vận hành" value={date} disabled={busy} onChange={e=>{epoch.current++;setRows(null);setTrend(null);setLastUpdated(null);setDate(e.target.value);}}/><DatePreview value={date}/></label><span className="admin-refresh-meta">Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật dữ liệu vận hành" title="Cập nhật dữ liệu vận hành" disabled={busy} onClick={()=>void reload()}><RefreshCw size={17}/></button></div>

   {mode==='overview'&&rows&&<div className="admin-overview">
    <section className="admin-snapshot" aria-label="Vận hành hôm nay">
     <div className="admin-section-heading"><div><span className="eyebrow">VẬN HÀNH HÔM NAY</span><h2>Ảnh chụp hoạt động</h2></div><span className="task-status" data-state={attention.length?'WAITING':'ACTIVE'}>{attention.length?attention.length+' mục cần chú ý':'Ổn định'}</span></div>
     <div className="admin-snapshot-grid">
      <div><UsersRound size={18}/><span>Đã tiếp nhận</span><strong>{sumEncounter('checkedIn')}</strong></div>
      <div><Stethoscope size={18}/><span>Đang chờ</span><strong>{sumEncounter('waitingTickets')}</strong></div>
      <div><Stethoscope size={18}/><span>Đang khám</span><strong>{sumEncounter('servingTickets')}</strong></div>
      <div><ClipboardCheck size={18}/><span>Chờ kết quả</span><strong>{sumEncounter('awaitingResults')}</strong></div>
      <div><CheckCircle2 size={18}/><span>Hoàn tất</span><strong>{sumEncounter('completed')}</strong></div>
     </div>
    </section>
    <section className="admin-attention">
     <div className="admin-section-heading"><div><span className="eyebrow">CẦN XỬ LÝ</span><h2>Việc cần sự chú ý của quản trị</h2></div></div>
     {attention.length?<ul className="admin-attention-list">{attention.slice(0,8).map(item=><li key={item.key} data-level={item.level}><AlertTriangle size={18}/><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.branch}</small></div></li>)}</ul>:<div className="task-empty"><p>Không có vấn đề cần xử lý.</p></div>}
    </section>
    {trend&&<AdminTrendChart title="Xu hướng lượt khám 7 ngày" description="Số lượt đã tiếp nhận và hoàn tất theo từng ngày, tổng hợp từ tất cả địa điểm trong phạm vi quản trị." data={trend} series={[{key:'checkedIn',label:'Đã tiếp nhận'},{key:'completed',label:'Hoàn tất'}]}/>}
     <section className="admin-finance-strip"><div><span>Đã thu</span><strong>{billingComplete?money(collected):'—'}</strong></div><div><span>Còn phải thu</span><strong>{billingComplete?money(outstanding):'—'}</strong></div><div><span>Ca đang mở</span><strong>{billingComplete?rows.reduce((v,r)=>v+(r.billing?.openShifts??0),0):'—'}</strong></div><div><span>Chờ đối soát</span><strong>{billingComplete?rows.reduce((v,r)=>v+(r.billing?.submittedShifts??0)+(r.billing?.paymentReviews??0),0):'—'}</strong></div></section>
   </div>}

   {mode==='operations'&&<section className="admin-monitor-list"><div className="admin-section-heading"><div><h2>Trạng thái theo địa điểm</h2><p>Chỉ hiển thị metadata vận hành, không đọc nội dung hồ sơ lâm sàng.</p></div></div>{rows?.map(r=><article key={r.id} className="admin-monitor-row"><div><strong>{r.name}</strong><small>{r.encounter?'Cập nhật '+new Date(r.encounter.measuredAt).toLocaleTimeString('vi-VN'):'Nguồn vận hành chưa sẵn sàng'}</small></div><dl><div><dt>Chờ</dt><dd>{r.encounter?.waitingTickets??'—'}</dd></div><div><dt>Đang khám</dt><dd>{r.encounter?.servingTickets??'—'}</dd></div><div><dt>Chờ kết quả</dt><dd>{r.encounter?.awaitingResults??'—'}</dd></div><div><dt>Chưa đóng</dt><dd>{r.encounter?.openVisits??'—'}</dd></div></dl></article>)}</section>}

   {mode==='finance'&&<section className="admin-monitor-list"><div className="admin-section-heading"><div><h2>Tài chính theo địa điểm</h2><p>Màn giám sát/đối soát; không cung cấp thao tác thu tiền.</p></div></div>{rows?.map(r=><article key={r.id} className="admin-monitor-row admin-finance-row"><div><strong>{r.name}</strong><small>{r.billing?.receiptCount??'—'} khoản thu trong ngày</small></div><dl><div><dt>Thực thu</dt><dd>{r.billing?money(r.billing.collectedCashVnd+r.billing.collectedBankVnd+r.billing.collectedPosVnd+(r.billing.collectedOnlineVnd??0)):'—'}</dd></div><div><dt>Phải thu</dt><dd>{r.billing?money(r.billing.outstandingVnd):'—'}</dd></div><div><dt>Ca mở</dt><dd>{r.billing?.openShifts??'—'}</dd></div><div><dt>Chờ đối soát</dt><dd>{r.billing?(r.billing.submittedShifts??0)+(r.billing.paymentReviews??0):'—'}</dd></div></dl></article>)}</section>}

   {mode==='exceptions'&&<section className="admin-attention admin-exception-center"><div className="admin-section-heading"><div><h2>Danh sách ngoại lệ</h2><p>Nguồn thật từ vận hành, lịch bác sĩ, cấu hình nhân sự/dịch vụ và tài chính.</p></div></div>{attention.length?<ul className="admin-attention-list">{attention.map(item=><li key={item.key} data-level={item.level}><AlertTriangle size={18}/><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.branch}</small></div></li>)}</ul>:<div className="task-empty"><p>Không có vấn đề cần xử lý.</p></div>}</section>}
  </>}
 </section>;
}
