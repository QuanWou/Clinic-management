import { useEffect, useRef, useState } from 'react';
import { ownClinics, type PatientClinic, type FollowUpPlan } from '../api/portal';
import { myAppointments, type Appointment } from '../api/booking';
import { PatientFeesPanel } from './PatientFeesPanel';
import { PatientFollowUpPanel } from './PatientFollowUpPanel';
const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const labels: Record<string,string>={CONFIRMED:'Đã xác nhận',CANCELLED:'Đã hủy',CHECKED_IN:'Đã tiếp nhận',FULFILLED:'Đã hoàn tất lượt khám'};
export function PatientHistoryPanel({ token, patientId, onFollowUp,clinicId,mode='all' }: {token:string;patientId:string;clinicId?:string;mode?:'all'|'history'|'fees';onFollowUp:(plan:FollowUpPlan)=>Promise<void>}) {
 const [clinics,setClinics]=useState<PatientClinic[] | null>(null);const [clinic,setClinic]=useState('');const [branch,setBranch]=useState('');
 const [appointments,setAppointments]=useState<Appointment[] | null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setClinics(null);setClinic('');setBranch('');setAppointments(null);setError('');setBusy(false);return()=>{epoch.current++;};},[token,patientId]);
 async function load(){const current=++epoch.current;setBusy(true);setClinics(null);setClinic('');setBranch('');setAppointments(null);setError('');try{const source=await ownClinics(token);const list=clinicId?source.filter(c=>c.clinicId===clinicId):source;if(current===epoch.current){setClinics(list);if(clinicId&&list.length===1){setClinic(list[0].clinicId);if(list[0].branches.length===1)setBranch(list[0].branches[0].branchId);const visits=await myAppointments(token,list[0].clinicId,patientId);if(current===epoch.current)setAppointments(visits);}}}catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải lịch sử.');}finally{if(current===epoch.current)setBusy(false);}}
 async function choose(id:string){const current=++epoch.current;setClinic(id);setBranch('');setAppointments(null);setError('');if(!id){setBusy(false);return;}setBusy(true);try{const list=await myAppointments(token,id,patientId);if(current===epoch.current)setAppointments(list);}catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể tải lịch.');}finally{if(current===epoch.current)setBusy(false);}}
 useEffect(()=>{if(clinicId)void load();},[token,patientId,clinicId]);
 const chosen=clinics?.find(c=>c.clinicId===clinic);
 return <>{mode!=='fees'&&<section className="public-section booking-panel" id="patient-history"><h2>Lịch sử tại phòng khám của tôi</h2>
  <button className="button-secondary" disabled={busy} onClick={()=>void load()}>{clinicId?'Tải lại lịch sử của tôi':'Tải phòng khám có hồ sơ của tôi'}</button>
  {busy && <p role="status">Đang tải lịch sử…</p>}{error && <p role="alert" className="booking-error">{error}</p>}
  {clinics?.length===0 && <p>Chưa có hồ sơ liên kết với phòng khám.</p>}
  {!!clinics?.length && <div className="booking-form">{!clinicId&&<label>Phòng khám trong lịch sử<select value={clinic} disabled={busy} onChange={e=>void choose(e.target.value)}><option value="">Chọn phòng khám</option>{clinics.map(c=><option key={c.clinicId} value={c.clinicId}>{c.name}</option>)}</select></label>}
   {chosen&&chosen.branches.length>1 && <label>Chi nhánh trong lịch sử<select value={branch} disabled={busy} onChange={e=>setBranch(e.target.value)}><option value="">Chọn chi nhánh</option>{chosen.branches.map(b=><option key={b.branchId} value={b.branchId}>{b.name}{!b.active?' · ngừng nhận lịch mới':''}</option>)}</select></label>}</div>}
  {appointments?.length===0 && <p>Chưa có lịch khám tại phòng khám này.</p>}
  {!!appointments?.length&&<ol className="appointment-timeline" aria-label="Các mốc lịch hẹn của tôi">{appointments.map(a=><li key={a.id} data-state={a.status}><article className="booking-appointment"><div><time dateTime={a.startsAt}>{when(a.startsAt)}</time><span className="task-status" data-state={a.status}>{labels[a.status] ?? a.status}</span></div><h3>{a.appointmentCode}</h3></article></li>)}</ol>}
 </section>}{mode!=='history'&&chosen && <PatientFeesPanel token={token} clinic={chosen.clinicId} branch={branch} branchName={chosen.branches.find(b=>b.branchId===branch)?.name ?? ''}/>} {mode!=='fees'&&chosen&&branch&&<PatientFollowUpPanel token={token} clinic={chosen.clinicId} branch={branch} onChoose={onFollowUp}/>}</>;
}
