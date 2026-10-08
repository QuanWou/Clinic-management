import {useAuthoritativeSync} from './useAuthoritativeSync';
import {ExternalLink,RefreshCw,Send} from 'lucide-react';
import {ClinicReviewHistory} from './ClinicReviewHistory';
import {stateName} from '../utils/display';
import {usePanelSession} from '../auth/SessionProvider';
import {DraftBoundary,DraftNotice,useDraftGuard} from './DraftBoundary';
import {useNavigationLock} from './useNavigationLock';
import {SourceSessionState} from '../auth/SourceSessionState';
import {useEffect,useRef,useState} from 'react';
import {RequestError,signIn} from '../api/booking';
import {contexts} from '../api/reception';
import * as api from '../api/configuration';
import {ConfigurationForm,type Field,type FormValues} from './ConfigurationForm';
import {MembershipConfiguration} from './MembershipConfiguration';
import {PatientAccountConfiguration} from './PatientAccountConfiguration';
import {PatientProfileConfiguration} from './PatientProfileConfiguration';
import {DoctorConfiguration} from './DoctorConfiguration';
import {CatalogConfiguration} from './CatalogConfiguration';

export type ConfigurationMode='profile'|'members'|'customers'|'patients'|'schedules'|'services'|'prices'|'catalog';
export type ConfigurationProps={session:api.Scope;clinic:api.Clinic;disabled:boolean;revision:number;act:(action:()=>Promise<unknown>)=>Promise<void>};

