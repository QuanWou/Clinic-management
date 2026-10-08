import {useState} from 'react';
import * as api from '../api/patientClinicalRecords';
import {affiliations} from '../api/configuration';
import {useConfigurationSource,type ConfigurationProps} from './ConfigurationPanel';
import {ManagementTable} from './ManagementTable';

const visitStates:Record<string,string>={ARRIVAL_PENDING:'Chờ tiếp nhận',WAITING:'Chờ khám',CALLED:'Đã gọi khám',IN_PROGRESS:'Đang khám',AWAITING_RESULTS:'Chờ kết quả',COMPLETION_PENDING:'Đang hoàn tất',CLINICALLY_COMPLETED:'Đã hoàn tất khám',CLOSED:'Đã đóng lượt khám',CANCELLED:'Đã hủy',INTERRUPTED:'Gián đoạn'};
const orderStates:Record<string,string>={ORDERED:'Đã chỉ định',ACCEPTED:'Đã tiếp nhận',PROCESSING:'Đang thực hiện',RESULTED:'Có kết quả, chờ bác sĩ xem',REVIEWED:'Bác sĩ đã xem',REJECTED:'Đã từ chối',CANCELLED:'Đã hủy'};
const when=(date:string|null)=>date?new Date(date).toLocaleString('vi-VN'):'Chưa ghi nhận';
const noteFields=[['reasonForVisit','Lý do khám'],['medicalHistory','Tiền sử bệnh'],['allergies','Dị ứng'],['vitals','Sinh hiệu'],['examination','Khám lâm sàng'],['preliminaryDiagnosis','Chẩn đoán'],['conclusion','Kết luận'],['instructions','Hướng dẫn và điều trị']] as const;

