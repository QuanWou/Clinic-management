import {useAuthoritativeSync} from './useAuthoritativeSync';
import {receptionSubscription} from '../api/realtime';
import {useEffect,useMemo,useRef,useState} from 'react';
import {BadgeDollarSign,CheckCircle2,RefreshCw,WalletCards} from 'lucide-react';
import {useSession} from '../auth/SessionProvider';
import type {Scope} from '../api/reception';
import * as billing from '../api/billing';
import * as operations from '../api/operations';
import * as configuration from '../api/configuration';
import {stableOperationKey} from '../api/idempotency';
import {AdminBars,AdminTrendChart,type AdminTrendPoint} from './AdminTrendChart';

type BranchFinance={
 id:string;
 name:string;
 summary:operations.BillingSummary|null;
 shifts:billing.Shift[];
 error:string|null;
};

const money=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(value);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const dateWindow=(end:string,count=7)=>Array.from({length:count},(_,index)=>{const source=new Date(`${end}T12:00:00+07:00`);source.setUTCDate(source.getUTCDate()-(count-1-index));const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(source);return {date,label:`${date.slice(8,10)}/${date.slice(5,7)}`};});
const compactMoney=(value:number)=>new Intl.NumberFormat('vi-VN',{notation:'compact',maximumFractionDigits:1}).format(value)+' ₫';

