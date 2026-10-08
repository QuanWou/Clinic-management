import {useAuthoritativeSync,type SyncContext} from './useAuthoritativeSync';
import {displaySubscription} from '../api/realtime';
import {useEffect,useRef,useState} from 'react';
import QRCode from 'qrcode';
import {Check,CircleAlert,Clock3,Landmark,LoaderCircle,RefreshCw,ShieldCheck} from 'lucide-react';
import {paymentDisplay,type PaymentDisplayView} from '../api/payments';
import {getSiteClinic} from '../api/booking';
import '../styles/payment-display.css';

const money=(value:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(value);

function QrCanvas({value}:{value:string}){
 const canvas=useRef<HTMLCanvasElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let active=true;setFailed(false);if(canvas.current)void QRCode.toCanvas(canvas.current,value,{width:340,margin:2,errorCorrectionLevel:'M'}).catch(()=>{if(active)setFailed(true);});return()=>{active=false;};},[value]);
 return failed?<p className="payment-display-error">Chưa hiển thị được mã QR. Vui lòng báo nhân viên tại quầy.</p>:<canvas ref={canvas} role="img" aria-label="Mã QR thanh toán"/>;
}

export function CustomerPaymentDisplay({token}:{token:string}){
 const [clinic,setClinic]=useState('Phòng khám'),[view,setView]=useState<PaymentDisplayView|null>(null),[error,setError]=useState(''),[reconnecting,setReconnecting]=useState(false);const viewRef=useRef<PaymentDisplayView|null>(null);
 useEffect(()=>{let active=true;void getSiteClinic().then(c=>{if(active)setClinic(c.name);}).catch(()=>{});return()=>{active=false;};},[]);
 const terminal=!!view&&['PAID','EXPIRED','CANCELLED','FAILED'].includes(view.status);
 async function sync(context?:SyncContext){
  try{const next=await paymentDisplay(token);if(context&&!context.current())return;if(viewRef.current?.status==='PAID'&&next.status!=='PAID')return;viewRef.current=next;setView(next);setError('');}
  catch(e){if(context&&!context.current())return;setError(e instanceof Error?e.message:'Không tải được mã thanh toán.');throw e;}
 }
 useEffect(()=>{viewRef.current=null;setView(null);setError('');let active=true;if(token!=='loading'&&token!=='error')void sync({current:()=>active}).catch(()=>{});return()=>{active=false;};},[token]);
 const realtime=useAuthoritativeSync({key:token,enabled:token!=='loading'&&token!=='error'&&!terminal,subscriptions:[displaySubscription(token)],intervalMs:15000,refresh:sync,onDenied:()=>{setView(null);viewRef.current=null;setError('Mã hiển thị không còn hiệu lực. Vui lòng báo nhân viên tại quầy.');}});
 useEffect(()=>setReconnecting(realtime!=='connected'&&!terminal),[realtime,terminal]);

 if(token==='loading')return <main className="customer-payment-display is-loading"><div className="payment-display-card"><LoaderCircle className="payment-display-spinner" size={34}/><h1>Đang chuẩn bị mã thanh toán...</h1><p>Vui lòng chờ trong giây lát.</p></div></main>;
 if(token==='error')return <main className="customer-payment-display"><div className="payment-display-card payment-display-state"><CircleAlert size={46}/><h1>Chưa tạo được mã thanh toán</h1><p>Vui lòng báo nhân viên tại quầy để thử lại.</p></div></main>;
 if(error&&!view)return <main className="customer-payment-display"><div className="payment-display-card payment-display-state"><CircleAlert size={46}/><h1>Không mở được màn hình thanh toán</h1><p>{error}</p><button onClick={()=>void sync().catch(()=>{})}><RefreshCw size={17}/> Thử lại</button></div></main>;
 if(!view)return <main className="customer-payment-display is-loading"><div className="payment-display-card"><LoaderCircle className="payment-display-spinner" size={34}/><h1>Đang tải thanh toán...</h1></div></main>;

 const paid=view.status==='PAID',review=view.status==='REVIEW_REQUIRED',expired=['EXPIRED','CANCELLED','FAILED'].includes(view.status);
 const title=paid?'THANH TOÁN THÀNH CÔNG':review?'GIAO DỊCH ĐANG ĐƯỢC KIỂM TRA':expired?'MÃ THANH TOÁN KHÔNG CÒN HIỆU LỰC':'THANH TOÁN';
 const StatusIcon=paid?Check:review||expired?CircleAlert:Clock3;
 return <main className={'customer-payment-display status-'+view.status.toLowerCase()}>
  <section className="payment-display-card">
   <header className="payment-display-brand"><span className="payment-display-logo"><ShieldCheck size={28}/></span><div><small>PHÒNG KHÁM</small><strong>{clinic}</strong></div></header>
   <div className="payment-display-status"><StatusIcon size={24}/><span>{title}</span></div>
   {!paid&&!review&&!expired&&<div className="payment-display-qr">
    {view.qrCode?<QrCanvas value={view.qrCode}/>:view.qrUrl?<img src={view.qrUrl} referrerPolicy="no-referrer" alt="QR chuyển khoản ngân hàng"/>:<CircleAlert size={42}/>}
    <strong>QUÉT MÃ ĐỂ THANH TOÁN</strong>
    <span>Quét bằng ứng dụng ngân hàng trên điện thoại</span>
   </div>}
   <div className="payment-display-amount"><span>SỐ TIỀN</span><strong>{money(view.amountVnd)}</strong></div>
   {view.method==='BANK_TRANSFER'&&!paid&&<dl className="payment-display-bank">
    <div><dt><Landmark size={16}/> Ngân hàng</dt><dd>{view.bankName}</dd></div>
    <div><dt>Người nhận</dt><dd>{view.accountName}</dd></div>
    <div><dt>Số tài khoản</dt><dd>{view.accountNumber}</dd></div>
    <div><dt>Nội dung chuyển khoản</dt><dd className="payment-display-reference">{view.transferContent}</dd></div>
   </dl>}
   <div className="payment-display-message" role="status">
    {!paid&&!review&&!expired&&<span className="payment-display-dot"/>}
    <p>{paid?'Cảm ơn bạn. Vui lòng tiếp tục theo hướng dẫn của nhân viên phòng khám.':review?'Giao dịch đang được phòng khám kiểm tra. Vui lòng không thanh toán thêm.':expired?'Vui lòng liên hệ nhân viên tại quầy để tạo mã thanh toán mới.':view.method==='BANK_TRANSFER'?'Đang chờ nhân viên xác nhận thanh toán.':'Đang chờ cổng thanh toán xác nhận.'}</p>
   </div>
   {reconnecting&&<p className="payment-display-reconnect">Đang kết nối lại…</p>}
  </section>
 </main>;
}
