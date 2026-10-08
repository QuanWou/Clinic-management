import {useEffect,useState} from 'react';
import {Pencil} from 'lucide-react';
import * as api from '../api/patientProfiles';
import {ConfigurationForm,type Field,type FormValues} from './ConfigurationForm';
import {useConfigurationSource,type ConfigurationProps} from './ConfigurationPanel';
import {useDraftGuard} from './DraftBoundary';
import {ManagementTable,ManagementToolbar,ManagementDetail} from './ManagementTable';
import {PatientClinicalRecords} from './PatientClinicalRecords';

const statusNames={PROVISIONAL:'Chưa xác minh',VERIFIED:'Đã xác minh'};
const fields:Field[]=[
 {key:'fullName',label:'Họ và tên',required:true,maxLength:180},
 {key:'dateOfBirth',label:'Ngày sinh',type:'date'},
 {key:'sex',label:'Giới tính',options:[{value:'',label:'Chưa cung cấp'},{value:'MALE',label:'Nam'},{value:'FEMALE',label:'Nữ'},{value:'OTHER',label:'Khác'}]},
 {key:'phone',label:'Số điện thoại',type:'tel',maxLength:30,pattern:'[0-9+() .-]*'},
 {key:'email',label:'Email liên hệ',type:'email',maxLength:180},
 {key:'reason',label:'Lý do tạo / cập nhật hồ sơ',type:'textarea',required:true,maxLength:500}
];
const fieldNames:Record<string,string>={fullName:'Họ và tên',dateOfBirth:'Ngày sinh',sex:'Giới tính',phone:'Số điện thoại',email:'Email liên hệ'};
const dateLabel=(value:string|null)=>value?new Date(value).toLocaleDateString('vi-VN'):'Chưa cung cấp';
const initial=(p?:api.PatientProfile):FormValues=>({fullName:p?.fullName??'',dateOfBirth:p?.dateOfBirth??'',sex:p?.sex??'',phone:p?.phone??'',email:p?.email??'',reason:''});
const input=(v:FormValues,version=0):api.ProfileInput=>({fullName:String(v.fullName).trim(),dateOfBirth:String(v.dateOfBirth)||null,sex:String(v.sex??''),phone:String(v.phone??'').trim(),email:String(v.email??'').trim(),expectedVersion:version,reason:String(v.reason).trim()});
const validate=(v:FormValues)=>!String(v.fullName).trim()?'Nhập họ và tên bệnh nhân.':!String(v.reason).trim()?'Nhập lý do thay đổi hồ sơ.':v.dateOfBirth&&String(v.dateOfBirth)>new Date().toLocaleDateString('sv-SE')?'Ngày sinh không được ở tương lai.':null;

