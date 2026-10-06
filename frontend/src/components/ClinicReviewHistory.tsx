import {useEffect,useState} from 'react';
import {ClipboardCheck,History} from 'lucide-react';
import * as api from '../api/platform';
import {stateName} from '../utils/display';
import {ManagementTable} from './ManagementTable';
const dateLabel=(value:string)=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'});
export function ClinicReviewHistory({token,clinicId,revision}:{token:string;clinicId:string;revision:number}){
 const [rows,setRows]=useState<api.Review[]|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true;setRows(null);setError('');void api.history(token,clinicId).then(value=>{if(active)setRows(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chưa tải được lịch sử hồ sơ.');});return()=>{active=false;};},[token,clinicId,revision,attempt]);
 if(error)return <div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(v=>v+1)}>Tải lại lịch sử hồ sơ</button></div>;
 if(!rows)return <p role="status">Đang tải lịch sử hồ sơ…</p>;
 const sorted=[...rows].sort((a,b)=>new Date(b.occurredAt).getTime()-new Date(a.occurredAt).getTime()),latest=sorted[0];
 return <section className="clinic-review-history"><div className="review-section-heading"><ClipboardCheck size={22} aria-hidden="true"/><h2>Quyết định và yêu cầu bổ sung</h2></div>{latest?<><div className="review-latest"><div className="review-decision-meta"><span className="task-status" data-state={latest.action}>{stateName(latest.action)}</span><time dateTime={latest.occurredAt}>{dateLabel(latest.occurredAt)}</time></div><div className="review-decision-content"><span className="context-label">Nội dung ghi nhận gần nhất</span><p>{latest.reason||'Không có ghi chú bổ sung.'}</p></div></div><details className="review-history-disclosure"><summary><History size={18} aria-hidden="true"/><span>Lịch sử hồ sơ</span><span className="review-history-count">{rows.length} lần ghi nhận</span></summary><p className="muted-copy">Các lần cập nhật được sắp xếp từ mới nhất đến cũ nhất.</p><ManagementTable caption="Lịch sử hồ sơ phòng khám" headers={['Thời điểm','Quyết định','Nội dung']} empty={!rows.length}>{sorted.map(row=><tr key={row.id}><td className="management-nowrap"><time dateTime={row.occurredAt}>{dateLabel(row.occurredAt)}</time></td><td><span className="task-status" data-state={row.action}>{stateName(row.action)}</span></td><td className="review-history-reason">{row.reason||'Không có ghi chú bổ sung.'}<details className="review-event-details"><summary>Thông tin ghi nhận</summary><small>Mã người thực hiện: {row.actorUserId}</small></details></td></tr>)}</ManagementTable></details></>:<p className="management-empty">Chưa có quyết định kiểm duyệt.</p>}</section>;
}
