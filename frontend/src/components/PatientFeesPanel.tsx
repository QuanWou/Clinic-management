import {PatientPaymentPanel} from './PatientPaymentPanel';
import { useEffect, useRef, useState } from 'react';
import { ownBills, type PatientBill } from '../api/portal';
import {ArrowDownLeft,Check,Clock3,ReceiptText,RefreshCw,ShieldCheck,Wallet} from 'lucide-react';

const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const status: Record<string,string> = { ISSUED: 'Chưa thu', PARTIALLY_PAID: 'Đã thu một phần', PAID: 'Đã thanh toán' };
const methods: Record<string,string> = { CASH: 'Tiền mặt tại quầy', BANK_TRANSFER: 'Chuyển khoản đã xác nhận tại quầy', POS: 'Thẻ tại quầy',PAYOS:'QR qua payOS',VNPAY:'Thanh toán qua VNPAY' };

export function PatientFeesPanel({ token, clinic, branch, branchName }: { token: string; clinic: string; branch: string; branchName: string }) {
 const [bills,setBills] = useState<PatientBill[] | null>(null);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const epoch = useRef(0);
 useEffect(() => { epoch.current++; setBills(null);setError('');setBusy(false);void reload();return () => { epoch.current++; }; },[token,clinic,branch]);
 async function reload() {
  if(busy || !token || !branch) return;
  const current=++epoch.current;setBusy(true);setBills(null);setError('');
  try { const rows=await ownBills(token,clinic,branch); if(current===epoch.current)setBills(rows); }
  catch(e) { if(current===epoch.current)setError(e instanceof Error ? e.message : 'Không thể tải khoản phải thu. Hãy thử lại.'); }
  finally { if(current===epoch.current)setBusy(false); }
 }
 const singleUnpaid=bills?.filter(b=>b.remainingVnd>0).length===1;
 return <section className="public-section booking-panel patient-fees" aria-labelledby="patient-fees-title">
  <header className="patient-fees-heading"><div><span className="payment-eyebrow">{branchName||'Hồ sơ của bạn'}</span><h2 id="patient-fees-title">Chi phí & thanh toán</h2><p>Xem chi tiết dịch vụ, trả phí và tra cứu biên nhận tại đây.</p></div>
   {branch&&<button type="button" className="payment-button payment-button-secondary" aria-label="Tải khoản phải thu của tôi" title="Cập nhật chi phí" disabled={busy} onClick={()=>void reload()}><RefreshCw size={17} aria-hidden="true"/><span>Cập nhật</span></button>}
  </header>
  {!branch&&<p>Chọn địa điểm để xem khoản phải thu của bạn.</p>}
  {busy&&<p role="status" className="payment-loading"><RefreshCw size={17} aria-hidden="true"/>Đang tải khoản phải thu…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
  {bills?.length===0&&<div className="patient-fees-empty" role="status"><ReceiptText size={30} aria-hidden="true"/><h3>Chưa có khoản phí cần xem</h3><p>Chưa có phiếu thu cho hồ sơ của bạn tại địa điểm này.</p></div>}
  {!!bills?.length&&<div className="patient-fees-overview" aria-label="Tổng hợp chi phí của các phiếu đã tải">
   <div className="is-outstanding"><span><Wallet size={18} aria-hidden="true"/>Cần thanh toán</span><strong>{money(bills.reduce((sum,b)=>sum+b.remainingVnd,0))}</strong></div>
   <div><span><ArrowDownLeft size={18} aria-hidden="true"/>Đã thanh toán</span><strong>{money(bills.reduce((sum,b)=>sum+b.paidVnd,0))}</strong></div>
   <div><span><ReceiptText size={18} aria-hidden="true"/>Phiếu thu đã tải</span><strong>{bills.length.toLocaleString('vi-VN')}</strong></div>
  </div>}
  {bills?.map(b=><article className="booking-appointment patient-invoice" key={b.id}>
   <header className="patient-invoice-heading"><div><span className="patient-invoice-icon"><ReceiptText size={23} aria-hidden="true"/></span><div><h3>Phiếu thu khám bệnh</h3><time dateTime={b.issuedAt}>{when(b.issuedAt)}</time></div></div><span className={'invoice-badge '+(b.status==='PAID'?'is-paid':'is-unpaid')}>{b.status==='PAID'?<Check size={15} aria-hidden="true"/>:<Clock3 size={15} aria-hidden="true"/>}{status[b.status]??b.status}</span></header>
   <div className={'patient-invoice-layout'+(b.remainingVnd>0?' has-payment':'')}>
    <div className="patient-invoice-detail"><h4>Chi tiết dịch vụ</h4>
     <ul className="patient-invoice-lines" aria-label="Dịch vụ trên phiếu thu">{b.lines.map((line,i)=><li key={i}><span>{line.name}</span><strong>{money(line.amountVnd)}</strong></li>)}</ul>
     <dl className="patient-invoice-totals"><div><dt>Tổng dịch vụ</dt><dd>{money(b.subtotalVnd)}</dd></div><div><dt>Giảm đã duyệt</dt><dd>{money(b.adjustmentVnd)}</dd></div><div><dt>Đã nhận</dt><dd>{money(b.paidVnd)}</dd></div></dl>
     <p className="patient-invoice-balance">Còn phải thu: <strong>{money(b.remainingVnd)}</strong></p>
     {!!b.receipts.length&&<div className="patient-receipts"><h4>Biên nhận thanh toán</h4>{b.receipts.map(r=><details key={r.id}><summary><span><ReceiptText size={16} aria-hidden="true"/>{r.receiptCode.length>24?r.receiptCode.slice(0,12)+'…'+r.receiptCode.slice(-8):r.receiptCode}</span><strong>{money(r.amountVnd)}</strong></summary><p>Mã biên nhận đầy đủ: <code>{r.receiptCode}</code></p><p>{r.label}</p><p>{methods[r.method]??r.method} · {when(r.createdAt)}</p></details>)}</div>}
    </div>
    {b.remainingVnd>0&&<PatientPaymentPanel key={token+clinic+branch+b.id} scope={{token,clinic,branch}} bill={b} onPaid={()=>void reload()} initiallyOpen={singleUnpaid}/>}
   </div>
  </article>)}
  <p className="patient-fees-note"><ShieldCheck size={18} aria-hidden="true"/>Đã chuyển tiền nhưng chưa có biên nhận? Liên hệ lễ tân trước khi thanh toán lại.</p>
 </section>;
}
