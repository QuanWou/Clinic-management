import {useAuthoritativeSync} from './useAuthoritativeSync';
import {receptionSubscription} from '../api/realtime';
import {useEffect,useState} from 'react';
import {staffIntents,type PaymentIntent,type PaymentScope} from '../api/payments';
import {ArrowUpRight,Check,CircleAlert,Clock3,Wallet} from 'lucide-react';
const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND'}).format(n);
const states:Record<string,string>={PAID:'Đã xác nhận tiền',PENDING:'Chờ cổng xác nhận',CREATING:'Chưa rõ kết quả tạo liên kết',REVIEW_REQUIRED:'Cần đối chiếu tiền vào',EXPIRED:'Liên kết hết hạn',CANCELLED:'Đã hủy liên kết',FAILED:'Giao dịch thất bại'};
export function OnlinePaymentsPanel({scope,billId}:{scope:PaymentScope;billId:string}){
 const [rows,setRows]=useState<PaymentIntent[]|null>(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;setRows(null);setError('');void staffIntents(scope,billId).then(value=>{if(active)setRows(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chưa đồng bộ được giao dịch online.');});return()=>{active=false;};},[scope.token,scope.clinic,scope.branch,billId]);
 useAuthoritativeSync({key:scope.token+scope.clinic+scope.branch+billId,enabled:!!scope.token&&!!billId,subscriptions:[receptionSubscription(scope,'billing')],refresh:async context=>{try{const value=await staffIntents(scope,billId);if(context.current()){setRows(value);setError('');}}catch(e){if(context.current())setError('Chưa cập nhật được giao dịch online. Hệ thống sẽ thử lại.');throw e;}},onDenied:()=>{setRows(null);setError('Quyền truy cập giao dịch đã thay đổi.');}});
 const reviewCount=rows?.filter(r=>r.status==='REVIEW_REQUIRED').length??0;
 return <details className="online-payments"><summary><span className="online-payments-title"><Wallet size={19} aria-hidden="true"/>Giao dịch online của phiếu thu</span>{rows&&<span className={'invoice-badge '+(reviewCount?'is-review':'')}>{reviewCount?`${reviewCount} cần đối chiếu`:`${rows.length} giao dịch`}</span>}</summary>
  <div className="online-payments-body"><div className="online-payments-toolbar"><p>Giao dịch online cập nhật công nợ riêng, không cộng vào ca thu tại quầy.</p></div>
   {error&&<p role="alert" className="payment-notice payment-notice-error">{error}</p>}{!rows&&!error&&<p role="status" className="payment-loading">Đang đồng bộ giao dịch online…</p>}
   {rows?.length===0&&<p className="online-payments-empty"><ArrowUpRight size={22} aria-hidden="true"/>Chưa có giao dịch online.</p>}
   {rows?.map(row=><article className="online-payment-row" key={row.id}><header><div><span className="payment-eyebrow">{row.provider==='PAYOS'?'payOS':row.provider}</span><strong>{money(row.amountVnd)}</strong></div><span className={'invoice-badge '+(row.status==='PAID'?'is-paid':row.status==='REVIEW_REQUIRED'?'is-review':'')}>{row.status==='PAID'?<Check size={15} aria-hidden="true"/>:row.status==='REVIEW_REQUIRED'?<CircleAlert size={15} aria-hidden="true"/>:<Clock3 size={15} aria-hidden="true"/>}{states[row.status]??row.status}</span></header><p>{row.message}</p>{row.status==='REVIEW_REQUIRED'&&<p className="payment-notice">Đối chiếu giao dịch ngân hàng với Quản trị trước khi thu thêm tiền hoặc xử lý hoàn tiền.</p>}<details className="payment-reference"><summary>Mã tra cứu</summary><code>{row.id}</code></details></article>)}
  </div>
 </details>;
}