export function PatientClinicalRecords({patientId,session,clinic,revision,disabled}:{patientId:string}&Pick<ConfigurationProps,'session'|'clinic'|'revision'|'disabled'>){
 const [branch,setBranch]=useState(session.branch||clinic.branches[0]?.id||''),[page,setPage]=useState(0),[selected,setSelected]=useState<api.PatientVisit|null>(null),[reload,setReload]=useState(0);
 const scope={...session,branch};
 const history=useConfigurationSource(()=>branch?api.visits(scope,patientId,page):Promise.resolve(null),[session.token,session.clinic,branch,patientId,page,revision,reload]);
 const doctors=useConfigurationSource(()=>branch?affiliations(scope):Promise.resolve([]),[session.token,session.clinic,branch,revision]);
 const detail=useConfigurationSource(()=>selected?api.record(scope,patientId,selected.encounterId).then(record=>({record})):Promise.resolve(null),[session.token,session.clinic,branch,patientId,selected?.encounterId,revision,reload]);
 const doctorName=(id:string)=>doctors.data?.find(d=>d.practitionerId===id)?.displayName??'Chưa có thông tin bác sĩ';
 const record=detail.data?.record;
 return <section className="patient-clinical-records" aria-label="Bệnh án và lịch sử khám">
  <div className="admin-section-heading"><div><h3>Bệnh án và lịch sử khám</h3><p>Xem nội dung chuyên môn, chỉ định và kết quả theo từng lượt khám tại phòng khám.</p></div><button type="button" className="button-secondary" disabled={disabled} onClick={()=>setReload(v=>v+1)}>Tải lại bệnh án</button></div>
  {clinic.branches.length>1&&<label className="patient-account-filter">Cơ sở khám<select aria-label="Cơ sở trong lịch sử khám" value={branch} disabled={disabled} onChange={e=>{setBranch(e.target.value);setPage(0);setSelected(null);}}>{clinic.branches.map(b=><option key={b.id} value={b.id}>{b.name}{!b.active?' · Ngừng tiếp nhận':''}</option>)}</select></label>}
  {!branch?<p>Chưa có cơ sở khám để tra cứu bệnh án.</p>:selected?<>
   <button type="button" className="button-secondary" disabled={disabled} onClick={()=>setSelected(null)}>Về lịch sử khám</button>
   <div className="patient-clinical-visit"><h4>{selected.visitCode?`Lượt khám ${selected.visitCode}`:'Chi tiết lượt khám'}</h4><p>{when(selected.checkedInAt??selected.createdAt)} · {selected.walkIn?'Khách trực tiếp':'Theo lịch hẹn'} · {doctorName(selected.doctorId)}</p><span className="task-status" data-state={selected.status}>{visitStates[selected.status]??selected.status}</span></div>
   {detail.error?<p role="alert" className="booking-error">{detail.error}</p>:!detail.data?<p role="status">Đang tải bệnh án…</p>:!record?<div className="task-empty"><p>Lượt khám này chưa có bệnh án được lưu.</p></div>:<article className="patient-clinical-document">
    <header><h4>{record.status==='VALIDATED'?'Bệnh án đã xác nhận':'Bản nháp bệnh án'}</h4><span className="task-status" data-state={record.status}>{record.status==='VALIDATED'?'Bác sĩ đã xác nhận':'Chưa xác nhận'}</span>{record.savedAt&&<p>Lưu lúc {when(record.savedAt)} · Phiên bản {record.documentVersion}</p>}</header>
    {record.content?<dl>{noteFields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{record.content![key]||'Không ghi nhận'}</dd></div>)}{record.content.followUpDate&&<div><dt>Ngày tái khám đề xuất</dt><dd>{new Date(record.content.followUpDate+'T00:00:00').toLocaleDateString('vi-VN')}</dd></div>}</dl>:<p>Chưa có nội dung bệnh án được lưu.</p>}
    <h4>Chỉ định và kết quả xét nghiệm</h4>
    {record.orders.length?<div className="patient-clinical-orders">{record.orders.map(order=><article key={order.id}><header><h5>{order.name}</h5><span className="task-status" data-state={order.state}>{orderStates[order.state]??order.state}</span></header><p>Chỉ định lúc {when(order.orderedAt)}</p>{order.result!==null?<><p className="patient-clinical-result">{order.result}</p><small>Kết quả lúc {when(order.resultAt)}{order.reviewedAt?` · Bác sĩ đã xem lúc ${when(order.reviewedAt)}`:''}</small></>:<p>Chưa có kết quả được lưu.</p>}</article>)}</div>:<p>Không có chỉ định xét nghiệm trong lượt khám này.</p>}
   </article>}
  </>:history.error?<p role="alert" className="booking-error">{history.error}</p>:!history.data?<p role="status">Đang tải lịch sử khám…</p>:<>
   <ManagementTable caption="Lịch sử khám bệnh nhân" headers={['Lượt khám','Bác sĩ','Trạng thái','Bệnh án']} empty={!history.data.content.length}>{history.data.content.map(visit=><tr key={visit.encounterId}><td><strong>{visit.visitCode||'Lượt khám'}</strong><small>{when(visit.checkedInAt??visit.createdAt)}</small><small>{visit.serviceName||(visit.walkIn?'Khách trực tiếp':'Theo lịch hẹn')}</small></td><td>{doctorName(visit.doctorId)}</td><td><span className="task-status" data-state={visit.status}>{visitStates[visit.status]??visit.status}</span></td><td><button type="button" disabled={disabled} aria-label={`Xem bệnh án ${visit.visitCode??when(visit.createdAt)}`} onClick={()=>setSelected(visit)}>Xem bệnh án</button></td></tr>)}</ManagementTable>
   {!history.data.content.length&&<p className="muted-copy">Bệnh nhân chưa có lượt khám tại cơ sở này.</p>}
   <div className="patient-account-pagination"><span>{history.data.totalElements?`${history.data.totalElements} lượt khám · Trang ${page+1} / ${history.data.totalPages}`:'Chưa có lịch sử khám'}</span><div><button type="button" disabled={disabled||page===0} onClick={()=>setPage(v=>v-1)}>Trang khám trước</button><button type="button" disabled={disabled||page+1>=history.data!.totalPages} onClick={()=>setPage(v=>v+1)}>Trang khám sau</button></div></div>
  </>}
 </section>;
}
