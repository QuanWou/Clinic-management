import {useDraftGuard} from './DraftBoundary';
import {useState} from 'react';
import {AlertTriangle,CalendarDays,Pencil} from 'lucide-react';
import {ManagementTable,ManagementToolbar,ManagementDetail,matchesQuery} from './ManagementTable';
import * as api from '../api/configuration';
import {ConfigurationForm,type Field,type FormValues} from './ConfigurationForm';
import {useConfigurationSource,type ConfigurationProps} from './ConfigurationPanel';
import {specialtyDisplay,specialtyName,specialtyOptions} from '../utils/specialty';

const date=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
const affiliationFields:Field[]=[
 {key:'specialtyCode',label:'Chuyên khoa',required:true,options:specialtyOptions},
 {key:'specialtyName',label:'Tên chuyên khoa',required:true,maxLength:160},
 {key:'professionalTitle',label:'Chức danh chuyên môn',maxLength:120},
 {key:'effectiveFrom',label:'Liên kết có hiệu lực từ',type:'date',required:true},
 {key:'effectiveUntil',label:'Liên kết có hiệu lực đến (không gồm ngày này)',type:'date'},
 {key:'publicVisible',label:'Hiển thị bác sĩ trên hồ sơ công khai',type:'checkbox'}
];
const scheduleFields:Field[]=[
 {key:'dayOfWeek',label:'Ngày trong tuần',options:['Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy','Chủ nhật'].map((label,i)=>({value:String(i+1),label})),required:true},
 {key:'startTime',label:'Giờ bắt đầu',type:'time',required:true},
 {key:'endTime',label:'Giờ kết thúc',type:'time',required:true},
 {key:'effectiveFrom',label:'Lịch có hiệu lực từ',type:'date',required:true},
 {key:'effectiveUntil',label:'Lịch có hiệu lực đến (không gồm ngày này)',type:'date'},
 {key:'active',label:'Lịch đang hoạt động',type:'checkbox'}
];
const affiliationBody=(v:FormValues)=>{const code=String(v.specialtyCode);return {specialtyCode:code,specialtyName:specialtyName(code,String(v.specialtyName)),professionalTitle:String(v.professionalTitle??'')||null,effectiveFrom:String(v.effectiveFrom),effectiveUntil:String(v.effectiveUntil??'')||null,publicVisible:v.publicVisible===true};};
const scheduleBody=(v:FormValues)=>({dayOfWeek:Number(v.dayOfWeek),startTime:String(v.startTime),endTime:String(v.endTime),effectiveFrom:String(v.effectiveFrom),effectiveUntil:String(v.effectiveUntil??'')||null,timezone:'Asia/Ho_Chi_Minh',active:v.active===true});
const days=['','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy','Chủ nhật'];
const validateDates=(v:FormValues)=>v.effectiveUntil&&String(v.effectiveUntil)<=String(v.effectiveFrom)?'Ngày kết thúc hiệu lực phải sau ngày bắt đầu.':null;
const scheduleReady=(schedules:api.Schedule[])=>schedules.some(s=>s.active&&s.effectiveFrom<=date()&&(!s.effectiveUntil||s.effectiveUntil>date()));

