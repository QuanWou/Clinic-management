import {useEffect,useState} from 'react';
import {Pencil} from 'lucide-react';
import * as api from '../api/patientAccounts';
import {ConfigurationForm,type Field,type FormValues} from './ConfigurationForm';
import {useConfigurationSource,type ConfigurationProps} from './ConfigurationPanel';
import {useDraftGuard,useFormDraft} from './DraftBoundary';
import {ConfirmDialog} from './ConfirmDialog';
import {ManagementTable,ManagementToolbar,ManagementDetail} from './ManagementTable';

const statusNames:Record<api.AccountStatus,string>={ACTIVE:'Đang hoạt động',INACTIVE:'Ngừng hoạt động',LOCKED:'Đã khóa'};
const fields:Field[]=[
 {key:'fullName',label:'Họ và tên',required:true,maxLength:255},
 {key:'email',label:'Email đăng nhập',type:'email',required:true,maxLength:255},
 {key:'phone',label:'Số điện thoại',type:'tel',maxLength:50}
];
const input=(v:FormValues):api.AccountInput=>({fullName:String(v.fullName).trim(),email:String(v.email).trim(),phone:String(v.phone??'').trim()});
const dateLabel=(value:string)=>{const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('vi-VN');};

export function PatientAccountConfiguration({session,disabled,revision,act}:ConfigurationProps){
 const drafts=useDraftGuard();
 const [query,setQuery]=useState(''),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[page,setPage]=useState(0);
 const [selected,setSelected]=useState<api.PatientAccount|null>(null),[creating,setCreating]=useState(false),[change,setChange]=useState<api.AccountStatus|null>(null);
 const blocked=disabled||!!drafts?.active;
 useEffect(()=>{const timer=setTimeout(()=>{setSearch(query.trim());setPage(0);},300);return()=>clearTimeout(timer);},[query]);
 const {data,error}=useConfigurationSource(()=>api.list(session,search,status,page),[session.token,session.clinic,revision,search,status,page]);
 const detail=useConfigurationSource(()=>selected?api.get(session,selected.id):Promise.resolve(null),[session.token,session.clinic,revision,selected?.id]);
 // Reloading after an uncertain creation reveals the source directory for reconciliation.
 useEffect(()=>{setCreating(false);},[revision]);
 useEffect(()=>{if(detail.data)setSelected(detail.data);},[detail.data]);

 if(creating)return <ManagementDetail title="Tạo tài khoản bệnh nhân" disabled={blocked} onBack={()=>setCreating(false)}>
  <p className="muted-copy">Tài khoản được cấp quyền bệnh nhân để đăng nhập và sử dụng cổng bệnh nhân.</p>
  <ConfigurationForm fields={[...fields,{key:'password',label:'Mật khẩu ban đầu',type:'password',required:true,maxLength:100}]} initial={{fullName:'',email:'',phone:'',password:''}} disabled={disabled} label="Tạo tài khoản bệnh nhân" onCancel={()=>setCreating(false)} validate={v=>String(v.password).length<8?'Mật khẩu cần ít nhất 8 ký tự.':!String(v.fullName).trim()?'Nhập họ và tên bệnh nhân.':null} submit={v=>act(async()=>{await api.create(session,{...input(v),password:String(v.password)});setCreating(false);})}/>
 </ManagementDetail>;

 if(selected)return <ManagementDetail title={selected.fullName} disabled={blocked} onBack={()=>setSelected(null)}>
  {detail.error&&<p role="alert" className="booking-error">{detail.error}</p>}
  <div className="patient-account-summary"><span><strong>Mã tài khoản:</strong> {selected.accountCode??'Chưa có mã'}</span><span className="task-status" data-state={selected.status}>{statusNames[selected.status]}</span><span>Ngày đăng ký: {dateLabel(selected.createdAt)}</span></div>
  <h3>Thông tin tài khoản</h3>
  <ConfigurationForm key={`${selected.id}-${revision}`} fields={fields} initial={{fullName:selected.fullName,email:selected.email,phone:selected.phone??''}} disabled={disabled} label="Lưu thông tin tài khoản" validate={v=>!String(v.fullName).trim()?'Nhập họ và tên bệnh nhân.':null} submit={v=>act(async()=>setSelected(await api.update(session,selected.id,input(v))))}/>
  <h3>Trạng thái tài khoản</h3>
  <p className="muted-copy">Khóa hoặc ngừng hoạt động sẽ dừng quyền đăng nhập và thu hồi phiên làm mới của tài khoản.</p>
  <div className="task-button-row">{(['ACTIVE','LOCKED','INACTIVE'] as api.AccountStatus[]).filter(next=>next!==selected.status).map(next=><button type="button" key={next} className={next==='ACTIVE'?'button-secondary':'management-danger'} disabled={blocked} onClick={()=>setChange(next)}>{next==='ACTIVE'?'Kích hoạt tài khoản':next==='LOCKED'?'Khóa tài khoản':'Ngừng hoạt động'}</button>)}</div>
  <h3>Đặt lại mật khẩu</h3>
  <PatientPasswordForm key={`${selected.id}-password-${revision}`} disabled={disabled} submit={password=>act(async()=>{await api.resetPassword(session,selected.id,password);})}/>
  {change&&<ConfirmDialog title={change==='ACTIVE'?'Kích hoạt tài khoản bệnh nhân?':change==='LOCKED'?'Khóa tài khoản bệnh nhân?':'Ngừng hoạt động tài khoản bệnh nhân?'} confirmLabel={change==='ACTIVE'?'Kích hoạt':change==='LOCKED'?'Khóa tài khoản':'Ngừng hoạt động'} busy={disabled} onCancel={()=>setChange(null)} onConfirm={()=>void act(async()=>{setSelected(await api.setStatus(session,selected.id,change));setChange(null);})}><p><strong>{selected.fullName}</strong><br/>{selected.email}</p><p>{change==='ACTIVE'?'Bệnh nhân có thể đăng nhập lại bằng tài khoản này.':'Bệnh nhân sẽ mất quyền đăng nhập. Thông tin tài khoản và lịch sử khám vẫn được lưu giữ.'}</p></ConfirmDialog>}
 </ManagementDetail>;

 return <section className="management-section patient-account-section">
  <ManagementToolbar label="Tìm tên, email, số điện thoại hoặc mã tài khoản" query={query} onQuery={value=>{if(!blocked)setQuery(value);}} count={data?.totalElements??0} onAdd={()=>setCreating(true)} addLabel="Tạo tài khoản bệnh nhân" disabled={blocked}>
   <label className="patient-account-filter">Trạng thái<select aria-label="Lọc trạng thái tài khoản" value={status} disabled={blocked} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="">Tất cả trạng thái</option>{Object.entries(statusNames).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  </ManagementToolbar>
  {error?<p role="alert" className="booking-error">{error}</p>:!data?<p role="status">Đang tải tài khoản bệnh nhân…</p>:<>
   <ManagementTable caption="Tài khoản bệnh nhân" headers={['Bệnh nhân','Liên hệ','Ngày đăng ký','Trạng thái','Thao tác']} empty={!data.content.length}>{data.content.map(row=><tr key={row.id}><td><strong>{row.fullName}</strong><small>{row.accountCode??'Chưa có mã tài khoản'}</small></td><td><span>{row.email}</span><small>{row.phone||'Chưa có số điện thoại'}</small></td><td>{dateLabel(row.createdAt)}</td><td><span className="task-status" data-state={row.status}>{statusNames[row.status]}</span></td><td><button type="button" disabled={blocked} aria-label={`Quản lý tài khoản ${row.fullName}`} onClick={()=>setSelected(row)}><Pencil size={15} aria-hidden="true"/>Quản lý</button></td></tr>)}</ManagementTable>
   <div className="patient-account-pagination" aria-label="Phân trang tài khoản bệnh nhân"><span>{data.totalElements?`Trang ${data.number+1} / ${Math.max(1,data.totalPages)}`:'Chưa có tài khoản phù hợp'}</span><div><button type="button" disabled={blocked||page===0} onClick={()=>setPage(value=>value-1)}>Trang trước</button><button type="button" disabled={blocked||page+1>=data.totalPages} onClick={()=>setPage(value=>value+1)}>Trang sau</button></div></div>
  </>}
 </section>;
}

function PatientPasswordForm({disabled,submit}:{disabled:boolean;submit:(password:string)=>Promise<void>}){
 const [password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[error,setError]=useState('');
 const otherDraft=useFormDraft(!!(password||confirmation),'Đặt lại mật khẩu bệnh nhân',()=>{setPassword('');setConfirmation('');setError('');});
 return <form onSubmit={e=>{e.preventDefault();if(password!==confirmation){setError('Mật khẩu xác nhận chưa khớp.');return;}setError('');void submit(password);}}>
  <fieldset className="configuration-fields" disabled={disabled||otherDraft}>
   <label>Mật khẩu tạm mới<input type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/></label>
   <label>Xác nhận mật khẩu<input type="password" autoComplete="new-password" required minLength={8} maxLength={100} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></label>
   <div className="configuration-form-actions"><button type="submit" className="button-secondary">Đặt lại mật khẩu</button></div>
  </fieldset>
  {error&&<p role="alert" className="booking-error">{error}</p>}
  <p className="muted-copy">Mật khẩu mới cần ít nhất 8 ký tự. Sau khi đặt lại, bệnh nhân dùng mật khẩu mới để đăng nhập.</p>
 </form>;
}
