import {useRef,useState} from 'react';
import * as api from '../api/reception';
import {RequestError} from '../api/booking';
import {stableOperationKey} from '../api/idempotency';
import {PatientIdentity} from './PatientIdentity';
export const receptionRequestNames:Record<string,string>={DOCTOR_CHANGE:'Đổi bác sĩ sau tiếp nhận',SPECIALTY_CHANGE:'Đổi chuyên khoa sau tiếp nhận',DOCTOR_UNAVAILABLE:'Bác sĩ không thể nhận khám',ROUTING_FAILURE:'Điều phối không thành công',NO_ELIGIBLE_DOCTOR:'Chưa có bác sĩ phù hợp',INCORRECT_SERVICE:'Chọn sai dịch vụ',DUPLICATE_CHECK_IN:'Nghi tiếp nhận trùng'};
export function ReceptionExceptionCenter({scope,requests,sourceExceptions,appointments,arrivals,tickets,draft,disabled,canManage,onPending,onUpdated}:{scope:api.Scope;requests:api.ReceptionRequest[];sourceExceptions:api.Exception[];appointments:api.Appointment[];arrivals:api.ArrivalRecovery[];tickets:api.Ticket[];draft:api.RequestInput|null;disabled:boolean;canManage:boolean;onPending:(value:boolean)=>void;onUpdated:()=>Promise<void>}){
 const [form,setForm]=useState<api.RequestInput|null>(draft),[busy,setBusy]=useState(false),[unknown,setUnknown]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const attempt=useRef<{body:api.RequestInput;key:string}|null>(null);
 async function send(){if(!form||busy)return;setBusy(true);setError('');onPending(true);
  try{if(!attempt.current){const body={...form,reason:form.reason.trim()};attempt.current={body,key:await stableOperationKey('reception-request',{clinic:scope.clinic,branch:scope.branch,...body})};}setUnknown(true);await api.createRequest(scope,attempt.current.body,attempt.current.key);attempt.current=null;setUnknown(false);onPending(false);setForm(null);setMessage('Đã tạo yêu cầu để Quản trị đối chiếu và xử lý.');await onUpdated();}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUnknown(false);onPending(false);}setError(e instanceof Error?e.message:'Chưa xác định kết quả gửi. Thử lại cùng yêu cầu.');}finally{setBusy(false);}
 }
 const pending=arrivals.filter(a=>a.visit.status==='ARRIVAL_PENDING'),absent=tickets.filter(t=>['SKIPPED','ABSENT'].includes(t.state));
 return <section className="reception-exception-center desk-list" aria-label="Trung tâm ngoại lệ"><div className="desk-list-heading"><div><h2>Ngoại lệ cần xử lý</h2><p>Đối chiếu người bệnh và nguyên nhân. Điều chuyển sau tiếp nhận cần Quản trị.</p></div><button type="button" className="booking-primary" disabled={disabled||busy||unknown} onClick={()=>setForm({type:'DOCTOR_UNAVAILABLE',reason:''})}>Tạo yêu cầu xử lý</button></div>
  {error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status">{message}</p>}
  {form&&<form className="reception-request-form" onSubmit={e=>{e.preventDefault();void send();}}><fieldset disabled={disabled||busy||unknown}><legend>Yêu cầu Quản trị xử lý</legend>
   <label>Trường hợp<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(receptionRequestNames).map(([type,name])=><option key={type} value={type}>{name}</option>)}</select></label>
   <label>Lượt khám liên quan<select value={form.visitId??''} onChange={e=>{const v=arrivals.find(a=>a.visit.id===e.target.value)?.visit;setForm({...form,visitId:v?.id??null,patientId:v?.patient?.patientId??null});}}><option value="">Sự cố chung tại quầy</option>{arrivals.map(a=><option key={a.visit.id} value={a.visit.id}>{a.visit.patient?.fullName??'Bệnh nhân'} · {a.visit.ticket?.code??a.visit.id}</option>)}</select></label>
   {form.patientId&&!form.visitId&&<p>Yêu cầu gắn với bệnh nhân đang tiếp nhận tại quầy.</p>}
   <label>Điều gì đã xảy ra?<textarea required maxLength={500} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})}/></label>
   <p className="muted-copy">Yêu cầu được lưu để theo dõi; bác sĩ và hàng đợi giữ nguyên cho tới khi người có quyền xử lý.</p>
   <button className="booking-primary" disabled={!form.reason.trim()}>Gửi yêu cầu xử lý</button><button className="button-secondary" type="button" onClick={()=>setForm(null)}>Đóng</button>
  </fieldset></form>}
  {unknown&&<p role="status">Chưa xác định kết quả gửi. <button type="button" className="button-secondary" disabled={busy} onClick={()=>void send()}>Thử lại yêu cầu đang chờ</button></p>}
  <div className="reception-exception-list">
   {sourceExceptions.map(e=><article key={e.id}><span className="task-status" data-state="OPEN">{e.type==='DOCTOR_ABSENT'?'Cần Quản trị':'Cần đối chiếu tại quầy'}</span><PatientIdentity patient={appointments.find(a=>a.id===e.appointmentId)?.patient}/><strong>{e.type==='DOCTOR_ABSENT'?'Bác sĩ vắng':e.type==='LATE'?'Bệnh nhân đến muộn':'Bệnh nhân không đến'}</strong><p>{e.type==='DOCTOR_ABSENT'?'Liên hệ Quản trị để xử lý lịch bị ảnh hưởng.':'Đối chiếu lịch hẹn và người bệnh trước khi tiếp nhận.'}</p><small>{e.notificationMode==='MANUAL_CONTACT_REQUIRED'?'Cần liên hệ bệnh nhân tại quầy':'Theo dõi thông báo từ hệ thống'}</small></article>)}
   {pending.map(a=><article key={a.visit.id}><PatientIdentity patient={a.visit.patient}/><strong>Tiếp nhận đang chờ xác nhận</strong><p>Đã có lượt tại máy chủ. Tra cứu kết quả gốc trước khi tiếp nhận lại.</p><button className="button-secondary" disabled={disabled||unknown} onClick={()=>setForm({visitId:a.visit.id,type:'DUPLICATE_CHECK_IN',reason:'Đối chiếu lượt tiếp nhận đang chờ xác nhận'})}>Yêu cầu đối chiếu lượt</button></article>)}
   {absent.map(t=><article key={t.id}><PatientIdentity patient={t.patient}/><strong>{t.code} · {t.state==='ABSENT'?'Đã đánh dấu vắng':'Tạm bỏ qua'}</strong><p>Kiểm tra bệnh nhân đã trở lại. Dùng “Đưa lại cuối hàng” tại Hàng đợi khi có mặt.</p></article>)}
   {requests.map(r=><article key={r.id}><span className="task-status" data-state="OPEN">Cần Quản trị</span><strong>{receptionRequestNames[r.type]??r.type}</strong><PatientIdentity patient={arrivals.find(a=>a.visit.id===r.visitId||a.visit.patient?.patientId===r.patientId)?.visit.patient}/><p>{r.reason}</p><small>{new Date(r.createdAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</small>{canManage&&<button className="button-secondary" disabled={disabled||busy||unknown} onClick={()=>{setBusy(true);setError('');void api.resolveRequest(scope,r.id,'Quản trị đã đối chiếu và xử lý ngoại lệ tại quầy').then(onUpdated).catch(e=>setError(e instanceof Error?e.message:'Chưa xác định kết quả xử lý.')).finally(()=>setBusy(false));}}>Xác nhận đã xử lý</button>}</article>)}
   {!sourceExceptions.length&&!pending.length&&!absent.length&&!requests.length&&<p className="desk-empty">Không có ngoại lệ cần xử lý trong dữ liệu đã đồng bộ.</p>}
  </div>
 </section>;
}