export function AdminFinancePanel({clinicId,onClinic}:{clinicId:string;onClinic?:(name:string)=>void}){
 const auth=useSession()!,session=auth.workspaceSession;
 const [date,setDate]=useState(today),[rows,setRows]=useState<BranchFinance[]|null>(null),[names,setNames]=useState<Map<string,string>>(new Map()),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[trend,setTrend]=useState<AdminTrendPoint[]>([]),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const [approving,setApproving]=useState<{branch:string;shift:billing.Shift}|null>(null),[reason,setReason]=useState('');
 const token=session?.token??'';
 const syncScope=useRef('');syncScope.current=token+clinicId+date;
 const allowedBranch=(id:string)=>session?.contexts.some(context=>context.clinicId===clinicId&&context.role==='ADMIN'&&(context.allBranches||context.branchIds.includes(id)));
 const submitted=useMemo(()=>rows?.flatMap(r=>r.shifts.filter(s=>s.state==='SUBMITTED').map(shift=>({branch:r,shift})))??[],[rows]);

 useAuthoritativeSync({key:token+clinicId+date,enabled:!!token,blocked:busy||!!approving||!!reason,subscriptions:(rows??[]).filter(row=>allowedBranch(row.id)).map(row=>receptionSubscription({token,clinic:clinicId,branch:row.id},'billing')),refresh:async context=>{
  if(!rows){await load(true);return;}
  const next=await Promise.all((rows??[]).filter(row=>allowedBranch(row.id)).map(async row=>{const scope:Scope={token,clinic:clinicId,branch:row.id};const [summary,shifts]=await Promise.all([operations.billing(scope,date),billing.shifts(scope)]);return {...row,summary,shifts,error:null};}));
  if(context.current()){setRows(next);setLastUpdated(new Date());}
 },onDenied:()=>{setRows(null);setError('Quyền truy cập tài chính đã thay đổi.');}});
 async function load(background=false){
  if(!token||busy)return;
  const original=syncScope.current;setBusy(true);setError('');setNotice('');
  try{
   const [clinic,staff]=await Promise.all([billing.directory(token,clinicId),configuration.staff({token,clinic:clinicId})]);
   if(original!==syncScope.current)return;
   onClinic?.(clinic.name);
   setNames(new Map(staff.map(row=>[row.membership.userId,row.account?.fullName??row.account?.email??row.membership.userId])));
   const active=clinic.branches.filter(branch=>branch.active&&allowedBranch(branch.id));
   const next=await Promise.all(active.map(async branch=>{
    const scope:Scope={token,clinic:clinicId,branch:branch.id};
    const [summary,shifts]=await Promise.allSettled([operations.billing(scope,date),billing.shifts(scope)]);
    return {
     id:branch.id,name:branch.name,
     summary:summary.status==='fulfilled'?summary.value:null,
     shifts:shifts.status==='fulfilled'?shifts.value:[],
     error:summary.status==='rejected'||shifts.status==='rejected'?'Một nguồn tài chính của chi nhánh chưa tải được.':null
    } satisfies BranchFinance;
   }));
   const history=await Promise.all(dateWindow(date).map(async period=>{
     const summaries=await Promise.allSettled(active.map(branch=>operations.billing({token,clinic:clinicId,branch:branch.id},period.date)));
     return summaries.reduce<AdminTrendPoint>((point,result)=>{
      if(result.status==='fulfilled'){
       const value=result.value;
       point.issued=Number(point.issued)+value.issuedVnd;
       point.collected=Number(point.collected)+value.collectedCashVnd+value.collectedBankVnd+value.collectedPosVnd+(value.collectedOnlineVnd??0);
       point.outstanding=Number(point.outstanding)+value.outstandingVnd;
      }
      return point;
     },{label:period.label,issued:0,collected:0,outstanding:0});
    }));
    if(original!==syncScope.current)return;setRows(next);setTrend(history);setLastUpdated(new Date());
  }catch(e){if(original!==syncScope.current)return;setRows(null);setTrend([]);setError(e instanceof Error?e.message:'Không thể tải giám sát tài chính.');if(background)throw e;}
  finally{if(original===syncScope.current)setBusy(false);}
 }

 useEffect(()=>{void load();},[token,clinicId,date]);

 async function approve(){
  if(!approving||!reason.trim()||busy)return;
  setBusy(true);setError('');setNotice('');
  try{
   const scope:Scope={token,clinic:clinicId,branch:approving.branch};
   const key=await stableOperationKey('admin-shift-approve',{clinic:clinicId,branch:approving.branch,shift:approving.shift.id,version:approving.shift.version,reason:reason.trim()});
   await billing.approve(scope,approving.shift.id,approving.shift.version,reason.trim(),key);
   setApproving(null);setReason('');setNotice('Ca thu đã được duyệt và ghi nhận tại nguồn tài chính.');
   setBusy(false);await load();return;
  }catch(e){setError(e instanceof Error?e.message:'Không thể duyệt ca thu.');}
  finally{setBusy(false);}
 }

 const totals=(rows??[]).reduce((sum,row)=>{
  const value=row.summary;
  if(!value)return sum;
  sum.issued+=value.issuedVnd;
  sum.collected+=value.collectedCashVnd+value.collectedBankVnd+value.collectedPosVnd+(value.collectedOnlineVnd??0);
  sum.outstanding+=value.outstandingVnd;
  sum.reviews+=value.paymentReviews??0;
  return sum;
 },{issued:0,collected:0,outstanding:0,reviews:0});
 const totalsComplete=!!rows&&rows.every(row=>!row.error&&!!row.summary);
 const paymentMix=(rows??[]).reduce((sum,row)=>{const value=row.summary;if(!value)return sum;sum.cash+=value.collectedCashVnd;sum.bank+=value.collectedBankVnd;sum.pos+=value.collectedPosVnd;sum.online+=value.collectedOnlineVnd??0;return sum;},{cash:0,bank:0,pos:0,online:0});

 return <section className="booking-panel reception-panel doctor-panel operations-panel">
  <header className="task-panel-header admin-page-header"><div><span className="eyebrow">GIÁM SÁT</span><h1>Tài chính & đối soát</h1><p>Quản trị xem số liệu tổng hợp, theo dõi ca thu và duyệt đối soát. Màn này không mở ca thu và không nhận tiền bệnh nhân.</p></div></header>
  {busy&&<p role="status">Đang đối chiếu dữ liệu tài chính…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="dashboard-toolbar"><label>Ngày báo cáo<input type="date" value={date} disabled={busy} onChange={e=>{setTrend([]);setLastUpdated(null);setDate(e.target.value);}}/></label><span className="admin-refresh-meta">Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật dữ liệu tài chính" title="Cập nhật dữ liệu tài chính" disabled={busy} onClick={()=>void load()}><RefreshCw size={17}/></button></div>
  {rows&&<><div className="dashboard-metrics">
   <article className="dashboard-metric"><BadgeDollarSign size={22}/><span>Phát sinh trong ngày</span><strong>{totalsComplete?money(totals.issued):'—'}</strong><small>Tổng giá trị phiếu thu phát hành</small></article>
   <article className="dashboard-metric"><WalletCards size={22}/><span>Đã nhận</span><strong>{totalsComplete?money(totals.collected):'—'}</strong><small>Tiền mặt, chuyển khoản, POS và online</small></article>
   <article className="dashboard-metric"><BadgeDollarSign size={22}/><span>Còn phải thu</span><strong>{totalsComplete?money(totals.outstanding):'—'}</strong><small>Số dư hiện tại của các khoản phải thu</small></article>
   <article className="dashboard-metric"><CheckCircle2 size={22}/><span>Chờ quản trị xử lý</span><strong>{totalsComplete?submitted.length+totals.reviews:'—'}</strong><small>{submitted.length} ca chờ duyệt · {totals.reviews} giao dịch cần đối chiếu</small></article>
  </div>
  <div className="admin-chart-layout"><AdminTrendChart title="Xu hướng tài chính 7 ngày" description="Phát sinh, đã thu và số dư phải thu theo từng ngày, tổng hợp từ tất cả địa điểm đang hoạt động." data={trend} axisFormat={compactMoney} series={[{key:'issued',label:'Phát sinh',format:money},{key:'collected',label:'Đã thu',format:money},{key:'outstanding',label:'Còn phải thu',format:money}]}/>{totalsComplete&&<AdminBars title="Cơ cấu phương thức thanh toán" description="Giá trị đã thu của ngày báo cáo theo phương thức thanh toán." items={[{label:'Tiền mặt',value:paymentMix.cash,format:money},{label:'Chuyển khoản',value:paymentMix.bank,format:money},{label:'POS',value:paymentMix.pos,format:money},{label:'Online',value:paymentMix.online,format:money}]}/>}</div>
   <div className="dashboard-columns">{rows.map(row=><article className="dashboard-card" key={row.id}><h2>{row.name}</h2>{row.error&&<p role="alert">{row.error}</p>}{row.summary?<dl className="dashboard-facts"><div><dt>Đã nhận</dt><dd>{money(row.summary.collectedCashVnd+row.summary.collectedBankVnd+row.summary.collectedPosVnd+(row.summary.collectedOnlineVnd??0))}</dd></div><div><dt>Còn phải thu</dt><dd>{money(row.summary.outstandingVnd)}</dd></div><div><dt>Ca chờ duyệt</dt><dd>{row.summary.submittedShifts}</dd></div><div><dt>Giao dịch cần đối chiếu</dt><dd>{row.summary.paymentReviews??0}</dd></div></dl>:<p>Chưa tải được số liệu tổng hợp.</p>}</article>)}</div>
  <section className="dashboard-card"><h2>Ca thu chờ duyệt</h2>{!submitted.length?<p>Không có ca thu đang chờ duyệt trong dữ liệu đã tải.</p>:submitted.map(({branch,shift})=><article className="booking-appointment" key={shift.id}><strong>{branch.name}</strong><p>Nhân sự: {names.get(shift.collectorUserId)??shift.collectorUserId}</p><p>Tiền mặt {money(shift.declaredCashVnd??shift.expectedCashVnd??0)} · Chuyển khoản {money(shift.declaredBankVnd??shift.expectedBankVnd??0)} · POS {money(shift.declaredPosVnd??shift.expectedPosVnd??0)}</p><small>Chênh lệch: {money(shift.varianceVnd??0)}</small><button className="button-secondary" disabled={busy} onClick={()=>{setApproving({branch:branch.id,shift});setReason('');}}>Đối chiếu & duyệt</button></article>)}</section></>}
  {approving&&<form className="booking-form" onSubmit={e=>{e.preventDefault();void approve();}}><h2>Duyệt ca thu</h2><p>Ghi lý do đối soát. Quyết định này không tạo giao dịch thu tiền mới.</p><label>Lý do duyệt<textarea required maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="booking-primary" disabled={busy||!reason.trim()}>Xác nhận duyệt</button><button type="button" disabled={busy} onClick={()=>{setApproving(null);setReason('');}}>Hủy</button></form>}
 </section>;
}
