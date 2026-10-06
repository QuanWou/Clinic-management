import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import * as api from '../api/payments';
import type {PatientBill} from '../api/portal';
import {stableOperationKey} from '../api/idempotency';
import {RequestError} from '../api/booking';
import {useNavigationLock} from './useNavigationLock';
import {ArrowRight,ArrowUpRight,Building2,Check,CircleAlert,Clock3,CreditCard,Landmark,Link2Off,LoaderCircle,QrCode,RefreshCw,ShieldCheck} from 'lucide-react';
const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
const states:Record<string,string>={CREATING:'Đang xác minh liên kết',PENDING:'Chờ xác nhận thanh toán',PAID:'Đã thanh toán',EXPIRED:'Liên kết hết hạn',FAILED:'Thanh toán chưa thành công',CANCELLED:'Đã hủy liên kết',REVIEW_REQUIRED:'Cần phòng khám đối chiếu'};
const methodIcons={PAYOS:QrCode,VNPAY:CreditCard,BANK_TRANSFER:Landmark,ONSITE:Building2};
function PaymentQr({value}:{value:string}){
 const canvas=useRef<HTMLCanvasElement>(null);const [error,setError]=useState(false);
 useEffect(()=>{let active=true;setError(false);if(canvas.current)void QRCode.toCanvas(canvas.current,value,{width:260,margin:2,errorCorrectionLevel:'M'}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[value]);
 return error?<p role="alert">Chưa hiển thị được QR. Mở trang cổng thanh toán để tiếp tục.</p>:<canvas ref={canvas} role="img" aria-label="Mã QR thanh toán phiếu thu"/>;
}
export function PatientPaymentPanel({scope,bill,onPaid,initiallyOpen=false}:{scope:api.PaymentScope;bill:PatientBill;onPaid:()=>void;initiallyOpen?:boolean}){
 const existing=bill.paymentIntents?.find(i=>['PENDING','CREATING','REVIEW_REQUIRED'].includes(i.status))??null;
 const [open,setOpen]=useState(initiallyOpen||!!existing),[methods,setMethods]=useState<api.PaymentMethod[]|null>(null),[provider,setProvider]=useState('');
 const [intent,setIntent]=useState<api.PaymentIntent|null>(existing),[transfer,setTransfer]=useState<api.BankTransfer|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 const [unknown,setUnknown]=useState<{body:{provider:string;expectedVersion:number};key:string}|null>(null);
 const attempt=useRef(crypto.randomUUID());
 const active=useRef(true),running=useRef(false),loaded=useRef(false);const paid=useRef(onPaid);paid.current=onPaid;
 useNavigationLock(busy?'Đợi kiểm tra thanh toán hoàn tất trước khi rời trang.':unknown?'Kiểm tra yêu cầu tạo liên kết hiện tại trước khi chuyển trang.':null);
 useEffect(()=>{if(intent&&['FAILED','EXPIRED','CANCELLED'].includes(intent.status))attempt.current=crypto.randomUUID();},[intent?.id,intent?.status]);
 useEffect(()=>{active.current=true;return()=>{active.current=false;};},[]);
 useEffect(()=>{if(open&&!loaded.current){loaded.current=true;void run(async()=>{const rows=await api.methods(scope,bill.id);if(active.current)setMethods(rows);});}},[open]);
 useEffect(()=>{if(!intent||!['PENDING','CREATING'].includes(intent.status))return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[intent?.id,intent?.status]);
 useEffect(()=>{
  if(!intent||!['PENDING','CREATING'].includes(intent.status))return;let tries=0;
  const timer=setInterval(()=>{if(++tries>60){clearInterval(timer);return;}if(!document.hidden)void check(false);},5000);
  return()=>clearInterval(timer);
 },[intent?.id,intent?.status]);
 async function run(work:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');try{await work();}catch(e){if(active.current)setError(e instanceof Error?e.message:'Chưa kiểm tra được thanh toán. Hãy thử lại.');}finally{running.current=false;if(active.current)setBusy(false);}}
 async function check(showBusy=true){
  if(!intent||running.current)return;
  const work=async()=>{const current=await api.read(scope,bill.id,intent.id,intent.provider==='PAYOS');if(!active.current)return;setIntent(current);if(current.status==='PAID')paid.current();};
  if(showBusy)await run(work);else{running.current=true;try{await work();}catch{/* Keep the source state on transient poll failures; manual check reports errors. */}finally{running.current=false;}}
 }
 async function send(body:{provider:string;expectedVersion:number},key:string){
  try{const result=await api.create(scope,bill.id,body,key);if(!active.current)return;setIntent(result);setUnknown(null);if(result.status==='PAID')paid.current();}
  catch(e){if(active.current){if(!(e instanceof RequestError)||e.status===0||e.status>=500)setUnknown({body,key});else setUnknown(null);}throw e;}
 }
 async function start(){
  if(provider==='ONSITE'){setTransfer(null);return;}
  if(provider==='BANK_TRANSFER'){const details=await api.bank(scope,bill.id);if(active.current)setTransfer(details);return;}
  const body={provider,expectedVersion:bill.version??0};const key=await stableOperationKey('invoice-online-create',{clinic:scope.clinic,branch:scope.branch,bill:bill.id,attempt:attempt.current,...body});await send(body,key);
 }
 async function cancel(){if(!intent)return;const key=await stableOperationKey('invoice-online-cancel',{clinic:scope.clinic,branch:scope.branch,bill:bill.id,id:intent.id});const result=await api.cancel(scope,bill.id,intent.id,key);if(active.current){setIntent(result);if(result.status==='PAID')paid.current();}}
 const reserved=!!intent&&['CREATING','PENDING','REVIEW_REQUIRED'].includes(intent.status)&&!(intent.status==='PENDING'&&Date.parse(intent.expiresAt)<=now);
 const seconds=intent?Math.max(0,Math.ceil((Date.parse(intent.expiresAt)-now)/1000)):0;
 const selected=methods?.find(m=>m.code===provider);
 const StateIcon=intent?.status==='PAID'?Check:intent?.status==='REVIEW_REQUIRED'||intent?.status==='FAILED'?CircleAlert:intent?.status==='CANCELLED'||intent?.status==='EXPIRED'?Link2Off:Clock3;
 const providerName=intent?.provider==='PAYOS'?'payOS':'VNPAY';
 return <section className={'invoice-payment'+(!open?' is-collapsed':'')} aria-label="Thanh toán phiếu thu" aria-busy={busy}>
  {!open?<>
   <span className="payment-intro-icon"><QrCode size={24} aria-hidden="true"/></span>
   <div><h4>Thanh toán thuận tiện</h4><p>Quét QR, thanh toán online hoặc trả phí tại quầy.</p></div>
   <button type="button" className="booking-primary payment-button" onClick={()=>setOpen(true)}>Chọn cách trả phí <ArrowRight size={18} aria-hidden="true"/></button>
  </>:<>
   <header className="payment-heading"><div><span className="payment-eyebrow">Thanh toán phiếu thu</span><h4>Số tiền cần thanh toán</h4></div><span className="payment-intro-icon"><QrCode size={24} aria-hidden="true"/></span></header>
   <p className="payment-amount">{money(bill.remainingVnd)}</p>
   {error&&<div role="alert" className="payment-notice payment-notice-error"><CircleAlert size={18} aria-hidden="true"/><p>{error}</p></div>}
   {!methods&&!busy&&<button type="button" className="payment-button payment-button-secondary" onClick={()=>void run(async()=>{setMethods(await api.methods(scope,bill.id));})}><RefreshCw size={17} aria-hidden="true"/>Tải lại phương thức</button>}
   {busy&&<p role="status" className="payment-loading"><LoaderCircle className="payment-spinner" size={18} aria-hidden="true"/>{!methods?'Đang tải phương thức thanh toán…':'Đang kiểm tra giao dịch…'}</p>}
   {intent&&<article className={'payment-status payment-status-'+intent.status.toLowerCase()}>
    <header className="payment-status-heading"><span className="payment-state-icon"><StateIcon size={21} aria-hidden="true"/></span><div><span className="payment-eyebrow">Giao dịch qua {providerName}</span><h5>{states[intent.status]??'Đang kiểm tra giao dịch'}</h5></div></header>
    <p role="status" className="payment-status-message">{intent.message}</p>
    <div className="payment-transaction-meta"><span>Số tiền giao dịch <strong>{money(intent.amountVnd)}</strong></span>
     {['CREATING','PENDING'].includes(intent.status)&&<span className="payment-timer" role="timer" aria-live="off"><Clock3 size={15} aria-hidden="true"/>{seconds>0?`Còn ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'Đã hết thời gian sử dụng'}</span>}
    </div>
    {intent.status==='PENDING'&&seconds>0&&(intent.qrCode||intent.checkoutUrl)&&<div className={'payment-checkout'+(intent.qrCode?' has-qr':'')}>
     {intent.qrCode&&<div className="payment-qr"><PaymentQr value={intent.qrCode}/><span>Quét bằng ứng dụng ngân hàng</span></div>}
     <div className="payment-checkout-copy"><h6>{intent.qrCode?'Quét mã để thanh toán':'Tiếp tục trên '+providerName}</h6><p>{intent.qrCode?'Kiểm tra số tiền và người nhận trong ứng dụng ngân hàng trước khi xác nhận.':'Chọn ngân hàng hoặc thẻ trên trang thanh toán. Biên nhận sẽ cập nhật khi giao dịch được xác nhận.'}</p>
      {intent.checkoutUrl&&<a className="booking-primary payment-button" href={intent.checkoutUrl} target="_blank" rel="noopener noreferrer">Mở {providerName} để thanh toán <ArrowUpRight size={18} aria-hidden="true"/></a>}
      {intent.checkoutUrl&&<small>Trang thanh toán mở trong tab mới.</small>}
     </div>
    </div>}
    <div className="payment-actions"><button type="button" className="payment-button payment-button-secondary" disabled={busy} onClick={()=>void check()}><RefreshCw size={16} aria-hidden="true"/>Kiểm tra trạng thái giao dịch</button>{intent.provider==='PAYOS'&&['PENDING','CREATING'].includes(intent.status)&&<button type="button" className="payment-button payment-button-quiet" disabled={busy} onClick={()=>void run(cancel)}>Hủy liên kết để chọn cách khác</button>}</div>
    <details className="payment-reference"><summary>Mã giao dịch để liên hệ</summary><code>{intent.id}</code></details>
   </article>}
   {unknown&&<div role="alert" className="payment-recovery"><CircleAlert size={22} aria-hidden="true"/><div><h5>Đang kiểm tra yêu cầu của bạn</h5><p>Chưa xác định được kết quả. Giữ nguyên yêu cầu này để tránh tạo thêm liên kết.</p><button type="button" className="payment-button payment-button-secondary" disabled={busy} onClick={()=>void run(()=>send(unknown.body,unknown.key))}><RefreshCw size={16} aria-hidden="true"/>Kiểm tra lại yêu cầu hiện tại</button></div></div>}
   {!reserved&&!unknown&&bill.remainingVnd>0&&<fieldset disabled={busy} className="payment-methods"><legend>Chọn phương thức thanh toán</legend>
    <div className="payment-method-grid">{methods?.map(m=>{const Icon=methodIcons[m.code as keyof typeof methodIcons]??CreditCard;return <label key={m.code} className={'payment-method '+(provider===m.code?'is-selected':'')+(!m.available?' is-unavailable':'')}>
     <input type="radio" name={'method-'+bill.id} value={m.code} checked={provider===m.code} disabled={!m.available} onChange={()=>{setProvider(m.code);setTransfer(null);}}/>
     <span className="payment-method-icon"><Icon size={22} aria-hidden="true"/></span>
     <span className="payment-method-copy"><strong>{m.name}</strong><small>{m.available?m.message:'Hiện chưa hỗ trợ. Vui lòng chọn phương thức khác.'}</small>{!m.available&&<span className="payment-method-tag">Chưa hỗ trợ</span>}{m.available&&/thử nghiệm|sandbox/i.test(m.message)&&<span className="payment-method-tag is-sandbox">Thử nghiệm</span>}</span>
    </label>;})}</div>
    {provider==='ONSITE'?<div className="payment-notice payment-onsite"><Building2 size={22} aria-hidden="true"/><div><strong>Thanh toán tại quầy lễ tân</strong><p>Đến quầy lễ tân để thanh toán. Biên nhận xuất hiện sau khi nhân viên xác nhận đã nhận tiền.</p></div></div>:<div className="payment-method-footer"><p>{selected?<>Đã chọn: <strong>{selected.name}</strong></>:'Chọn một phương thức để tiếp tục.'}</p><button type="button" className="booking-primary payment-button" disabled={!provider} onClick={()=>void run(start)}>{provider==='BANK_TRANSFER'?'Xem QR và tài khoản nhận tiền':'Tạo liên kết thanh toán'}<ArrowRight size={18} aria-hidden="true"/></button></div>}
   </fieldset>}
   {transfer&&<article className="bank-transfer"><div><span className="payment-eyebrow">Chuyển khoản ngân hàng</span><h5>Chuyển khoản đúng số tiền và nội dung</h5><dl><div><dt>Ngân hàng</dt><dd>{transfer.bankName}</dd></div><div><dt>Người nhận</dt><dd>{transfer.accountName}</dd></div><div><dt>Số tài khoản</dt><dd><code>{transfer.accountNumber}</code></dd></div><div><dt>Nội dung</dt><dd><code>{transfer.content}</code></dd></div><div><dt>Số tiền</dt><dd>{money(transfer.amountVnd)}</dd></div></dl><p className="payment-help">Lễ tân đối chiếu tiền vào trước khi ghi nhận. Nếu đã chuyển, liên hệ phòng khám và kiểm tra biên nhận; tránh chuyển lại.</p></div><div className="payment-qr"><img src={transfer.qrUrl} referrerPolicy="no-referrer" alt="QR chuyển khoản với số tiền và nội dung phiếu thu" width={260} height={300}/><span>Quét bằng ứng dụng ngân hàng</span></div></article>}
   <p className="payment-assurance"><ShieldCheck size={17} aria-hidden="true"/>Biên nhận chỉ cập nhật khi khoản thanh toán được xác nhận.</p>
  </>}
 </section>;
}
