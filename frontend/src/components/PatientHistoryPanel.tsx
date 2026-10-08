import {useAuthoritativeSync} from './useAuthoritativeSync';
import {appointmentSubscription,patientSubscription} from '../api/realtime';
import { useEffect, useRef, useState } from 'react';
import { ownClinics, ownMedicalRecords, type PatientClinic, type FollowUpPlan, type PatientMedicalRecord } from '../api/portal';
import { myAppointments, type Appointment } from '../api/booking';
import { PatientFeesPanel } from './PatientFeesPanel';
import { PatientFollowUpPanel } from './PatientFollowUpPanel';

const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const dateOnly=(s:string)=>new Intl.DateTimeFormat('vi-VN',{dateStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(s));
const labels: Record<string,string>={CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy',CHECKED_IN:'Đã tiếp nhận',FULFILLED:'Đã hoàn tất lượt khám'};

export function PatientHistoryPanel({ token, patientId, onFollowUp,clinicId,mode='all' }: {token:string;patientId:string;clinicId?:string;mode?:'all'|'history'|'fees';onFollowUp:(plan:FollowUpPlan)=>Promise<void>}) {
 const [clinics,setClinics]=useState<PatientClinic[] | null>(null),[clinic,setClinic]=useState(''),[branch,setBranch]=useState('');
 const [appointments,setAppointments]=useState<Appointment[] | null>(null),[records,setRecords]=useState<PatientMedicalRecord[]|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setClinics(null);setClinic('');setBranch('');setAppointments(null);setRecords(null);setError('');setBusy(false);return()=>{epoch.current++;};},[token,patientId]);

 async function load(background=false){
  const current=++epoch.current;setBusy(true);setClinics(null);setClinic('');setBranch('');setAppointments(null);setRecords(null);setError('');
  try{
   const source=await ownClinics(token),list=clinicId?source.filter(c=>c.clinicId===clinicId):source;
   if(current!==epoch.current)return;setClinics(list);
   if(clinicId&&list.length===1){
    const selected=list[0],defaultBranch=selected.branches.length===1?selected.branches[0].branchId:'';
    setClinic(selected.clinicId);setBranch(defaultBranch);
    const [visits,medicalRecords]=await Promise.all([myAppointments(token,selected.clinicId,patientId),defaultBranch?ownMedicalRecords(token,selected.clinicId,defaultBranch):Promise.resolve(null)]);
    if(current===epoch.current){setAppointments(visits);setRecords(medicalRecords);}
   }
  }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải lịch sử.');if(background)throw e;}
  finally{if(current===epoch.current)setBusy(false);}
 }
 async function choose(id:string){
  const current=++epoch.current;setClinic(id);setBranch('');setAppointments(null);setRecords(null);setError('');
  if(!id){setBusy(false);return;}setBusy(true);
  try{
   const selected=clinics?.find(c=>c.clinicId===id),defaultBranch=selected?.branches.length===1?selected.branches[0].branchId:'';
   if(defaultBranch)setBranch(defaultBranch);
   const [list,medicalRecords]=await Promise.all([myAppointments(token,id,patientId),defaultBranch?ownMedicalRecords(token,id,defaultBranch):Promise.resolve(null)]);
   if(current===epoch.current){setAppointments(list);setRecords(medicalRecords);}
  }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải lịch.');}
  finally{if(current===epoch.current)setBusy(false);}
 }
 async function chooseBranch(id:string){
  const current=++epoch.current;setBranch(id);setRecords(null);setError('');if(!id)return;setBusy(true);
  try{const list=await ownMedicalRecords(token,clinic,id);if(current===epoch.current)setRecords(list);}
  catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải hồ sơ khám.');}
  finally{if(current===epoch.current)setBusy(false);}
 }
 useEffect(()=>{if(clinicId)void load();},[token,patientId,clinicId]);
 useAuthoritativeSync({key:token+patientId+(clinicId??''),enabled:!!token&&!!clinicId&&!clinic,blocked:busy,refresh:async()=>{await load(true);}});
 useAuthoritativeSync({key:token+patientId+clinic+branch,enabled:!!token&&!!clinic,blocked:busy,subscriptions:[appointmentSubscription(token,clinic,patientId),...(branch?[patientSubscription({token,clinic,branch},'encounter'),patientSubscription({token,clinic,branch},'medical')]:[])],refresh:async context=>{
  const current=epoch.current;const [visits,medicalRecords]=await Promise.all([myAppointments(token,clinic,patientId),branch?ownMedicalRecords(token,clinic,branch):Promise.resolve(null)]);
  if(context.current()&&current===epoch.current){setAppointments(visits);setRecords(medicalRecords);setError('');}
 },onDenied:()=>{epoch.current++;setAppointments(null);setRecords(null);setError('Quyền truy cập hồ sơ đã thay đổi.');}});
 const chosen=clinics?.find(c=>c.clinicId===clinic);
 return <>
  {mode!=='fees'&&<section className="public-section booking-panel" id="patient-history">
   <h2>Lịch sử tại phòng khám của tôi</h2>
   <button className="button-secondary" disabled={busy} onClick={()=>void load()}>{clinicId?'Tải lại lịch sử của tôi':'Tải phòng khám có hồ sơ của tôi'}</button>
   {busy&&<p role="status">Đang tải lịch sử…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
   {clinics?.length===0&&<p>Chưa có hồ sơ liên kết với phòng khám.</p>}
   {!!clinics?.length&&<div className="booking-form">
    {!clinicId&&<label>Phòng khám trong lịch sử<select value={clinic} disabled={busy} onChange={e=>void choose(e.target.value)}><option value="">Chọn phòng khám</option>{clinics.map(c=><option key={c.clinicId} value={c.clinicId}>{c.name}</option>)}</select></label>}
    {chosen&&chosen.branches.length>1&&<label>Chi nhánh trong lịch sử<select value={branch} disabled={busy} onChange={e=>void chooseBranch(e.target.value)}><option value="">Chọn chi nhánh</option>{chosen.branches.map(b=><option key={b.branchId} value={b.branchId}>{b.name}{!b.active?' · ngừng nhận lịch mới':''}</option>)}</select></label>}
   </div>}
   {appointments?.length===0&&<p>Chưa có lịch khám tại phòng khám này.</p>}
   {!!appointments?.length&&<ol className="appointment-timeline" aria-label="Các mốc lịch hẹn của tôi">{appointments.map(a=><li key={a.id} data-state={a.status}><article className="booking-appointment"><div><time dateTime={a.startsAt}>{when(a.startsAt)}</time><span className="task-status" data-state={a.status}>{labels[a.status]??a.status}</span></div><h3>{a.appointmentCode}</h3></article></li>)}</ol>}
   {chosen&&branch&&<section className="patient-records" aria-labelledby="patient-records-title">
    <div className="patient-records-heading"><div><span className="eyebrow">Hồ sơ chuyên môn</span><h2 id="patient-records-title">Hồ sơ khám đã hoàn tất</h2></div><small>Chỉ hiển thị hồ sơ đã được bác sĩ xác nhận và lượt khám đã hoàn tất.</small></div>
    {records?.length===0&&<div className="account-empty-state" role="status"><h3>Chưa có hồ sơ khám nào được phát hành cho bạn.</h3><p>Hồ sơ sẽ xuất hiện tại đây sau khi lượt khám được hoàn tất và bác sĩ xác nhận nội dung chuyên môn.</p></div>}
    {!!records?.length&&<div className="patient-record-list">{records.map(record=><article key={record.encounterId} className="booking-appointment patient-medical-record">
     <header><div><time dateTime={record.savedAt}>{when(record.savedAt)}</time><span className="task-status" data-state="FULFILLED">ĐÃ HOÀN TẤT</span></div><h3>{record.content.conclusion||'Hồ sơ khám đã xác nhận'}</h3></header>
     <dl>
      <div><dt>Lý do khám</dt><dd>{record.content.reasonForVisit||'Không ghi nhận'}</dd></div>
      <div><dt>Chẩn đoán</dt><dd>{record.content.preliminaryDiagnosis||'Không ghi nhận'}</dd></div>
      <div><dt>Hướng dẫn</dt><dd>{record.content.instructions||'Không ghi nhận'}</dd></div>
      {record.content.followUpDate&&<div><dt>Tái khám đề xuất</dt><dd>{dateOnly(record.content.followUpDate+'T00:00:00+07:00')}</dd></div>}
     </dl>
     <details><summary>Thông tin lâm sàng</summary><dl><div><dt>Tiền sử</dt><dd>{record.content.medicalHistory||'Không ghi nhận'}</dd></div><div><dt>Dị ứng</dt><dd>{record.content.allergies||'Không ghi nhận'}</dd></div><div><dt>Sinh hiệu</dt><dd>{record.content.vitals||'Không ghi nhận'}</dd></div><div><dt>Khám lâm sàng</dt><dd>{record.content.examination||'Không ghi nhận'}</dd></div></dl></details>
     {record.results.length>0&&<details><summary>Kết quả đã được bác sĩ xem ({record.results.length})</summary><ul>{record.results.map((result,index)=><li key={result.name+result.resultAt+index}><strong>{result.name}</strong><p>{result.content}</p><small>Kết quả {when(result.resultAt)}{result.reviewedAt?' · Bác sĩ đã xem '+when(result.reviewedAt):''}</small></li>)}</ul></details>}
    </article>)}</div>}
   </section>}
  </section>}
  {mode!=='history'&&chosen&&<PatientFeesPanel token={token} clinic={chosen.clinicId} branch={branch} branchName={chosen.branches.find(b=>b.branchId===branch)?.name??''}/>}
  {mode!=='fees'&&chosen&&branch&&<PatientFollowUpPanel token={token} clinic={chosen.clinicId} branch={branch} onChoose={onFollowUp}/>}
 </>;
}