export function PatientProfileConfiguration({session,clinic,disabled,revision,act}:ConfigurationProps){
 const drafts=useDraftGuard();
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[account,setAccount]=useState(''),[page,setPage]=useState(0);
 const [selected,setSelected]=useState<string|null>(null),[createKey,setCreateKey]=useState<string|null>(null);
 const [tab,setTab]=useState<'information'|'medical'>('information');
 const blocked=disabled||!!drafts?.active;
 useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(0);},300);return()=>clearTimeout(timer);},[query]);
 const source=useConfigurationSource(()=>api.list(session,search,status,account,page),[session.token,session.clinic,revision,search,status,account,page]);
 const detail=useConfigurationSource(()=>selected?api.get(session,selected):Promise.resolve(null),[session.token,session.clinic,revision,selected]);
 useEffect(()=>{setCreateKey(null);},[revision]);

 if(createKey)return <ManagementDetail title="Tạo hồ sơ bệnh nhân" disabled={blocked} onBack={()=>setCreateKey(null)}>
  <p className="muted-copy">Dùng cho khách đến trực tiếp. Có thể bổ sung ngày sinh và liên hệ sau khi tiếp nhận. Hồ sơ mới có trạng thái chưa xác minh.</p>
  <ConfigurationForm fields={fields} initial={initial()} disabled={disabled} label="Tạo hồ sơ bệnh nhân" validate={validate} onCancel={()=>setCreateKey(null)} submit={v=>act(async()=>{const saved=await api.create(session,input(v),createKey);setCreateKey(null);setSelected(saved.patientId);})}/>
 </ManagementDetail>;

 if(selected){const p=detail.data?.profile;return <ManagementDetail title={p?.fullName??'Chi tiết hồ sơ bệnh nhân'} disabled={blocked} onBack={()=>setSelected(null)}>
  {detail.error?<p role="alert" className="booking-error">{detail.error}</p>:!p?<p role="status">Đang tải hồ sơ bệnh nhân…</p>:<>
   <div className="patient-account-summary"><span><strong>Mã bệnh nhân:</strong> {p.patientCode}</span><span className="task-status" data-state={p.status}>{statusNames[p.status]}</span><span>{p.hasAccount?'Đã có tài khoản':'Chưa có tài khoản'}</span><span>Ngày tạo: {dateLabel(p.createdAt)}</span></div>
   <div className="patient-profile-tabs" role="group" aria-label="Nội dung hồ sơ bệnh nhân"><button type="button" aria-pressed={tab==='information'} disabled={blocked} onClick={()=>setTab('information')}>Thông tin bệnh nhân</button><button type="button" aria-pressed={tab==='medical'} disabled={blocked} onClick={()=>setTab('medical')}>Bệnh án & lịch sử khám</button></div>
   {tab==='medical'?<PatientClinicalRecords key={p.patientId} patientId={p.patientId} session={session} clinic={clinic} revision={revision} disabled={disabled}/>:<>
   <h3>Thông tin cá nhân và liên hệ</h3>
   <p className="muted-copy">Thông tin này dùng trong hồ sơ khám. Nếu bệnh nhân có tài khoản, email liên hệ ở đây được quản lý riêng với email đăng nhập.</p>
   <ConfigurationForm key={`${p.patientId}-${p.version}-${revision}`} fields={fields} initial={initial(p)} disabled={disabled} label="Lưu hồ sơ bệnh nhân" validate={validate} submit={v=>act(()=>api.update(session,p.patientId,input(v,p.version)))}/>
   <h3>Lịch sử thay đổi thông tin</h3>
   {detail.data!.changes.length?<ManagementTable caption="Lịch sử thay đổi hồ sơ" headers={['Thời gian','Thao tác','Thông tin thay đổi','Lý do']}>{detail.data!.changes.map(change=><tr key={change.id}><td>{new Date(change.createdAt).toLocaleString('vi-VN')}</td><td>{change.action==='CREATE'?'Tạo hồ sơ':'Cập nhật hồ sơ'}</td><td>{change.changedFields.split(',').map(field=>fieldNames[field]??field).join(', ')}</td><td>{change.reason}</td></tr>)}</ManagementTable>:<p className="muted-copy">Chưa có thay đổi được ghi nhận từ mục quản lý hồ sơ.</p>}
   </>}
  </>}
 </ManagementDetail>;}

 return <section className="management-section patient-account-section">
  <ManagementToolbar label="Tìm tên, mã bệnh nhân, số điện thoại hoặc email" query={query} onQuery={value=>{if(!blocked)setQuery(value);}} count={source.data?.totalElements??0} onAdd={()=>setCreateKey(crypto.randomUUID())} addLabel="Tạo hồ sơ bệnh nhân" disabled={blocked}>
   <label className="patient-account-filter">Xác minh<select aria-label="Lọc xác minh hồ sơ" value={status} disabled={blocked} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">Tất cả hồ sơ</option>{Object.entries(statusNames).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
   <label className="patient-account-filter">Tài khoản<select aria-label="Lọc liên kết tài khoản" value={account} disabled={blocked} onChange={e=>{setAccount(e.target.value);setPage(0);}}><option value="">Tất cả tài khoản</option><option value="LINKED">Đã có tài khoản</option><option value="NONE">Chưa có tài khoản</option></select></label>
  </ManagementToolbar>
  {source.error?<p role="alert" className="booking-error">{source.error}</p>:!source.data?<p role="status">Đang tải hồ sơ bệnh nhân…</p>:<>
   <ManagementTable caption="Hồ sơ bệnh nhân" headers={['Bệnh nhân','Ngày sinh','Liên hệ','Xác minh','Tài khoản','Thao tác']} empty={!source.data.content.length}>{source.data.content.map(p=><tr key={p.patientId}><td><strong>{p.fullName}</strong><small>{p.patientCode}</small></td><td>{dateLabel(p.dateOfBirth)}</td><td><span>{p.phone||'Chưa có số điện thoại'}</span><small>{p.email||'Chưa có email'}</small></td><td><span className="task-status" data-state={p.status}>{statusNames[p.status]}</span></td><td>{p.hasAccount?'Đã có tài khoản':'Chưa có tài khoản'}</td><td><button type="button" disabled={blocked} aria-label={`Quản lý hồ sơ ${p.fullName}`} onClick={()=>setSelected(p.patientId)}><Pencil size={15} aria-hidden="true"/>Quản lý</button></td></tr>)}</ManagementTable>
   <div className="patient-account-pagination" aria-label="Phân trang hồ sơ bệnh nhân"><span>{source.data.totalElements?`Trang ${source.data.number+1} / ${Math.max(1,source.data.totalPages)}`:'Chưa có hồ sơ phù hợp'}</span><div><button type="button" disabled={blocked||page===0} onClick={()=>setPage(value=>value-1)}>Trang trước</button><button type="button" disabled={blocked||page+1>=source.data!.totalPages} onClick={()=>setPage(value=>value+1)}>Trang sau</button></div></div>
  </>}
 </section>;
}