export function useConfigurationSource<T>(loader:()=>Promise<T>,dependencies:unknown[]){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState('');const drafts=useDraftGuard();
 useAuthoritativeSync({key:JSON.stringify(dependencies),enabled:true,blocked:!!drafts?.active,refresh:async context=>{try{const value=await loader();if(context.current()){setData(value);setError('');}}catch(e){if(context.current())setError(e instanceof Error?e.message:'Chưa cập nhật được cấu hình. Hệ thống sẽ thử lại.');throw e;}}});
 useEffect(()=>{let active=true;setData(null);setError('');void loader().then(value=>{if(active)setData(value);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Không thể tải dữ liệu cấu hình.');});return()=>{active=false;};},dependencies);
 return {data,error};
}

const profileFields:Field[]=[
 {key:'name',label:'Tên phòng khám',required:true,maxLength:180,section:'THÔNG TIN CƠ BẢN'},
 {key:'slug',label:'Đường dẫn hồ sơ phòng khám',required:true,pattern:'[a-z0-9]+(-[a-z0-9]+)*',maxLength:80,section:'THÔNG TIN CƠ BẢN'},
 {key:'publicDescription',label:'Giới thiệu công khai',type:'textarea',maxLength:1000,section:'THÔNG TIN CƠ BẢN'},
 {key:'contactName',label:'Người liên hệ',maxLength:150,section:'LIÊN HỆ'},
 {key:'contactEmail',label:'Email liên hệ',type:'email',maxLength:180,section:'LIÊN HỆ'},
 {key:'contactPhone',label:'Điện thoại liên hệ công khai',type:'tel',maxLength:30,section:'LIÊN HỆ'},
 {key:'licenseNumber',label:'Số giấy phép',maxLength:100,section:'GIẤY PHÉP'},
 {key:'issuingAuthority',label:'Cơ quan cấp phép',maxLength:180,section:'GIẤY PHÉP'},
 {key:'scopeSummary',label:'Phạm vi giấy phép',type:'textarea',maxLength:500,section:'GIẤY PHÉP'},
 {key:'evidenceRef',label:'Mã minh chứng lưu riêng',maxLength:200,pattern:'[a-zA-Z0-9][a-zA-Z0-9/_-]*',section:'GIẤY PHÉP'},
 {key:'validUntil',label:'Giấy phép có hiệu lực đến',type:'date',section:'GIẤY PHÉP'}
];
const branchFields:Field[]=[
 {key:'name',label:'Tên phòng khám',required:true,maxLength:180},
 {key:'address',label:'Địa chỉ',required:true,maxLength:300},
 {key:'openingHours',label:'Giờ mở cửa',required:true,maxLength:300},
 {key:'active',label:'Đang tiếp nhận bệnh nhân',type:'checkbox'}
];
const draft=(v:FormValues):api.Draft=>({name:String(v.name),slug:String(v.slug),publicDescription:String(v.publicDescription??''),contactName:String(v.contactName??''),contactEmail:String(v.contactEmail??''),contactPhone:String(v.contactPhone??''),license:{licenseNumber:String(v.licenseNumber??'')||null,issuingAuthority:String(v.issuingAuthority??'')||null,scopeSummary:String(v.scopeSummary??'')||null,evidenceRef:String(v.evidenceRef??'')||null,validUntil:String(v.validUntil??'')||null}});
const initial=(c:api.Clinic):FormValues=>({name:c.name,slug:c.slug,publicDescription:c.publicDescription??'',contactName:c.contactName??'',contactEmail:c.contactEmail??'',contactPhone:c.contactPhone??'',licenseNumber:c.license?.licenseNumber??'',issuingAuthority:c.license?.issuingAuthority??'',scopeSummary:c.license?.scopeSummary??'',evidenceRef:c.license?.evidenceRef??'',validUntil:c.license?.validUntil??''});
const pageMeta:Record<ConfigurationMode,{eyebrow:string;title:string;description:string}>={
 profile:{eyebrow:'PHÒNG KHÁM',title:'Hồ sơ phòng khám',description:'Quản lý thông tin hiển thị, liên hệ, giấy phép và địa điểm của phòng khám.'},
 members:{eyebrow:'NHÂN SỰ',title:'Nhân sự phòng khám',description:'Quản lý tài khoản, vai trò và quyền truy cập của đội ngũ phòng khám.'},
 customers:{eyebrow:'KHÁCH HÀNG',title:'Tài khoản bệnh nhân',description:'Quản lý thông tin đăng nhập, trạng thái và mật khẩu của tài khoản bệnh nhân.'},
 patients:{eyebrow:'BỆNH NHÂN',title:'Hồ sơ bệnh nhân',description:'Quản lý hồ sơ tại phòng khám, gồm bệnh nhân đến trực tiếp và bệnh nhân có tài khoản.'},
 schedules:{eyebrow:'BÁC SĨ',title:'Bác sĩ & lịch làm việc',description:'Quản lý hồ sơ chuyên môn, trạng thái hiển thị và lịch làm việc của bác sĩ.'},
 services:{eyebrow:'DANH MỤC',title:'Chuyên khoa & dịch vụ',description:'Quản lý dịch vụ khám, chuyên khoa liên kết, thời lượng và trạng thái cung cấp.'},
 prices:{eyebrow:'BẢNG GIÁ',title:'Bảng giá',description:'Theo dõi giá hiện hành và tạo phiên bản giá mới theo thời điểm hiệu lực.'},
 catalog:{eyebrow:'DANH MỤC',title:'Chuyên khoa & dịch vụ',description:'Quản lý dịch vụ khám, chuyên khoa liên kết, thời lượng và trạng thái cung cấp.'}
};
const timeLabel=(value:Date|null)=>value?value.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—';

type Props={mode:ConfigurationMode;onClinic?:(name:string)=>void;onNavigationLock?:(reason:string|null)=>void};
export function ConfigurationPanel(props:Props){return <DraftBoundary><ConfigurationContent {...props}/></DraftBoundary>;}

function ConfigurationContent({mode,onClinic,onNavigationLock}:Props){
 const drafts=useDraftGuard();
 const shared=usePanelSession(login);
 const [token,setToken]=useState(''),[clinic,setClinic]=useState<api.Clinic|null>(null),[branch,setBranch]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[uncertain,setUncertain]=useState(false),[reconciled,setReconciled]=useState(false),[revision,setRevision]=useState(0),[provisioned,setProvisioned]=useState(false),[mayCreate,setMayCreate]=useState(false),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const epoch=useRef(0),locked=useRef(false),userId=useRef('');
 const meta=pageMeta[mode];
 useNavigationLock(busy?'Đợi lưu cấu hình hoàn tất trước khi chuyển màn.':uncertain?'Đối chiếu kết quả lưu với dữ liệu đã ghi trước khi chuyển màn.':drafts?.active?'Lưu hoặc bỏ thay đổi cấu hình trước khi chuyển màn.':null,onNavigationLock);

 function pendingKey(){return 'clinic-v2.configuration.pending.'+userId.current;}
 function markPending(key:string,pending:boolean){try{if(pending)sessionStorage.setItem(key,'1');else sessionStorage.removeItem(key);}catch{/* UI retains uncertain state in memory. */}}
 const reset=()=>{epoch.current++;locked.current=false;setToken('');setClinic(null);setBranch('');setPassword('');setError('');setNotice('');setUncertain(false);setReconciled(false);setProvisioned(false);setMayCreate(false);setBusy(false);setLastUpdated(null);onClinic?.('Phòng khám theo phiên đăng nhập');};
 useEffect(()=>()=>{epoch.current++;},[]);

 async function login(){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');const current=++epoch.current;
  try{
   const access=shared?.session?.token??(await signIn(email,password)).data.accessToken;
   setEmail(shared?.session?.email??email);setPassword('');
   const [members,owned,actor]=await Promise.all([contexts(access),api.mine(access),api.current(access)]);
   const allowed=members.filter(m=>m.role==='ADMIN'&&m.allBranches);
   const ids=[...new Set(allowed.map(m=>m.clinicId))];
   if(ids.length>1)throw new Error('Workspace cần quyền quản lý một phòng khám. Hãy kiểm tra phân quyền tài khoản.');
   if(members.length&&!ids.length&&!owned.length)throw new Error('Cấu hình cần quyền Quản trị toàn phòng khám.');
   if(owned.length>1)throw new Error('Workspace cần một hồ sơ phòng khám được quản lý. Hãy kiểm tra phân quyền.');
   const selected=ids.length?owned.find(c=>c.id===ids[0]):owned[0];
   if(ids.length&&!selected)throw new Error('Chưa tải được hồ sơ phòng khám từ nguồn.');
   if(current!==epoch.current)return;
   userId.current=actor.userId;
   try{setUncertain(sessionStorage.getItem(pendingKey())==='1');}catch{}
   setToken(access);setProvisioned(!!selected&&ids.includes(selected.id));setClinic(selected??null);setMayCreate(!selected&&members.length===0);setBranch(selected?.branches[0]?.id??'');setLastUpdated(new Date());onClinic?.(selected?.name??'Phòng khám mới');
  }catch(e){if(current===epoch.current){setToken('');setClinic(null);setError(e instanceof Error?e.message:'Không thể đăng nhập cấu hình.');}}
  finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }

 async function act(action:()=>Promise<unknown>){
  if(locked.current||uncertain)return;
  const current=epoch.current,key=pendingKey();markPending(key,true);locked.current=true;setBusy(true);setError('');setNotice('');
  try{
   const result=await action();markPending(key,false);
   if(current===epoch.current){
    if(result&&typeof result==='object'&&'provisioned' in result)setProvisioned(true);
    if(result&&typeof result==='object'&&'ownerUserId' in result&&'branches' in result){
     const source=result as api.Clinic;setClinic(source);setMayCreate(false);setBranch(old=>source.branches.some(b=>b.id===old)?old:source.branches[0]?.id??'');onClinic?.(source.name);
    }
    setRevision(v=>v+1);setLastUpdated(new Date());setNotice('Đã lưu thay đổi.');
   }
  }catch(e){
   if(e instanceof RequestError&&e.status>0&&e.status<500)markPending(key,false);
   if(current===epoch.current){
    setError(e instanceof Error?e.message:'Không thể lưu cấu hình.');
    if(!(e instanceof RequestError)||e.status===0||e.status>=500){setUncertain(true);setReconciled(false);}
    if(e instanceof RequestError&&(e.status===401||e.status===403)){setClinic(null);setToken('');}
   }
  }finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }

 async function reload(){
  if(locked.current||!token)return;
  const current=epoch.current;locked.current=true;setBusy(true);setError('');
  try{
   const source=clinic&&provisioned?await api.clinic({token,clinic:clinic.id}):(await api.mine(token)).find(c=>!clinic||c.id===clinic.id);
   if(!source)throw new Error('Chưa tìm thấy hồ sơ tại nguồn. Tiếp tục đối chiếu; chưa tạo lại.');
   const grants=await contexts(token);
   if(current!==epoch.current)return;
   setClinic(source);setProvisioned(grants.some(m=>m.clinicId===source.id&&m.role==='ADMIN'&&m.allBranches));
   if(!source.branches.some(b=>b.id===branch))setBranch(source.branches[0]?.id??'');
   onClinic?.(source.name);setRevision(v=>v+1);setReconciled(true);setLastUpdated(new Date());
  }catch(e){
   if(current===epoch.current){setError(e instanceof Error?e.message:'Không thể đối chiếu nguồn.');setReconciled(false);setClinic(null);setMayCreate(false);if(e instanceof RequestError&&(e.status===401||e.status===403))setToken('');}
  }finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }

 useAuthoritativeSync({key:token+(clinic?.id??''),enabled:!!token&&!!clinic&&provisioned,blocked:busy||uncertain||!!drafts?.active,refresh:async context=>{const current=epoch.current;const source=await api.clinic({token,clinic:clinic!.id});if(context.current()&&current===epoch.current){setClinic(source);onClinic?.(source.name);setLastUpdated(new Date());}}});
 const props:ConfigurationProps|null=clinic?{clinic,session:{token,clinic:clinic.id,branch},disabled:busy||uncertain||!provisioned,revision,act}:null;
 const editable=clinic&&['DRAFT','NEEDS_CHANGES','APPROVED'].includes(clinic.reviewStatus)&&clinic.publicationStatus==='UNPUBLISHED';
 const publishState=clinic?.publicationStatus==='PUBLISHED'?'Đang công bố':stateName(clinic?.publicationStatus??'UNPUBLISHED');
 const reviewState=clinic?stateName(clinic.reviewStatus):'Chưa có hồ sơ';

 return <section className="booking-panel reception-panel doctor-panel configuration-panel">
  <header className="task-panel-header admin-page-header">
   <div><span className="eyebrow">{meta.eyebrow}</span><h1>{meta.title}</h1><p>{meta.description}</p></div>
   {token&&<div className="admin-page-utilities"><span>Cập nhật lúc {timeLabel(lastUpdated)}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật dữ liệu nguồn" title="Cập nhật dữ liệu nguồn" disabled={busy||!!drafts?.active&&!uncertain} onClick={()=>void reload()}><RefreshCw size={17}/></button></div>}
  </header>
  <DraftNotice disabled={busy||uncertain}/>
  {busy&&<p role="status" className="admin-inline-status">Đang cập nhật dữ liệu…</p>}
  {error&&<p role="alert" className="booking-error">{error}</p>}
  {notice&&<p role="status" className="task-success">{notice}</p>}

  {!token&&shared?<SourceSessionState error={error} retry={()=>void login()}/>:!token?
   <form className="booking-form" onSubmit={e=>{e.preventDefault();void login();}}><label>Email cấu hình<input type="email" required autoComplete="username" value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu cấu hình<input type="password" required autoComplete="current-password" value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label><button className="booking-primary" disabled={busy}>Đăng nhập cấu hình</button></form>
  :<>
   {!shared&&<button disabled={busy||uncertain||!!drafts?.active} onClick={reset}>Đăng xuất cấu hình</button>}
   {uncertain&&<div role="alert" className="booking-confirm"><p>Chưa xác định được kết quả lưu. Đối chiếu dữ liệu nguồn trước khi nhập tiếp; yêu cầu cũ chưa được gửi lại.</p>{reconciled&&<button onClick={()=>{markPending(pendingKey(),false);setUncertain(false);setNotice('Tiếp tục từ dữ liệu nguồn vừa đối chiếu.');}}>Đã đối chiếu dữ liệu nguồn</button>}</div>}

   {!clinic?mayCreate?
    <><p>Tạo bản nháp một phòng khám. Hồ sơ cần được duyệt riêng trước khi công bố.</p><ConfigurationForm fields={profileFields} initial={{name:'',slug:''}} disabled={busy||uncertain} label="Tạo hồ sơ phòng khám" submit={v=>act(()=>api.createClinic(token,draft(v)))}/></>
   :<p>Dữ liệu cấu hình chưa được xác minh. Cập nhật dữ liệu nguồn trước khi thao tác.</p>
   :<>
    {mode==='profile'&&<section className="clinic-profile-summary" aria-label="Tóm tắt hồ sơ phòng khám">
     <div><span className="eyebrow">HỒ SƠ HIỆN TẠI</span><h2>{clinic.name}</h2><p>/phong-kham/{clinic.slug}</p></div>
     <dl><div><dt>Hồ sơ</dt><dd><span className="task-status" data-state={clinic.reviewStatus}>{reviewState}</span></dd></div><div><dt>Public</dt><dd><span className="task-status" data-state={clinic.publicationStatus}>{publishState}</span></dd></div></dl>
     <a className="button-secondary" href="/public" target="_blank" rel="noreferrer">Xem trên Public <ExternalLink size={15}/></a>
    </section>}

    {!provisioned&&<div className="admin-data-warning"><div><strong>Chưa liên kết quyền chủ cơ sở</strong><p>Hồ sơ đã lưu nhưng quyền cấu hình chưa được mở.</p></div><button disabled={busy||uncertain} onClick={()=>void act(async()=>{await api.bootstrap(props!.session);const grants=await contexts(token);if(!grants.some(m=>m.clinicId===clinic.id&&m.role==='ADMIN'))throw new Error('Chưa xác nhận được quyền chủ cơ sở tại IAM. Hãy cập nhật lại nguồn.');return {provisioned:true};})}>Liên kết quyền chủ cơ sở</button></div>}

    {mode==='profile'?<>
     <section className="admin-form-section">
      <div className="admin-section-heading"><div><h2>Thông tin hồ sơ</h2><p>{editable?'Các thay đổi được lưu vào hồ sơ hiện tại và tuân theo quy trình kiểm duyệt.':'Hồ sơ đang công bố hoặc chờ duyệt nên chưa thể sửa trực tiếp.'}</p></div></div>
      <ConfigurationForm key={`profile-${clinic.version}-${revision}`} fields={profileFields} initial={initial(clinic)} disabled={busy||uncertain||!provisioned||!editable} label="Lưu thay đổi" submit={v=>act(()=>api.saveClinic(props!.session,{...draft(v),expectedVersion:clinic.version}))}/>
      <div className="admin-form-followup"><p>Minh chứng được lưu riêng và không nhận đường dẫn công khai. Thay đổi hồ sơ có thể yêu cầu kiểm duyệt lại.</p><button className="admin-strong-action" disabled={busy||uncertain||!!drafts?.active||!provisioned||!['DRAFT','NEEDS_CHANGES'].includes(clinic.reviewStatus)} onClick={()=>void act(()=>api.submitClinic(props!.session))}><Send size={16}/>Gửi hồ sơ kiểm duyệt</button></div>
     </section>
     <section className="admin-form-section">
      <div className="admin-section-heading"><div><h2>Địa chỉ và giờ làm việc</h2><p>Thông tin cơ sở được hiển thị công khai và dùng trong luồng đặt lịch.</p></div></div>
      <div className="clinic-branch-list">{clinic.branches.map(b=><article className="clinic-branch-editor" key={b.id}><div className="clinic-branch-heading"><h3>{b.name}</h3><span className="task-status" data-state={b.active?'ACTIVE':'INACTIVE'}>{b.active?'Đang tiếp nhận':'Tạm ngừng'}</span></div><ConfigurationForm key={`${b.id}-${revision}`} fields={branchFields} initial={{name:b.name,address:b.address,openingHours:b.openingHours,active:b.active}} disabled={busy||uncertain||!provisioned||!editable} label="Lưu thông tin cơ sở" submit={v=>act(()=>api.saveBranch(props!.session,{name:String(v.name),address:String(v.address),openingHours:String(v.openingHours),active:v.active===true,expectedVersion:clinic.version},b.id))}/></article>)}</div>
     </section>
     <section className="admin-form-section admin-history-section"><div className="admin-section-heading"><div><h2>Lịch sử thay đổi</h2><p>Quyết định kiểm duyệt và yêu cầu bổ sung gần đây.</p></div></div><ClinicReviewHistory token={token} clinicId={clinic.id} revision={revision}/></section>
    </>:mode==='members'?<MembershipConfiguration {...props!}/>:mode==='customers'?<PatientAccountConfiguration key={props!.session.clinic} {...props!}/>:mode==='patients'?<PatientProfileConfiguration key={props!.session.clinic} {...props!}/>:<>
     {!branch&&<div className="task-empty"><p>Chưa có thông tin địa chỉ phòng khám. Bổ sung trong Hồ sơ phòng khám trước khi cấu hình lịch và dịch vụ.</p></div>}
     {branch&&(mode==='schedules'?<DoctorConfiguration key={branch} {...props!}/>:<CatalogConfiguration key={branch} section={mode==='prices'?'prices':'services'} {...props!}/>)}
    </>}
   </>}
  </>}
 </section>;
}
