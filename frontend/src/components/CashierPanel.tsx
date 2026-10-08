import {RealtimeIndicator,useReceptionRealtime} from './useReceptionRealtime';
import type {SyncContext} from './useAuthoritativeSync';
import {OnlinePaymentsPanel} from './OnlinePaymentsPanel';
import {ConfirmDialog} from './ConfirmDialog';
import type {ReactNode} from 'react';
import {PatientIdentity,patientLabel} from './PatientIdentity';
import {usePanelSession,useSessionBranch} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import { useEffect,useRef,useState } from 'react';
import {VndInput} from './VndInput';
import {parseVnd} from '../utils/vnd';
import * as api from '../api/billing';
import * as payments from '../api/payments';
import { contexts,type Directory,type Scope } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
import { CashierNotificationPanel } from './CashierNotificationPanel';
import { ChargeSyncPanel } from './ChargeSyncPanel';
import { useNavigationLock } from './useNavigationLock';
const money=(v:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(v);
const methodName:Record<string,string>={CASH:'Tiền mặt',BANK_TRANSFER:'Chuyển khoản / VietQR',POS:'POS tại quầy',PAYOS:'payOS QR',VNPAY:'VNPAY'};
export function CashierPanel({onClinic,onNavigationLock}:{onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const [cashierTab,setCashierTab]=useState('payments'),[billQuery,setBillQuery]=useState(''),[billFilter,setBillFilter]=useState('outstanding'),[refreshError,setRefreshError]=useState('');
 const detailHeading=useRef<HTMLHeadingElement>(null);
 const [review,setReview]=useState<{title:string;content:ReactNode;confirmLabel:string;cancelLabel?:string;commit:()=>Promise<void>}|null>(null);
 const shared=usePanelSession(()=>run(login));
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[token,setToken]=useState(''),[actor,setActor]=useState(''),[role,setRole]=useState('');
 const [directory,setDirectory]=useState<Directory|null>(null),[branch,setBranch]=useState(''),[visits,setVisits]=useState<api.Billable[]>([]),[bills,setBills]=useState<api.Bill[]>([]),[shifts,setShifts]=useState<api.Shift[]>([]);
 const [visitId,setVisitId]=useState(''),[billId,setBillId]=useState(''),[shiftId,setShiftId]=useState(''),[receipts,setReceipts]=useState<api.Receipt[]>([]),[printed,setPrinted]=useState<api.Receipt|null>(null);
 const [cashGiven,setCashGiven]=useState(''),[receiptError,setReceiptError]=useState('');
 const [reason,setReason]=useState(''),[amount,setAmount]=useState(''),[method,setMethod]=useState('CASH'),[reference,setReference]=useState(''),[cash,setCash]=useState('0'),[bank,setBank]=useState('0'),[pos,setPos]=useState('0');
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[stale,setStale]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [paymentMethods,setPaymentMethods]=useState<payments.PaymentMethod[]>([]),[paymentMethodError,setPaymentMethodError]=useState('');
 const [activeDisplay,setActiveDisplay]=useState<{billId:string;method:string;url:string;expiresAt:string}|null>(null),[blockedDisplay,setBlockedDisplay]=useState<{billId:string;method:string}|null>(null);
 const paymentWindow=useRef<Window|null>(null),displayAttempts=useRef(new Map<string,string>());
 useNavigationLock(review?'Kiểm tra hoặc bỏ bước xác nhận thu phí trước khi rời màn hình.':uncertain?'Thử lại thu phí đang chờ để xác minh kết quả trước khi rời màn hình.':busy?'Đợi thao tác thu phí xử lý xong trước khi rời màn hình.':null,onNavigationLock);
 const running=useRef(false),pending=useRef<(()=>Promise<void>)|null>(null);const scope:Scope={token,clinic:directory?.id??'',branch};const bill=bills.find(x=>x.id===billId),shift=shifts.find(x=>x.id===shiftId),manager=['ADMIN'].includes(role);
 async function run(action:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định kết quả thu phí');}finally{running.current=false;setBusy(false);}}
 async function login(){let auth:string;try{auth=shared?.session?.token??(await signIn(email,password)).data.accessToken;setEmail(shared?.session?.email??email);}finally{setPassword('');}const memberships=await contexts(auth);const ids=[...new Set(memberships.filter(m=>['STAFF','ADMIN'].includes(m.role)).map(m=>m.clinicId))];const requested=new URLSearchParams(location.search).get('clinicId');const id=requested?(ids.includes(requested)?requested:null):ids.length===1?ids[0]:null;if(!id)throw new Error('Cần quyền thu phí tại một phòng khám. Dùng đường dẫn Workspace được cấp nếu làm việc tại nhiều phòng khám.');const [d,me]=await Promise.all([api.directory(auth,id),api.current(auth)]);setToken(auth);setDirectory(d);setActor(me.userId);setRole(['ADMIN','STAFF'].find(r=>memberships.some(m=>m.clinicId===id&&m.role===r))!);onClinic?.(d.name);}
 async function load(s=scope){const [v,b,h]=await Promise.all([api.visits(s),api.bills(s),api.shifts(s)]);setVisits(v);setBills(b);setShifts(h);setStale(false);}
 useSessionBranch(shared,token,directory,branch,id=>run(()=>chooseBranch(id)));
 async function chooseBranch(id:string){setBranch(id);setVisits([]);setBills([]);setShifts([]);setBillId('');setShiftId('');setVisitId('');setReceipts([]);setPrinted(null);setPaymentMethods([]);setPaymentMethodError('');setReason('');setAmount('');setReference('');setMethod('CASH');setStale(false);if(id){const s={...scope,branch:id};const [v,b,h]=await Promise.all([api.visits(s),api.bills(s),api.shifts(s)]);setVisits(v);setBills(b);setShifts(h);setShiftId(h.find(x=>x.state==='OPEN'&&x.collectorUserId===actor)?.id??'');}}
 async function sync(){let failure:unknown;for(let attempt=0;attempt<3;attempt++){try{await load();setError('');return;}catch(e){failure=e;if(attempt<2)await new Promise(resolve=>window.setTimeout(resolve,250*(attempt+1)));}}setStale(true);setError(failure instanceof Error?'Thao tác đã được ghi nhận nhưng số dư chưa đồng bộ được. '+failure.message:'Thao tác đã được ghi nhận nhưng số dư chưa đồng bộ được. Hệ thống sẽ giữ màn hình ở chế độ an toàn.');}
 async function execute(action:()=>Promise<void>){pending.current=action;try{await action();pending.current=null;setUncertain(false);}catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){pending.current=null;setUncertain(false);setStale(true);}else setUncertain(true);throw e;}}
 async function mutation<T>(operation:string,body:unknown,request:(key:string)=>Promise<T>,ack:(value:T)=>void){const key=await stableOperationKey('billing-'+operation,{clinic:scope.clinic,branch,actor,...(body as object)});await execute(async()=>{const result=await request(key);ack(result);setMessage('Đã ghi nhận thao tác thu phí.');await sync();});}
 function paymentPopup(targetBill:api.Bill,displayMethod:string){
  const opened=window.open('/payment-display/loading','clinic-payment-display','width=560,height=820,resizable=yes,scrollbars=yes');
  if(!opened){setBlockedDisplay({billId:targetBill.id,method:displayMethod});setError('Trình duyệt đã chặn cửa sổ thanh toán.');return null;}
  paymentWindow.current=opened;try{opened.focus();}catch{/* Focus is best effort only. */}return opened;
 }
 async function showPaymentDisplay(target:api.Bill,displayMethod:string){
  const opened=paymentPopup(target,displayMethod);if(!opened)return;
  setBlockedDisplay(null);
  if(activeDisplay&&activeDisplay.billId===target.id&&activeDisplay.method===displayMethod&&Date.parse(activeDisplay.expiresAt)>Date.now()){
   opened.location.href=activeDisplay.url;try{opened.focus();}catch{};return;
  }
  const body={method:displayMethod,expectedVersion:target.version},attemptKey=target.id+':'+displayMethod;
  if(activeDisplay&&activeDisplay.billId===target.id&&activeDisplay.method===displayMethod&&Date.parse(activeDisplay.expiresAt)<=Date.now())displayAttempts.current.delete(attemptKey);
  const attempt=displayAttempts.current.get(attemptKey)??crypto.randomUUID();displayAttempts.current.set(attemptKey,attempt);
  const key=await stableOperationKey('billing-payment-display',{clinic:scope.clinic,branch,actor,billId:target.id,attempt,...body});
  try{
   const launch=await payments.launchDisplay(scope,target.id,body,key),url=launch.displayUrl??launch.checkoutUrl;
   if(!url)throw new Error('Chưa nhận được đường dẫn thanh toán từ máy chủ.');
   if(!opened.closed){opened.location.href=url;try{opened.focus();}catch{}}
   setActiveDisplay({billId:target.id,method:displayMethod,url,expiresAt:launch.expiresAt});
   if(displayMethod==='BANK_TRANSFER'){setAmount(String(target.remainingVnd));if(!reason.trim())setReason('Xác nhận chuyển khoản tại quầy');}
   setMessage(displayMethod==='BANK_TRANSFER'?'Đã hiển thị QR chuyển khoản trên màn hình bệnh nhân.':displayMethod==='PAYOS'?'Đã hiển thị QR payOS trên màn hình bệnh nhân.':'Đã mở thanh toán VNPAY.');
  }catch(e){if(!opened.closed)opened.location.href='/payment-display/error';throw e;}
 }
 async function requestPaymentDisplay(displayMethod:string){
  if(!bill)return;
  const currentWindow=paymentWindow.current,previousBill=activeDisplay?bills.find(item=>item.id===activeDisplay.billId):null;
  const competing=!!activeDisplay&&activeDisplay.billId!==bill.id&&Date.parse(activeDisplay.expiresAt)>Date.now()&&!!currentWindow&&!currentWindow.closed&&(previousBill?.remainingVnd??1)>0;
  if(competing){
   const target=bill;
   setReview({title:'Đang có mã thanh toán chờ xử lý trên màn hình bệnh nhân',cancelLabel:'Tiếp tục mã hiện tại',confirmLabel:'Chuyển sang phiếu mới',content:<p>Mã thanh toán hiện tại vẫn đang chờ xử lý. Chỉ chuyển màn hình sau khi đã xác định đúng bệnh nhân và phiếu cần thu.</p>,commit:()=>showPaymentDisplay(target,displayMethod)});return;
  }
  await showPaymentDisplay(bill,displayMethod);
 }
 function positive(){return parseVnd(amount);}
 async function issue(){const id=visitId,text=reason;await mutation('issue',{id,reason:text},key=>api.issue(scope,id,text,key),b=>{setCashierTab('payments');setBillFilter('outstanding');setBillId(b.id);setReceipts([]);setPrinted(null);setAmount('');setReason('');setBills(current=>[b,...current.filter(x=>x.id!==b.id)]);});setMessage('Đã lập phiếu thu cho lượt khám đã chọn.');}
 async function open(){const text=reason;await mutation('shift-open',{reason:text},key=>api.open(scope,text,key),s=>{setShiftId(s.id);setShifts(current=>[s,...current.filter(x=>x.id!==s.id)]);});}
 async function collect(){if(!bill||!collectionShift)return;const id=bill.id,body={expectedVersion:bill.version,shiftId:collectionShift.id,amountVnd:positive(),method,externalRef:method==='CASH'?null:reference.trim()||null,reason};if(method==='CASH'&&cashGiven.trim()&&parseVnd(cashGiven,true)<body.amountVnd)throw new Error('Tiền khách đưa chưa đủ cho khoản thu này.');if(body.amountVnd>bill.remainingVnd)throw new Error('Số tiền vượt số dư còn lại.');if(method!=='CASH'&&!body.externalRef)throw new Error('Nhập mã giao dịch đã xác nhận tại quầy.');setReview({title:'Xem lại khoản tiền nhận',confirmLabel:'Xác nhận ghi nhận tiền',content:<><PatientIdentity patient={visits.find(v=>v.id===bill.encounterId)?.patient}/><p><strong>{money(body.amountVnd)}</strong> · {methodName[body.method]}</p>{body.externalRef&&<p>Mã giao dịch: {body.externalRef}</p>}<p>Còn lại sau thu: {money(bill.remainingVnd-body.amountVnd)}</p>{method==='CASH'&&cashGiven.trim()&&<p>Khách đưa: {money(parseVnd(cashGiven,true))} · Trả lại: {money(parseVnd(cashGiven,true)-body.amountVnd)}</p>}<p>Chỉ xác nhận khi đã nhận tiền thực tế tại quầy.</p></>,commit:async()=>{await mutation('collect',{id,...body},key=>api.collect(scope,id,body,key),r=>{setReceipts(current=>[r,...current.filter(x=>x.id!==r.id)]);setPrinted(r);setCashGiven('');setAmount('');setReference('');});setMessage('Đã nhận '+money(body.amountVnd)+' bằng '+methodName[body.method]+'.');}});}
 async function adjust(){if(!bill)return;const id=bill.id,body={expectedVersion:bill.version,amountVnd:positive(),reason};if(body.amountVnd>bill.remainingVnd)throw new Error('Khoản giảm không được vượt số dư còn lại.');setReview({title:'Xem lại khoản giảm phí',confirmLabel:'Xác nhận giảm phí',content:<><PatientIdentity patient={chosenVisit?.patient}/><p>Giảm: <strong>{money(body.amountVnd)}</strong></p><p>Còn phải thu: {money(bill.remainingVnd-body.amountVnd)}</p><p>Lý do: {reason}</p><p>Đây là giảm công nợ, không phải ghi nhận tiền khách đã trả.</p></>,commit:async()=>{await mutation('adjust',{id,...body},key=>api.adjust(scope,id,body,key),b=>setBills(current=>current.map(x=>x.id===b.id?b:x)));setAmount('');}});}

 async function retryNotifications(){if(!bill)return;const id=bill.id,text=reason;await mutation('notification-retry',{id,reason:text},key=>api.retryNotifications(scope,id,text,key),()=>{});}
 async function retryCharge(source:'billing'|'medical'|'encounter',eventId:string){const id=visitId,text=reason;await mutation('charge-retry',{id,source,eventId,reason:text},key=>api.retryCharge(scope,id,eventId,text,key,source),()=>{});}
 async function submit(){if(!shift)return;const id=shift.id,body={expectedVersion:shift.version,declaredCashVnd:parseVnd(cash,true),declaredBankVnd:parseVnd(bank,true),declaredPosVnd:parseVnd(pos,true),reason};if([body.declaredCashVnd,body.declaredBankVnd,body.declaredPosVnd].some(v=>!Number.isSafeInteger(v)||v<0||v>9000000000000))throw new Error('Nhập số tiền kiểm đếm VND nguyên, không âm.');const latest=(await api.shifts(scope)).find(s=>s.id===id);if(!latest||latest.state!=='OPEN'||latest.expectedCashVnd===null||latest.expectedBankVnd===null||latest.expectedPosVnd===null)throw new Error('Chưa xác minh được tổng ca thu. Đã thay đổi tổng ca thu; dữ liệu vừa được đồng bộ lại, vui lòng kiểm tra trước khi chốt.');const checked={...body,expectedVersion:latest.version,expectedCashVnd:latest.expectedCashVnd,expectedBankVnd:latest.expectedBankVnd,expectedPosVnd:latest.expectedPosVnd};const totals=[['Tiền mặt',checked.expectedCashVnd,checked.declaredCashVnd],['Chuyển khoản',checked.expectedBankVnd,checked.declaredBankVnd],['POS',checked.expectedPosVnd,checked.declaredPosVnd]] as const;const difference=totals.reduce((sum,row)=>sum+row[2]-row[1],0);setReview({title:'Xem lại chốt ca thu',confirmLabel:'Xác nhận gửi chốt ca',content:<><table className="shift-preview"><thead><tr><th>Hình thức</th><th>Đã thu</th><th>Kiểm đếm</th></tr></thead><tbody>{totals.map(row=><tr key={row[0]}><th>{row[0]}</th><td>{money(row[1])}</td><td>{money(row[2])}</td></tr>)}</tbody></table><p>Chênh lệch kiểm đếm: <strong>{money(difference)}</strong></p><p>Quản trị khác người thu sẽ đối chiếu và duyệt ca này.</p><p>Lý do: {checked.reason}</p></>,commit:async()=>{await mutation('shift-submit',{id,...checked},key=>api.submit(scope,id,checked,key),s=>setShifts(current=>current.map(x=>x.id===s.id?s:x)));setMessage('Đã gửi chốt ca. Chờ Quản trị đối chiếu và duyệt.');}});}
 async function approve(){if(!shift)return;const id=shift.id,version=shift.version,text=reason;await mutation('shift-approve',{id,version,reason:text},key=>api.approve(scope,id,version,text,key),s=>setShifts(current=>current.map(x=>x.id===s.id?s:x)));}
 function logout(){setToken('');setDirectory(null);setActor('');setRole('');setBranch('');setVisits([]);setBills([]);setShifts([]);setReceipts([]);setPrinted(null);setBillId('');setShiftId('');setReason('');setAmount('');setReference('');pending.current=null;setUncertain(false);setStale(false);setError('');setMessage('');onClinic?.('Phòng khám theo phiên đăng nhập');}

 const refreshGeneration=useRef(0),refreshScope=useRef('');refreshScope.current=[token,directory?.id,branch,billId].join(':');
 async function refreshCashier(context?:SyncContext){
  const original=refreshScope.current,generation=refreshGeneration.current;
  try{const [v,b,h,r]=await Promise.all([api.visits(scope),api.bills(scope),api.shifts(scope),billId?api.receipts(scope,billId):Promise.resolve([])]);
   if(original===refreshScope.current&&generation===refreshGeneration.current&&!running.current&&(!context||context.current())){setVisits(v);setBills(b);setShifts(h);setReceipts(r);setStale(false);setRefreshError('');setReceiptError('');}
  }catch(e){if(original!==refreshScope.current)return;if(e instanceof RequestError&&[401,403].includes(e.status)){setBills([]);setVisits([]);setShifts([]);setReceipts([]);setPrinted(null);}setStale(true);setRefreshError('Chưa đồng bộ được số dư. Tạm khóa thu tiền; đồng bộ lại trước khi tiếp tục.');throw e;}
 }
 const realtime=useReceptionRealtime(scope,refreshCashier,busy||uncertain||!!review,['encounter','billing'],()=>{refreshGeneration.current++;setBills([]);setVisits([]);setShifts([]);setReceipts([]);setPrinted(null);setStale(true);setRefreshError('Quyền truy cập đã thay đổi. Xác minh lại phiên đăng nhập.');});
 async function selectBill(id:string){setBillId(id);setReceipts([]);setPrinted(null);setAmount('');setCashGiven('');setReference('');setReason('');setMethod('CASH');setReceiptError('');if(id)await run(async()=>{try{setReceipts(await api.receipts(scope,id));}catch(e){setReceiptError('Chưa đọc được biên nhận của phiếu này. Hệ thống sẽ tự thử lại.');throw e;}});}

 useEffect(()=>{let active=true;setPaymentMethods([]);setPaymentMethodError('');if(!token||!directory?.id||!branch||!billId)return()=>{active=false;};const paymentScope={token,clinic:directory.id,branch};void payments.staffMethods(paymentScope,billId).then(rows=>{if(active)setPaymentMethods(rows);}).catch(e=>{if(active)setPaymentMethodError(e instanceof Error?e.message:'Chưa tải được phương thức thanh toán.');});return()=>{active=false;};},[token,directory?.id,branch,billId]);
  useEffect(()=>{if(activeDisplay&&bills.find(item=>item.id===activeDisplay.billId)?.remainingVnd===0)setActiveDisplay(null);},[bills,activeDisplay?.billId]);
  const collectionShift=shifts.find(s=>s.state==='OPEN'&&s.collectorUserId===actor);
 const unbilled=visits.filter(v=>!bills.some(b=>b.encounterId===v.id));
 const matches=(v?:api.Billable)=>!billQuery||patientLabel(v?.patient).toLocaleLowerCase('vi-VN').includes(billQuery.trim().toLocaleLowerCase('vi-VN'));
 const filteredBills=bills.filter(b=>(billFilter==='all'||(billFilter==='paid'?b.remainingVnd===0&&b.lines.length>0:billFilter==='empty'?b.lines.length===0:b.remainingVnd>0))&&matches(visits.find(v=>v.id===b.encounterId)));
 const selectedUnbilled=unbilled.find(v=>v.id===visitId);
 const reasonField=<label>Lý do lập phiếu hoặc xử lý<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ghi nội dung cho thao tác đang xử lý…"/></label>;
 let change:number|null=null;try{if(cashGiven.trim()&&amount.trim())change=parseVnd(cashGiven,true)-parseVnd(amount);}catch{/* VndInput explains invalid input. */}
 useEffect(()=>{if(cashierTab==='payments')detailHeading.current?.focus();},[billId,cashierTab]);
 const outstanding=bills.filter(b=>b.remainingVnd>0);
 const shiftName:Record<string,string>={OPEN:'Đang mở',SUBMITTED:'Chờ duyệt',APPROVED:'Đã duyệt'};
 const chosenVisit=visits.find(v=>v.id===bill?.encounterId);
  const remoteMethods=new Map(paymentMethods.map(item=>[item.code,item]));
  const cashierMethods=[{code:'CASH',name:'Tiền mặt',available:true,message:'Thu và trả tiền thừa tại quầy.'},{code:'BANK_TRANSFER',name:'Chuyển khoản / VietQR',available:remoteMethods.get('BANK_TRANSFER')?.available===true,message:remoteMethods.get('BANK_TRANSFER')?.message??'Chưa cấu hình QR chuyển khoản.'},{code:'PAYOS',name:'payOS QR',available:remoteMethods.get('PAYOS')?.available===true,message:remoteMethods.get('PAYOS')?.message??'Chưa cấu hình payOS.'},{code:'POS',name:'POS tại quầy',available:true,message:'Ghi nhận mã giao dịch từ máy POS.'},{code:'VNPAY',name:'VNPAY',available:remoteMethods.get('VNPAY')?.available===true,message:remoteMethods.get('VNPAY')?.message??'Chưa cấu hình VNPAY.'}];
  const onsiteMethod=['CASH','BANK_TRANSFER','POS'].includes(method);
 return <section className="booking-panel reception-panel cashier-panel cashier-redesign" aria-labelledby="cashier-title">
  <header className="task-panel-header"><div><span className="eyebrow">Thu ngân</span><h1 id="cashier-title">Thu phí & ca thu</h1><p>Thu tiền sau hoàn tất chuyên môn. Đối chiếu phiếu thu, xác nhận khoản đã nhận và in biên nhận.</p></div></header>
  {refreshError&&<p role="status" className="booking-error">{refreshError}</p>}
  {error&&<p role="alert" className="booking-error">{error}</p>}
  {message&&<p role="status" className="task-success">{message}</p>}{paymentMethodError&&billId&&<p role="status" className="booking-error">Chưa tải đủ phương thức thanh toán: {paymentMethodError}</p>}
  {busy&&<p role="status">Đang xử lý thu phí…</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void run(login)}/>:!token?<form className="booking-form" onSubmit={e=>{e.preventDefault();void run(login);}}>
   <label>Email thu ngân<input type="email" autoComplete="username" required value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Mật khẩu thu ngân<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="booking-primary" disabled={busy}>Đăng nhập thu phí</button>
  </form>:<>
   <div className={shared&&directory?.branches.length===1?"doctor-toolbar single-clinic-toolbar":"doctor-toolbar"}>
    {!shared&&<button type="button" disabled={busy||uncertain||!!review} onClick={logout}>Đăng xuất thu phí</button>}
    <fieldset hidden={!!shared&&directory?.branches.length===1} className="reception-actions" disabled={busy||uncertain||!!review}><label>Địa điểm thu phí<select value={branch} onChange={e=>void run(()=>chooseBranch(e.target.value))}>
     <option value="">Chọn địa điểm được cấp quyền</option>{directory?.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
    </select></label></fieldset>

   </div>
   {uncertain&&<p role="status" className="navigation-lock">Chưa nhận xác nhận. Số tiền, phiên bản và mã yêu cầu được giữ nguyên. <button type="button" disabled={busy} onClick={()=>void run(()=>pending.current?execute(pending.current):Promise.resolve())}>Thử lại thu phí đang chờ</button></p>}
   {branch&&<>
    <div className="task-summary" aria-label="Tổng hợp thu phí hiện có">
     <div><span>Cần thu</span><strong>{outstanding.length}</strong></div>
     <div><span>Tổng tiền còn phải thu</span><strong>{money(outstanding.reduce((sum,b)=>sum+b.remainingVnd,0))}</strong></div>
     <div><span>Ca thu</span><strong>{collectionShift?'Đang mở':'Chưa mở'}</strong></div>
    </div>

    <div className="cashier-session-bar"><span><strong>{collectionShift?'Ca thu của bạn đang mở':'Bạn chưa mở ca thu'}</strong> · {collectionShift?'Có thể ghi nhận tiền tại quầy':'Vẫn có thể đối chiếu và lập phiếu'}</span><button type="button" disabled={busy||uncertain||!!review} onClick={()=>{setCashierTab('shifts');setShiftId(collectionShift?.id??shiftId);}}>Đến ca thu</button><RealtimeIndicator state={realtime}/><button type="button" className="button-secondary" disabled={busy||uncertain||!!review} onClick={()=>void run(refreshCashier)}>Đồng bộ lại</button></div>
    <nav className="task-tabs" aria-label="Công việc thu ngân">{[['payments','Thu tiền bệnh nhân'],['unbilled','Chưa lập phiếu'],['shifts','Ca làm việc & đối chiếu']].map(([id,label])=><button key={id} disabled={busy||uncertain||!!review} aria-pressed={cashierTab===id} onClick={()=>{setCashierTab(id);setReason('');setPrinted(null);}}>{label}{id==='unbilled'&&' · '+unbilled.length}</button>)}</nav>
    <fieldset className={'reception-actions cashier-layout cashier-tab-'+cashierTab+((cashierTab==='payments'&&bill||cashierTab==='unbilled'&&selectedUnbilled)?' has-selection':'')} disabled={busy||uncertain||stale||!!review}>
     <div hidden={cashierTab==='unbilled'} className="cashier-selection task-card">
      <h2>{cashierTab==='payments'?'Danh sách cần thu':'Quản lý ca thu'}</h2>{cashierTab==='payments'&&<p className="muted-copy">Trong 100 phiếu gần nhất do máy chủ trả về. Chọn một dòng để đối chiếu và thu tiền.</p>}<div hidden={cashierTab!=='payments'}>

      <label>Tìm bệnh nhân<input type="search" placeholder="Tên hoặc ngày sinh…" value={billQuery} onChange={e=>setBillQuery(e.target.value)}/></label>
      <label>Danh sách phiếu<select value={billFilter} onChange={e=>setBillFilter(e.target.value)}><option value="outstanding">Chờ thanh toán</option><option value="paid">Đã thanh toán</option><option value="empty">Cần đối chiếu dịch vụ</option><option value="all">Tất cả phiếu</option></select></label>
      <div className="desk-table-scroll"><table className="desk-table"><caption className="sr-only">Danh sách phiếu thu</caption><thead><tr><th>Bệnh nhân</th><th>Còn phải thu</th><th>Chọn</th></tr></thead><tbody>

      {filteredBills.map(b=><tr key={b.id} data-bill-id={b.id} data-selected={b.id===billId}><td><PatientIdentity patient={visits.find(v=>v.id===b.encounterId)?.patient}/><small>{visits.find(v=>v.id===b.encounterId)?.checkedInAt?new Date(visits.find(v=>v.id===b.encounterId)!.checkedInAt!).toLocaleDateString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}):'Chưa có ngày khám'}</small></td><td><strong>{money(b.remainingVnd)}</strong><small>{b.lines.length===0?'Cần đối chiếu dịch vụ':b.remainingVnd===0?'Đã tất toán':b.paidVnd>0?'Đã thu một phần':'Chưa thanh toán'}</small></td><td><button type="button" className="button-secondary" aria-label={'Chọn phiếu '+patientLabel(visits.find(v=>v.id===b.encounterId)?.patient)} onClick={()=>void selectBill(b.id)}>Thu tiền / chi tiết</button></td></tr>)}
      {!filteredBills.length&&<tr><td colSpan={3} className="desk-empty">Không có phiếu thu phù hợp.</td></tr>}
      </tbody></table></div>
      </div><div className="cashier-shift-section" hidden={cashierTab!=='shifts'}><p>Ca thu tổng hợp các khoản tiền bạn nhận tại quầy trong một lần làm việc. Mở ca khi bắt đầu, kiểm đếm và gửi chốt ca khi kết thúc.</p><label>Ca thu<select aria-label="Ca thu" value={shiftId} onChange={e=>setShiftId(e.target.value)}>
       <option value="">Chọn ca thu</option>{shifts.map(s=><option key={s.id} value={s.id}>{s.collectorUserId===actor?'Ca của tôi':'Ca nhân viên'} · {shiftName[s.state]??s.state} · {shifts.indexOf(s)+1}</option>)}
      </select></label>
      {shift&&<p className="muted-copy">{shiftName[shift.state]??shift.state}{shift.collectorUserId===actor?' · Ca của tôi':''}</p>}
      </div>{cashierTab==='shifts'&&reasonField}
      <button hidden={cashierTab!=='shifts'} type="button" disabled={!reason.trim()||shifts.some(s=>s.state==='OPEN'&&s.collectorUserId===actor)} onClick={()=>void run(open)}>Bắt đầu ca thu</button>
      {shift&&<details hidden={cashierTab!=='shifts'} open className="task-disclosure">
       <summary>Chốt ca thu</summary>
       {shift.state==='OPEN'&&shift.collectorUserId===actor&&<>
        <label>Tiền mặt kiểm đếm VND<VndInput label="Tiền mặt kiểm đếm VND" value={cash} onChange={setCash} allowZero/></label>
        <label>Chuyển khoản kiểm đếm VND<VndInput label="Chuyển khoản kiểm đếm VND" value={bank} onChange={setBank} allowZero/></label>
        <label>POS kiểm đếm VND<VndInput label="POS kiểm đếm VND" value={pos} onChange={setPos} allowZero/></label>
        <button type="button" disabled={!reason.trim()} onClick={()=>void run(submit)}>Gửi chốt ca</button>
       </>}
       {shift.state!=='OPEN'&&<><p>Thực thu: {money((shift.expectedCashVnd??0)+(shift.expectedBankVnd??0)+(shift.expectedPosVnd??0))}</p><p>Chênh lệch kiểm đếm: {money(shift.varianceVnd??0)}</p>
        {manager&&shift.state==='SUBMITTED'&&shift.collectorUserId!==actor&&<button type="button" disabled={!reason.trim()} onClick={()=>void run(approve)}>Duyệt chốt ca và chênh lệch</button>}
       </>}
      </details>}
     </div>

     {cashierTab==='unbilled'&&<><section className="cashier-selection task-card"><h2>Lượt khám chưa lập phiếu</h2><p className="muted-copy">Các lượt máy chủ cho phép lập phiếu, chưa có phiếu trong danh sách đã nhận. Dịch vụ và giá được kiểm tra lại khi lập phiếu.</p><label>Tìm lượt khám chưa lập phiếu<input type="search" value={billQuery} onChange={e=>setBillQuery(e.target.value)} placeholder="Tên hoặc ngày sinh…"/></label><div className="desk-table-scroll"><table className="desk-table"><caption className="sr-only">Lượt khám chưa lập phiếu</caption><thead><tr><th>Bệnh nhân</th><th>Lượt khám</th><th>Thao tác</th></tr></thead><tbody>{unbilled.filter(matches).map(v=><tr key={v.id} data-selected={v.id===visitId}><td><PatientIdentity patient={v.patient}/></td><td>{v.appointmentId?'Theo lịch hẹn':'Đến trực tiếp'}</td><td><button type="button" onClick={()=>{setVisitId(v.id);setReason('Lập phiếu thu dịch vụ đã thực hiện');}}>Đối chiếu dịch vụ</button></td></tr>)}{!unbilled.filter(matches).length&&<tr><td colSpan={3} className="desk-empty">Không có lượt khám chưa lập phiếu phù hợp.</td></tr>}</tbody></table></div></section>{selectedUnbilled&&<section className="cashier-payment task-card"><h2>Đối chiếu trước khi lập phiếu</h2><PatientIdentity patient={selectedUnbilled.patient}/><p>Máy chủ chỉ lập phiếu từ dịch vụ đã thực hiện. Lập phiếu không ghi nhận đã thanh toán.</p>{reasonField}<ChargeSyncPanel scope={scope} encounterId={visitId} onRetry={manager?(source,eventId)=>void run(()=>retryCharge(source,eventId)):undefined} canRetry={!busy&&!uncertain&&!stale&&!!reason.trim()}/><button type="button" className="booking-primary" disabled={!reason.trim()} onClick={()=>void run(issue)}>Lập phiếu thu từ dịch vụ thực</button></section>}</>}
     <div hidden={cashierTab!=='payments'||!bill} className="cashier-payment task-card">

      {bill?<>
       <div className="cashier-bill-heading"><div><span className="eyebrow">Khoản phải thu</span><h2 ref={detailHeading} tabIndex={-1}>Chi tiết phiếu thu</h2><button type="button" aria-label="Đóng chi tiết phiếu" onClick={()=>{setBillId('');setPrinted(null);setReceipts([]);setAmount('');setCashGiven('');}}>Đóng</button></div><span className="task-status" data-state={bill.lines.length===0?'WAITING':bill.remainingVnd===0?'PAID':'WAITING'}>{bill.lines.length===0?'Chưa ghi nhận dịch vụ':bill.remainingVnd===0?'Đã thu đủ':'Còn phải thu'}</span></div>
       <PatientIdentity patient={chosenVisit?.patient}/>{bill.lines.length===0&&<p role="alert">Phiếu chưa có dịch vụ. Đối chiếu với bác sĩ; không coi phiếu rỗng là miễn phí.</p>}<OnlinePaymentsPanel scope={scope} billId={bill.id}/><div className="cashier-balance"><span>Số tiền còn lại</span><strong>{money(bill.remainingVnd)}</strong></div>
       <ul className="cashier-lines" aria-label="Dịch vụ trên phiếu">{bill.lines.map(l=><li key={l.chargeId}><span>{l.name}</span><strong>{money(l.amountVnd)}</strong></li>)}</ul>
       <dl className="cashier-totals"><div><dt>Tổng dịch vụ</dt><dd>{money(bill.subtotalVnd)}</dd></div><div><dt>Đã giảm</dt><dd>{money(bill.adjustmentVnd)}</dd></div><div><dt>Đã thu</dt><dd>{money(bill.paidVnd)}</dd></div></dl>
       {bill.remainingVnd>0&&onsiteMethod&&!collectionShift&&<p className="muted-copy">Mở mục “Ca làm việc & đối chiếu” và bắt đầu ca thu trước khi ghi nhận tiền tại quầy. <button type="button" onClick={()=>setCashierTab('shifts')}>Đi đến ca thu</button></p>}
       {cashierTab==='payments'&&onsiteMethod&&reasonField}
       {bill.remainingVnd>0&&<><div className="cashier-payment-fields">
        {['CASH','POS'].includes(method)&&<label>Số tiền VND<VndInput label="Số tiền VND" value={amount} onChange={setAmount}/><button type="button" className="cashier-fill-balance" onClick={()=>setAmount(String(bill.remainingVnd))}>Điền đủ số dư</button></label>}{method==='BANK_TRANSFER'&&<div className="cashier-authoritative-amount"><span>Số tiền QR</span><strong>{money(bill.remainingVnd)}</strong><small>Số tiền lấy trực tiếp từ phiếu thu.</small></div>}
        <label>Hình thức nhận tiền<select aria-label="Hình thức nhận tiền" value={method} onChange={e=>{const next=e.target.value;setMethod(next);setCashGiven('');setReference('');setAmount(next==='BANK_TRANSFER'?String(bill.remainingVnd):'');}}>{cashierMethods.map(item=><option key={item.code} value={item.code} disabled={!item.available}>{item.name}{item.available?'':' · Chưa hỗ trợ'}</option>)}</select><small>{cashierMethods.find(item=>item.code===method)?.message}</small></label>
        {method==='CASH'&&<label className="field-full">Tiền khách đưa (tùy chọn)<VndInput label="Tiền khách đưa (tùy chọn)" value={cashGiven} onChange={setCashGiven} allowZero/><small>Chỉ hỗ trợ tính tiền thừa; số ghi nhận vẫn là khoản thu phía trên.</small>{change!==null&&<strong className={change<0?'cashier-change is-short':'cashier-change'} role="status">{change<0?'Khách còn thiếu: '+money(-change):'Tiền trả lại: '+money(change)}</strong>}</label>}
        {['BANK_TRANSFER','POS'].includes(method)&&<label className="field-full">Mã giao dịch đã xác nhận tại quầy<input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)}/></label>}{method==='BANK_TRANSFER'&&<button type="button" className="booking-primary field-full" onClick={()=>void run(()=>requestPaymentDisplay('BANK_TRANSFER'))}>Hiển thị QR chuyển khoản</button>}{method==='PAYOS'&&<button type="button" className="booking-primary field-full" onClick={()=>void run(()=>requestPaymentDisplay('PAYOS'))}>Tạo & hiển thị QR payOS</button>}{method==='VNPAY'&&<button type="button" className="booking-primary field-full" onClick={()=>void run(()=>requestPaymentDisplay('VNPAY'))}>Mở thanh toán VNPAY</button>}{blockedDisplay&&blockedDisplay.billId===bill.id&&blockedDisplay.method===method&&<button type="button" className="button-secondary field-full" onClick={()=>void run(()=>requestPaymentDisplay(method))}>Mở màn hình thanh toán</button>}
       </div>
       {onsiteMethod&&<button type="button" className="booking-primary cashier-collect" disabled={!reason.trim()||!amount||!collectionShift||bill.remainingVnd<=0||(method!=='CASH'&&!reference.trim())} onClick={()=>void run(collect)}>Ghi nhận tiền đã nhận</button>}
       {manager&&onsiteMethod&&<button type="button" disabled={!reason.trim()||!amount||bill.remainingVnd<=0} onClick={()=>void run(adjust)}>Duyệt giảm khoản phải thu</button>}</>}

       <section className="cashier-history"><h3>Biên nhận của phiếu</h3>{receiptError&&<p role="alert">{receiptError}</p>}{!receipts.length&&!receiptError&&<p className="muted-copy">Chưa có khoản thanh toán được ghi nhận.</p>}<ul className="cashier-receipt-list" aria-label="Biên nhận đã ghi nhận">{receipts.map(r=><li key={r.id}><button type="button" onClick={()=>setPrinted(r)}><strong>{money(r.amountVnd)}</strong> · {methodName[r.method]}<small>{new Date(r.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · Xem / in</small></button></li>)}</ul></section>
       <details className="task-disclosure"><summary>Trạng thái gửi biên nhận</summary><CashierNotificationPanel scope={scope} billId={bill.id} version={bill.version} onRetry={manager?()=>void run(retryNotifications):undefined} canRetry={!busy&&!uncertain&&!stale&&!!reason.trim()}/></details>
      </>:<div className="task-empty"><h2>Chọn phiếu cần thu</h2><p>Chi tiết dịch vụ, số dư và thao tác thu tiền sẽ hiện ở đây.</p></div>}
     </div>
    </fieldset>
   </>}

  </>}
  {review&&<ConfirmDialog title={review.title} confirmLabel={review.confirmLabel} cancelLabel={review.cancelLabel} busy={busy} onCancel={()=>setReview(null)} onConfirm={()=>void run(async()=>{const operation=review;setReview(null);await operation.commit();})}>{review.content}</ConfirmDialog>}
  {printed&&<article className="cashier-receipt" aria-label="Biên nhận nội bộ"><div><span className="eyebrow">{directory?.name}</span><h2>{printed.label}</h2><p>Mã biên nhận: <strong>{printed.receiptCode}</strong></p><PatientIdentity patient={visits.find(v=>v.id===bills.find(b=>b.id===printed.billId)?.encounterId)?.patient}/><p>Đã nhận: <strong>{money(printed.amountVnd)}</strong> · {methodName[printed.method]}</p>{printed.externalRef&&<p>Mã giao dịch: {printed.externalRef}</p>}<p>{printed.collectorUserId?<>Người thu: {printed.collectorUserId===actor?email:'Nhân viên thu ngân'}</>:"Xác nhận qua cổng thanh toán; không thuộc ca thu tại quầy."}</p><p>Thời điểm: {new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(printed.createdAt))}</p></div><div className="cashier-print-actions"><button type="button" onClick={()=>window.print()}>In biên nhận nội bộ</button><button type="button" onClick={()=>setPrinted(null)}>Đóng biên nhận</button></div></article>}
 </section>;
}
