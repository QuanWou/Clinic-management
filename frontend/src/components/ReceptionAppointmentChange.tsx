import {useEffect,useRef,useState} from 'react';
import * as api from '../api/reception';
import {getBookingOptions,getAvailabilityResult,RequestError,type BookingOptions,type Slot,type Hold} from '../api/booking';
import {stableOperationKey} from '../api/idempotency';
import {formatVnd} from '../utils/vnd';
import {specialtyDisplay} from '../utils/specialty';

export function ReceptionAppointmentChange({scope,appointment,doctors=[],offerings=[],disabled,onPending,onReady,onChanged}:{scope:api.Scope;appointment:api.Appointment;doctors?:api.Doctor[];offerings?:api.ReceptionOffering[];disabled:boolean;onPending:(value:boolean)=>void;onReady:(value:boolean)=>void;onChanged:(a:api.AppointmentDetail)=>Promise<void>}){
 const [detail,setDetail]=useState<api.AppointmentDetail|null>(null),[options,setOptions]=useState<BookingOptions|null>(null);
 const [specialty,setSpecialty]=useState(''),[doctor,setDoctor]=useState(''),[offering,setOffering]=useState(''),[slot,setSlot]=useState(''),[slots,setSlots]=useState<Slot[]>([]);
 const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),[note,setNote]=useState(''),[reason,setReason]=useState('Bệnh nhân yêu cầu đổi lựa chọn trước tiếp nhận');
 const attempt=useRef<{body:{patientId:string;offeringId:string;doctorId:string;slotId:string;expectedVersion:number};key:string;hold?:Hold;reason:string}|null>(null);
 useEffect(()=>{
  let active=true;onReady(false);setDetail(null);setError('');
  void api.appointmentDetail(scope,appointment.id).then(a=>{if(active){setDetail(a);onReady(a.status==='CONFIRMED');}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chưa xác minh được lựa chọn đặt khám.');});
  return()=>{active=false;};
 },[scope.token,scope.clinic,scope.branch,appointment.id]);
 async function begin(){setBusy(true);setError('');try{const o=await getBookingOptions(scope.clinic,scope.branch);setOptions(o);setSpecialty(o.doctors.find(d=>d.doctorId===detail?.doctorId)?.specialtyCode??'');setDoctor(detail?.doctorId??'');setOffering(detail?.offeringId??'');setSlots([]);setSlot('');setEditing(true);}catch(e){setError(e instanceof Error?e.message:'Chưa đọc được lựa chọn hợp lệ.');}finally{setBusy(false);}}
 async function availability(){setBusy(true);setSlots([]);setSlot('');setError('');setNote('');try{
  const result=await getAvailabilityResult({clinicId:scope.clinic,branchId:scope.branch,offeringId:offering,doctorId:doctor,date:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(appointment.startsAt))});
  setSlots(result.slots);if(!result.available)setNote('Không có giờ khám còn trống cho lựa chọn này. Chọn bác sĩ hoặc dịch vụ khác.');
 }catch(e){setError(e instanceof Error?e.message:'Chưa kiểm tra được lịch làm việc.');}finally{setBusy(false);}}
 async function commit(){if(!detail||busy)return;setBusy(true);setError('');onPending(true);
  try{
   if(!attempt.current){const body={patientId:appointment.patientId,offeringId:offering,doctorId:doctor,slotId:slot,expectedVersion:detail.version};attempt.current={body,key:await stableOperationKey('reception-change',{clinic:scope.clinic,branch:scope.branch,appointment:appointment.id,...body}),reason};}
   const original=attempt.current;setUncertain(true);
   if(!original.hold)original.hold=await api.changeHold(scope,appointment.id,original.body,original.key);
   const result=await api.changeAppointment(scope,appointment.id,{patientId:original.body.patientId,newHoldId:original.hold.holdId,expectedVersion:original.body.expectedVersion,reason:original.reason});
   setDetail(result);attempt.current=null;setUncertain(false);onPending(false);setEditing(false);onReady(result.status==='CONFIRMED');await onChanged(result);
  }catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){attempt.current=null;setUncertain(false);onPending(false);onReady(false);}setError(e instanceof Error?e.message:'Chưa xác định kết quả đổi lựa chọn. Thử lại yêu cầu đang chờ.');}finally{setBusy(false);}
 }
 return <div className="reception-booked-service">
  {error&&<p role="alert" className="booking-error">{error}</p>}
  {error&&!uncertain&&<button type="button" className="button-secondary" disabled={busy||disabled} onClick={()=>{setBusy(true);void api.appointmentDetail(scope,appointment.id).then(a=>{setDetail(a);setError('');onReady(a.status==='CONFIRMED');}).catch(e=>setError(e instanceof Error?e.message:'Chưa xác minh được lịch.')).finally(()=>setBusy(false));}}>Xác minh lại lựa chọn đặt khám</button>}
  {!detail&&!error&&<p role="status">Đang xác minh bác sĩ, dịch vụ và giá đặt khám…</p>}
  {detail&&<><p><strong>Dịch vụ đã đặt</strong><br/>{options?.offerings.find(o=>o.offeringId===detail.offeringId)?.name??offerings.find(o=>o.offering.id===detail.offeringId)?.offering.name??'Dịch vụ theo lịch hẹn'} · {formatVnd(detail.price.amountVnd)}</p>
   <p>{(()=>{const d=doctors.find(d=>d.practitionerId===detail.doctorId);return d?specialtyDisplay(d.specialtyCode,d.specialtyName):'Chuyên khoa theo lịch đã đặt';})()} · {doctors.find(d=>d.practitionerId===detail.doctorId)?.displayName??'Bác sĩ theo lịch đã đặt'}</p>
   <p className="muted-copy">Lựa chọn được kiểm tra lại trước tiếp nhận. Chỉ đổi sang giờ, chuyên khoa và bác sĩ còn phù hợp.</p>
   {!editing&&<button type="button" className="button-secondary" disabled={disabled||busy||detail.status!=='CONFIRMED'} onClick={()=>void begin()}>Đổi chuyên khoa / bác sĩ trước tiếp nhận</button>}
  </>}
  {uncertain&&<p role="status">Giữ nguyên yêu cầu để tránh đổi lịch hai lần. <button type="button" className="button-secondary" disabled={busy} onClick={()=>void commit()}>Thử lại đổi lựa chọn đang chờ</button></p>}
  {editing&&options&&<fieldset disabled={disabled||busy||uncertain} className="reception-change-fields"><legend>Lựa chọn thay thế</legend>
   <label>Chuyên khoa thay thế<select value={specialty} onChange={e=>{setSpecialty(e.target.value);setDoctor('');setOffering('');setSlots([]);setSlot('');}}><option value="">Chọn chuyên khoa</option>{options.specialties.map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
   <label>Bác sĩ thay thế<select value={doctor} onChange={e=>{setDoctor(e.target.value);setSlots([]);setSlot('');}}><option value="">Chọn bác sĩ</option>{options.doctors.filter(d=>d.specialtyCode===specialty).map(d=><option key={d.doctorId} value={d.doctorId}>{d.displayName}</option>)}</select></label>
   <label>Dịch vụ thay thế<select value={offering} onChange={e=>{setOffering(e.target.value);setSlots([]);setSlot('');}}><option value="">Chọn dịch vụ</option>{options.offerings.filter(o=>o.specialtyCode===specialty).map(o=><option key={o.offeringId} value={o.offeringId}>{o.name}</option>)}</select></label>
   <button type="button" className="button-secondary" disabled={!doctor||!offering} onClick={()=>void availability()}>Kiểm tra giờ còn trống</button>
   {note&&<p role="status">{note}</p>}
   <label>Giờ khám thay thế<select value={slot} onChange={e=>setSlot(e.target.value)}><option value="">Chọn giờ được máy chủ xác nhận</option>{slots.map(s=><option key={s.slotId} value={s.slotId}>{new Date(s.startsAt).toLocaleTimeString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit'})} · {formatVnd(s.price.amountVnd)}</option>)}</select></label>
   <label>Lý do đổi<textarea value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label>
   <button type="button" className="booking-primary" disabled={!slot||!reason.trim()} onClick={()=>void commit()}>Xác nhận đổi lựa chọn</button>
   <button type="button" className="button-secondary" onClick={()=>setEditing(false)}>Giữ lựa chọn đã đặt</button>
  </fieldset>}
 </div>;
}
