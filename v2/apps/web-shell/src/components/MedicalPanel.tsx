import { useEffect,useRef,useState } from 'react';
import * as api from '../api/medical';
import type { Scope } from '../api/reception';
import { RequestError } from '../api/booking';
import { stableOperationKey } from '../api/idempotency';
const blank:api.Note={reasonForVisit:'',medicalHistory:'',allergies:'',vitals:'',examination:'',preliminaryDiagnosis:'',conclusion:'',instructions:'',followUpDate:null};
const fields:[keyof Omit<api.Note,'followUpDate'>,string,number][]=[['reasonForVisit','Lý do khám',2000],['medicalHistory','Tiền sử',4000],['allergies','Dị ứng',2000],['vitals','Sinh hiệu',2000],['examination','Khám lâm sàng',4000],['preliminaryDiagnosis','Chẩn đoán sơ bộ',2000],['conclusion','Kết luận',4000],['instructions','Hướng dẫn',4000]];
export function MedicalPanel({scope,id,status='IN_PROGRESS',onValidated,onNavigationLock}:{scope:Scope;id:string;status?:string;onValidated?:(version:number|null)=>void;onNavigationLock?:(reason:string|null)=>void}){
 const [draft,setDraft]=useState<api.Draft|null>(null),[note,setNote]=useState(blank),[orders,setOrders]=useState<api.Order[]>([]),[offerings,setOfferings]=useState<api.Offering[]>([]),[offering,setOffering]=useState('');
 const [reason,setReason]=useState(''),[dirty,setDirty]=useState(false),[autosave,setAutosave]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[uncertain,setUncertain]=useState(false),[comparison,setComparison]=useState<api.Draft|null>(null);
 const running=useRef(false),revision=useRef(0),saveAttempt=useRef<{body:{expectedDocumentVersion:number;content:api.Note;reason:string};key:string;revision:number}|null>(null);
 const commandAttempt=useRef<(()=>Promise<void>)|null>(null);const scopeRef=useRef(scope);scopeRef.current=scope;
 const [caseStale,setCaseStale]=useState(false);
 const navigationReason=uncertain?'Thử lại hồ sơ đang chờ để xác minh kết quả trước khi đổi lượt.':busy?'Đợi thao tác hồ sơ xử lý xong trước khi đổi lượt.':dirty||comparison?'Lưu hoặc đối chiếu bản nháp trước khi đổi lượt, địa điểm hoặc rời màn hình.':null;
 useEffect(()=>{onNavigationLock?.(navigationReason);return()=>onNavigationLock?.(null);},[navigationReason,onNavigationLock]);
 const validatedCallback=useRef(onValidated);validatedCallback.current=onValidated;
 useEffect(()=>{validatedCallback.current?.(draft?.status==='VALIDATED'?draft.caseVersion:null);},[draft?.status,draft?.caseVersion]);
 useEffect(()=>{let active=true;Promise.all([api.draft(scope,id),api.orders(scope,id),api.offerings(scope)]).then(([d,o,f])=>{if(active){setDraft(d);setNote(d.content??blank);setOrders(o);setOfferings(f.filter(x=>x.active&&x.offering.active));}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Không tải được hồ sơ khám');});return()=>{active=false;};},[scope.token,scope.clinic,scope.branch,id]);
 async function run(action:()=>Promise<void>){if(running.current)return;running.current=true;setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Chưa xác định kết quả');}finally{running.current=false;setBusy(false);}}
 async function save(){
  if(!draft)return;
  if(!saveAttempt.current){const body={expectedDocumentVersion:draft.documentVersion,content:{...note},reason:reason.trim()||'Lưu bản nháp của bác sĩ'};saveAttempt.current={body,key:await stableOperationKey('medical-draft',{clinic:scope.clinic,branch:scope.branch,id,...body}),revision:revision.current};}
  const original=saveAttempt.current;
  try{const d=await api.save(scopeRef.current,id,original.body,original.key);saveAttempt.current=null;setUncertain(false);setComparison(null);setCaseStale(false);setDraft(d);if(revision.current===original.revision)setDirty(false);setMessage('Đã lưu bản nháp phiên bản '+d.documentVersion+'.');}
  catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){saveAttempt.current=null;setAutosave(false);setUncertain(false);}else setUncertain(true);throw e;}
 }
 useEffect(()=>{if(!autosave||!dirty||busy||uncertain||comparison||!draft||draft.status!=='DRAFT'||error)return;const timer=window.setTimeout(()=>void run(save),1000);return()=>window.clearTimeout(timer);},[autosave,dirty,note,busy,uncertain,comparison,draft,error]);
 async function reload(){const [d,o]=await Promise.all([api.draft(scope,id),api.orders(scope,id)]);setOrders(o);setCaseStale(false);if(dirty){setComparison(d);setAutosave(false);setMessage('Đã tải bản máy chủ để đối chiếu; nội dung đang sửa vẫn được giữ.');}else{setDraft(d);setNote(d.content??blank);}}
 async function syncCase(){try{const d=await api.draft(scope,id);if(d.documentVersion!==draft?.documentVersion){setComparison(d);setAutosave(false);}else setDraft(d);}catch{setCaseStale(true);setError('Thao tác đã được ghi nhận, nhưng chưa tải được phiên bản hồ sơ mới. Tải phiên bản để đối chiếu trước khi tiếp tục.');}}
 async function execute(action:()=>Promise<void>){commandAttempt.current=action;try{await action();commandAttempt.current=null;setUncertain(false);}catch(e){if(e instanceof RequestError&&e.status>=400&&e.status<500){commandAttempt.current=null;setUncertain(false);}else setUncertain(true);throw e;}}
 async function addOrder(){if(!draft)return;const body={expectedCaseVersion:draft.caseVersion,offeringId:offering,reason};const key=await stableOperationKey('medical-order',{clinic:scope.clinic,branch:scope.branch,id,...body});await execute(async()=>{const o=await api.order(scope,id,body,key);setOrders(current=>[...current.filter(x=>x.id!==o.id),o]);setMessage('Đã tạo chỉ định từ danh mục và giá hiện hành.');await syncCase();});}
 async function review(o:api.Order){const originalReason=reason;const key=await stableOperationKey('medical-review',{clinic:scope.clinic,branch:scope.branch,id:o.id,version:o.version,resultVersion:o.resultVersion,reason:originalReason});await execute(async()=>{const updated=await api.review(scope,o,originalReason,key);setOrders(current=>current.map(x=>x.id===updated.id?updated:x));setMessage('Đã ghi nhận bác sĩ duyệt kết quả.');await syncCase();});}
 async function validate(){if(!draft)return;const version=draft.caseVersion,originalReason=reason;const key=await stableOperationKey('medical-validate',{clinic:scope.clinic,branch:scope.branch,id,version,reason:originalReason});await execute(async()=>{const d=await api.validate(scope,id,version,originalReason,key);setDraft(d);setMessage('Đã xác nhận nội dung chuyên môn. Hồ sơ chưa ký và chưa phát hành.');});}
 const locked=busy||uncertain||caseStale||draft?.status==='VALIDATED'||!['IN_PROGRESS','AWAITING_RESULTS'].includes(status);
 return <section className="medical-panel" aria-labelledby="medical-title">
  <h2 id="medical-title">Hồ sơ khám và chỉ định</h2>{error&&<p role="alert" className="booking-error">{error}</p>}{message&&<p role="status">{message}</p>}{!draft&&!error&&<p role="status">Đang tải hồ sơ khám…</p>}
  <button type="button" disabled={busy} onClick={()=>void run(reload)}>Tải phiên bản để đối chiếu</button>
  {uncertain&&<p role="status">Chưa nhận xác nhận; nội dung yêu cầu được giữ nguyên. <button type="button" disabled={busy} onClick={()=>void run(()=>saveAttempt.current?save():commandAttempt.current?execute(commandAttempt.current):Promise.resolve())}>Thử lại hồ sơ đang chờ</button></p>}
  {draft&&<>
   <p>{draft.status==='VALIDATED'?'Đã xác nhận chuyên môn, chưa ký/phát hành':'Bản nháp'} · Phiên bản {draft.documentVersion}{dirty?' · Có thay đổi chưa lưu':''}</p>
   {comparison&&<div className="booking-confirm"><h3>Đối chiếu bản máy chủ</h3><p>Phiên bản {comparison.documentVersion} · Kết luận: {comparison.content?.conclusion??'Chưa có'}</p><button type="button" disabled={uncertain||busy} onClick={()=>{setDraft(comparison);setNote(comparison.content??blank);setDirty(false);setComparison(null);saveAttempt.current=null;setCaseStale(false);setError('');}}>Dùng bản từ máy chủ</button><button type="button" disabled={uncertain||busy} onClick={()=>{setDraft(comparison);setComparison(null);saveAttempt.current=null;setCaseStale(false);setError('');}}>Giữ nội dung đang sửa trên phiên bản mới</button></div>}
   <fieldset className="reception-actions" disabled={locked}>
    <div className="medical-note-fields">{fields.map(([field,label,max])=><label key={field}>{label}<textarea value={note[field]} maxLength={max} onChange={e=>{revision.current++;setNote(n=>({...n,[field]:e.target.value}));setDirty(true);}}/></label>)}</div>
    <label>Ngày hẹn tái khám đề xuất<input type="date" value={note.followUpDate??''} onChange={e=>{revision.current++;setNote(n=>({...n,followUpDate:e.target.value||null}));setDirty(true);}}/></label>
    <label>Lý do lưu hoặc duyệt hồ sơ<textarea maxLength={500} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <label className="medical-autosave"><input type="checkbox" checked={autosave} onChange={e=>setAutosave(e.target.checked)}/>Tự lưu bản nháp sau khi ngừng nhập</label>
    <button type="button" className="booking-primary" disabled={!dirty||!!comparison} onClick={()=>void run(save)}>Lưu bản nháp</button>
    <label>Dịch vụ chỉ định<select value={offering} onChange={e=>setOffering(e.target.value)}><option value="">Chọn dịch vụ từ danh mục</option>{offerings.map(o=><option key={o.offering.id} value={o.offering.id}>{o.offering.name}</option>)}</select></label>
    <button type="button" disabled={!offering||!reason.trim()||dirty||!!comparison} onClick={()=>void run(addOrder)}>Tạo chỉ định</button>
   </fieldset>
   <ul className="doctor-worklist" aria-label="Chỉ định của lượt khám">{orders.map(o=><li key={o.id}><strong>{o.name}</strong><span>{o.state}</span>{o.result&&<><p>{o.result.content}</p><small>Nguồn: {o.result.sourceRef} · Phiên bản {o.result.version}</small></>}{o.state==='RESULTED'&&<button type="button" disabled={locked||!reason.trim()||dirty} onClick={()=>void run(()=>review(o))}>Duyệt kết quả {o.name}</button>}</li>)}</ul>
   <button type="button" disabled={locked||dirty||!reason.trim()||!note.reasonForVisit.trim()||!note.conclusion.trim()||!note.instructions.trim()||orders.some(o=>!['REVIEWED','REJECTED','CANCELLED'].includes(o.state))} onClick={()=>void run(validate)}>Xác nhận nội dung chuyên môn</button>
  </>}
 </section>;
}
