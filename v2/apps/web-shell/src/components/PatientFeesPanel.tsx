import { useEffect, useRef, useState } from 'react';
import { ownBills, type PatientBill } from '../api/portal';

const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const status: Record<string,string> = { ISSUED: 'Chưa thu', PARTIALLY_PAID: 'Đã thu một phần', PAID: 'Đã thanh toán' };
const methods: Record<string,string> = { CASH: 'Tiền mặt tại quầy', BANK_TRANSFER: 'Chuyển khoản đã xác nhận tại quầy', POS: 'Thẻ tại quầy' };

export function PatientFeesPanel({ token, clinic, branch, branchName }: { token: string; clinic: string; branch: string; branchName: string }) {
 const [bills,setBills] = useState<PatientBill[] | null>(null);
 const [busy,setBusy] = useState(false);
 const [error,setError] = useState('');
 const epoch = useRef(0);
 useEffect(() => { epoch.current++; setBills(null);setError('');setBusy(false);return () => { epoch.current++; }; },[token,clinic,branch]);
 async function reload() {
  if(busy || !token || !branch) return;
  const current=++epoch.current;setBusy(true);setBills(null);setError('');
  try { const rows=await ownBills(token,clinic,branch); if(current===epoch.current)setBills(rows); }
  catch(e) { if(current===epoch.current)setError(e instanceof Error ? e.message : 'Không thể tải khoản phải thu. Hãy thử lại.'); }
  finally { if(current===epoch.current)setBusy(false); }
 }
 return <section className="public-section booking-panel patient-fees" aria-labelledby="patient-fees-title">
  <h2 id="patient-fees-title">Khoản phải thu và biên nhận của tôi</h2>
  {!branch ? <p>Chọn chi nhánh để xem khoản phải thu của bạn.</p> : <><p>{branchName}</p><button className="button-secondary" disabled={busy} onClick={() => void reload()}>Tải khoản phải thu của tôi</button></>}
  {busy && <p role="status">Đang tải khoản phải thu…</p>}{error && <p role="alert" className="booking-error">{error}</p>}
  {bills?.length === 0 && <p role="status">Chưa có phiếu thu cho hồ sơ của bạn tại chi nhánh này.</p>}
  {bills?.map(b => <article className="booking-appointment" key={b.id}>
   <h3>Phiếu thu · {when(b.issuedAt)}</h3><p>{status[b.status] ?? b.status}</p>
   <ul>{b.lines.map((line,i) => <li key={i}>{line.name} · {money(line.amountVnd)}</li>)}</ul>
   <p>Tổng dịch vụ: {money(b.subtotalVnd)} · Giảm đã duyệt: {money(b.adjustmentVnd)}</p>
   <p>Đã nhận: {money(b.paidVnd)} · Còn phải thu: {money(b.remainingVnd)}</p>
   {b.receipts.map(r => <details key={r.id}><summary>{r.receiptCode} · {money(r.amountVnd)}</summary><p>{r.label}</p><p>{methods[r.method] ?? r.method} · {when(r.createdAt)}</p></details>)}
  </article>)}
  <p>Khoản thu tại quầy được cập nhật sau khi phòng khám xác nhận đã nhận tiền.</p>
 </section>;
}