export function DoctorConfiguration(props:ConfigurationProps){
 const drafts=useDraftGuard();const {session,disabled,revision,act}=props;
 const [selected,setSelected]=useState(''),[tab,setTab]=useState<'schedule'|'profile'>('schedule'),[query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState('active'),[creating,setCreating]=useState(false),[userId,setUserId]=useState('');
 const {data,error}=useConfigurationSource(async()=>{
  const [list,members]=await Promise.all([api.affiliations(session),api.staff(session)]);
  const schedules=Object.fromEntries(await Promise.all(list.map(async affiliation=>{
   try{return [affiliation.id,(await api.schedules(session,affiliation.id)).schedules] as const;}
   catch{return [affiliation.id,[] as api.Schedule[]] as const;}
  })));
  return {list,members,schedules};
 },[session.token,session.clinic,session.branch,revision]);
 if(error)return <p role="alert">{error}</p>;if(!data)return <p role="status">Đang tải bác sĩ…</p>;

 const navigationDisabled=disabled||!!drafts?.active;
 const branchDoctors=data.members.filter(r=>r.account&&r.membership.status==='ACTIVE'&&r.membership.role==='DOCTOR'&&(r.membership.allBranches||r.membership.branchIds.includes(session.branch)));
 const linkedUsers=new Set(data.list.map(a=>a.userId));
 const unlinked=branchDoctors.filter(r=>!linkedUsers.has(r.membership.userId));
 const doctors=unlinked;
 const chosen=doctors.find(r=>r.membership.userId===userId)??doctors[0];
 const current=data.list.find(a=>a.id===selected);
 const rows=data.list.filter(a=>(statusFilter==='all'||a.active===(statusFilter==='active'))&&matchesQuery(query,a.displayName,a.specialtyName,a.professionalTitle));

 if(creating)return <ManagementDetail title="Thêm hồ sơ bác sĩ" disabled={navigationDisabled} onBack={()=>setCreating(false)}>{chosen?<><label>Nhân sự bác sĩ<select aria-label="Nhân sự bác sĩ" disabled={navigationDisabled} value={chosen.membership.userId} onChange={e=>setUserId(e.target.value)}>{doctors.map(r=><option key={r.membership.id} value={r.membership.userId}>{r.account!.fullName} · {r.account!.email}</option>)}</select></label><ConfigurationForm key={chosen.membership.userId} fields={[{key:'registrationCode',label:'Mã đăng ký hành nghề',maxLength:100},...affiliationFields]} initial={{registrationCode:'',specialtyCode:'',specialtyName:'',professionalTitle:'Bác sĩ',effectiveFrom:date(),publicVisible:false}} disabled={disabled} label="Liên kết hồ sơ bác sĩ" onCancel={()=>setCreating(false)} validate={validateDates} submit={v=>act(async()=>{const added=await api.saveAffiliation(session,{...affiliationBody(v),userId:chosen.membership.userId,displayName:chosen.account!.fullName,registrationCode:String(v.registrationCode??'')||null});setCreating(false);setSelected(added.id);setTab('schedule');})}/></>:<div className="task-empty"><p>Không có tài khoản Bác sĩ nào đang chờ liên kết hồ sơ chuyên môn tại chi nhánh này.</p></div>}</ManagementDetail>;

 if(current){
  const staffRow=data.members.find(row=>row.membership.userId===current.userId);
  const schedules=data.schedules[current.id]??[];
  return <ManagementDetail title={current.displayName} disabled={navigationDisabled} onBack={()=>setSelected('')}>
   <p className="muted-copy">{current.professionalTitle||'Bác sĩ'} · {specialtyDisplay(current.specialtyCode,current.specialtyName)}</p>
   <div className="doctor-readiness" aria-label="Trạng thái cấu hình bác sĩ">
    <div><span>Tài khoản</span><strong>{staffRow?.membership.status==='ACTIVE'&&staffRow.account?.status==='ACTIVE'?'Active':'Chưa sẵn sàng'}</strong></div>
    <div><span>Thông tin chuyên môn</span><strong>{current.specialtyCode&&current.specialtyName?'Đầy đủ':'Thiếu'}</strong></div>
    <div><span>Hiển thị Public</span><strong>{current.publicVisible?'Có':'Không'}</strong></div>
    <div><span>Lịch làm việc</span><strong>{scheduleReady(schedules)?'Đã cấu hình':'Chưa sẵn sàng'}</strong></div>
   </div>
   <p className="muted-copy">Booking không có cờ bật/tắt độc lập trong contract hiện tại; khả dụng đặt lịch được hệ thống suy ra từ trạng thái bác sĩ, dịch vụ và lịch làm việc.</p>
   <div className="management-tabs" role="group" aria-label="Quản lý bác sĩ"><button type="button" aria-pressed={tab==='schedule'} disabled={navigationDisabled} onClick={()=>setTab('schedule')}>Lịch làm việc</button><button type="button" aria-pressed={tab==='profile'} disabled={navigationDisabled} onClick={()=>setTab('profile')}>Thông tin bác sĩ</button></div>
   {tab==='profile'?<ConfigurationForm key={`affiliation-${current.id}-${current.version}`} fields={[...affiliationFields,{key:'active',label:'Liên kết bác sĩ đang hoạt động',type:'checkbox'}]} initial={{specialtyCode:current.specialtyCode,specialtyName:current.specialtyName,professionalTitle:current.professionalTitle??'',effectiveFrom:current.effectiveFrom,effectiveUntil:current.effectiveUntil??'',publicVisible:current.publicVisible,active:current.active}} disabled={disabled} label="Lưu thông tin bác sĩ" validate={validateDates} submit={v=>act(()=>api.saveAffiliation(session,{...affiliationBody(v),active:v.active===true,expectedVersion:current.version},current.id))}/>:<ScheduleConfiguration key={current.id} affiliation={current} {...props}/>}
  </ManagementDetail>;
 }

 return <section className="management-section">
  <p className="management-intro">Tài khoản nhân sự, hồ sơ chuyên môn, hiển thị Public và lịch làm việc được theo dõi riêng để tránh một trạng thái “Đang hoạt động” mơ hồ.</p>
  {!!unlinked.length&&<div className="admin-data-warning" role="status"><AlertTriangle size={18}/><div><strong>{unlinked.length} tài khoản vai trò Bác sĩ chưa có hồ sơ chuyên môn</strong><p>{unlinked.slice(0,4).map(row=>row.account?.email??row.membership.userId).join(' · ')}{unlinked.length>4?' · …':''}</p></div></div>}
  <ManagementToolbar label="Tìm bác sĩ hoặc chuyên khoa" query={query} onQuery={setQuery} count={rows.length} onAdd={()=>setCreating(true)} addLabel="Liên kết bác sĩ" disabled={navigationDisabled}><select className="management-filter" aria-label="Trạng thái bác sĩ" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="active">Liên kết hoạt động</option><option value="inactive">Liên kết ngừng hoạt động</option><option value="all">Tất cả trạng thái</option></select></ManagementToolbar>
  <ManagementTable caption="Danh sách bác sĩ" headers={['Bác sĩ','Chuyên khoa','Tài khoản','Public','Lịch làm việc','Thao tác']} empty={!rows.length}>{rows.map(a=>{
   const staffRow=data.members.find(row=>row.membership.userId===a.userId),ready=scheduleReady(data.schedules[a.id]??[]);
   return <tr key={a.id}><td><strong>{a.displayName}</strong><small>{a.professionalTitle||'Bác sĩ'}{a.registrationCode?' · '+a.registrationCode:''}</small></td><td><strong>{specialtyDisplay(a.specialtyCode,a.specialtyName)}</strong><small>Mã: {a.specialtyCode}</small></td><td><span className="task-status" data-state={staffRow?.membership.status==='ACTIVE'&&staffRow.account?.status==='ACTIVE'?'ACTIVE':'INACTIVE'}>{staffRow?.membership.status==='ACTIVE'&&staffRow.account?.status==='ACTIVE'?'Active':'Chưa sẵn sàng'}</span></td><td><span className="task-status" data-state={a.publicVisible?'ACTIVE':'INACTIVE'}>{a.publicVisible?'Có':'Không'}</span></td><td><span className="task-status" data-state={ready?'ACTIVE':'WAITING'}>{ready?'Đã cấu hình':'Thiếu lịch hiệu lực'}</span></td><td><div className="management-actions"><button type="button" aria-label={'Quản lý '+a.displayName} disabled={navigationDisabled} onClick={()=>{setSelected(a.id);setTab('profile');}}><Pencil size={15} aria-hidden="true"/>Quản lý</button><button type="button" aria-label={'Lịch làm việc của '+a.displayName} disabled={navigationDisabled} onClick={()=>{setSelected(a.id);setTab('schedule');}}><CalendarDays size={15} aria-hidden="true"/>Lịch làm việc</button></div></td></tr>;
  })}</ManagementTable>
 </section>;
}

function ScheduleConfiguration({affiliation,session,disabled,revision,act}:ConfigurationProps&{affiliation:api.Affiliation}){
 const drafts=useDraftGuard(),[editing,setEditing]=useState<string|null>(null);
 const {data,error}=useConfigurationSource(()=>api.schedules(session,affiliation.id),[session.token,session.clinic,session.branch,affiliation.id,revision]);
 if(error)return <p role="alert">{error}</p>;if(!data)return <p role="status">Đang tải lịch bác sĩ…</p>;
 const current=data.schedules.find(s=>s.id===editing),today=date();
 const status=(s:api.Schedule)=>!s.active?'Ngừng hoạt động':s.effectiveFrom>today?'Chưa đến hiệu lực':s.effectiveUntil&&s.effectiveUntil<=today?'Đã hết hiệu lực':'Đang áp dụng';
 return <section className="management-schedules"><div className="management-subheading"><div><h3>Lịch làm việc</h3><p className="muted-copy">Giờ Việt Nam. Availability/slot tiếp tục do luồng schedule → availability hiện tại của backend quyết định; frontend không tự tạo slot.</p></div><button type="button" className="booking-primary" disabled={disabled||!!drafts?.active} onClick={()=>setEditing('new')}>Thêm khung lịch</button></div>{editing!==null&&<section className="management-editor"><h3>{current?'Sửa khung lịch':'Thêm khung lịch'}</h3><ConfigurationForm key={current?`${current.id}-${current.version}`:'new-schedule'} fields={scheduleFields} initial={current?{dayOfWeek:String(current.dayOfWeek),startTime:current.startTime.slice(0,5),endTime:current.endTime.slice(0,5),effectiveFrom:current.effectiveFrom,effectiveUntil:current.effectiveUntil??'',active:current.active}:{dayOfWeek:'1',startTime:'08:00',endTime:'17:00',effectiveFrom:today,active:true}} disabled={disabled} label="Lưu khung lịch" onCancel={()=>setEditing(null)} validate={v=>String(v.endTime)<=String(v.startTime)?'Giờ kết thúc phải sau giờ bắt đầu.':validateDates(v)} submit={v=>act(async()=>{await api.saveSchedule(session,affiliation.id,{...scheduleBody(v),...(current?{expectedVersion:current.version}:{})},current?.id);setEditing(null);})}/></section>}<ManagementTable caption={'Lịch làm việc của '+affiliation.displayName} headers={['Ngày','Khung giờ','Thời gian áp dụng','Trạng thái','Thao tác']} empty={!data.schedules.length}>{[...data.schedules].sort((a,b)=>a.dayOfWeek-b.dayOfWeek||a.startTime.localeCompare(b.startTime)).map(s=><tr key={s.id}><td><strong>{days[s.dayOfWeek]}</strong></td><td className="management-nowrap">{s.startTime.slice(0,5)} – {s.endTime.slice(0,5)}</td><td>{s.effectiveFrom.split('-').reverse().join('/')}<small>{s.effectiveUntil?'Đến trước '+s.effectiveUntil.split('-').reverse().join('/'):'Không giới hạn ngày kết thúc'}</small></td><td><span className="task-status" data-state={status(s)==='Đang áp dụng'?'ACTIVE':undefined}>{status(s)}</span></td><td><button type="button" disabled={disabled||!!drafts?.active} aria-label={'Sửa lịch '+days[s.dayOfWeek]+' '+s.startTime.slice(0,5)} onClick={()=>setEditing(s.id)}>Sửa</button></td></tr>)}</ManagementTable></section>;
}
