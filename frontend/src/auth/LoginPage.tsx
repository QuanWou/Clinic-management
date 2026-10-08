import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,Building2,Eye,EyeOff,LockKeyhole,ShieldCheck,Stethoscope} from 'lucide-react';
import {clinicContexts,workspaceUrl} from './access';
import {useLocation,useSession} from './SessionProvider';
import {patientReturnTo,workspaceReturnTo} from './returnTo';

function PasswordField({value,onChange,disabled}:{value:string;onChange:(value:string)=>void;disabled:boolean}){
 const [show,setShow]=useState(false);
 return <label>Mật khẩu<div className="password-field"><input required type={show?'text':'password'} autoComplete="current-password" disabled={disabled} minLength={8} maxLength={100} value={value} onChange={e=>onChange(e.target.value)}/><button type="button" disabled={disabled} aria-label={show?'Ẩn mật khẩu':'Hiện mật khẩu'} onClick={()=>setShow(v=>!v)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>;
}

export function PatientAuthPanel(){
 const auth=useSession()!,location=useLocation();
 const register=window.location.pathname==='/public/register';
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[fullName,setFullName]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const params=new URLSearchParams(location.split('?')[1]??'');
 const returnTo=patientReturnTo(params.get('returnTo'));
 useEffect(()=>{
  if(auth.patientSession)auth.navigate(returnTo??'/tai-khoan/lich-kham',true);
 },[auth.patientSession?.token,returnTo]);

 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   await auth.authenticatePatient(email.trim(),password,register?fullName.trim():undefined);
   setPassword('');
   auth.navigate(returnTo??'/tai-khoan/lich-kham',true);
  }catch(e){setPassword('');setError(e instanceof Error?e.message:'Chưa đăng nhập được. Vui lòng thử lại.');}
  finally{setBusy(false);}
 }
 const target=returnTo?'?'+new URLSearchParams({returnTo}):'';
 return <section className="public-section public-auth-shell" aria-labelledby="patient-login-title">
   <div className="public-auth-intro">
    <span className="eyebrow">TÀI KHOẢN BỆNH NHÂN</span>
    <h1 id="patient-login-title">{register?'Tạo tài khoản':'Đăng nhập'}</h1>
    <p>{register?'Tạo tài khoản để đặt lịch và quản lý thông tin khám của bạn trong cùng hệ thống của phòng khám.':'Đăng nhập để quản lý lịch khám, hồ sơ khám và hóa đơn của bạn.'}</p>
    <ul><li>Quản lý lịch khám tại phòng khám</li><li>Xem hồ sơ đã hoàn tất</li><li>Theo dõi hóa đơn và lịch tái khám</li></ul>
   </div>
   <div className="public-auth-form-panel">
    <div className="public-auth-form-head"><span className="booking-section-kicker">{register?'Tạo tài khoản':'Đăng nhập'}</span><h2>{register?'Thông tin tài khoản mới':'Chào mừng bạn quay lại'}</h2><p>{register?'Nhập thông tin cơ bản để bắt đầu.':'Sử dụng tài khoản bệnh nhân của bạn để tiếp tục.'}</p></div>
    {error&&<p className="login-notice" role="alert">{error}</p>}
    {auth.notice&&!error&&<p className="login-notice" role="status">{auth.notice}</p>}
    <form className="login-form public-auth-form" onSubmit={submit}>
     <fieldset disabled={busy}>
      {register&&<label>Họ tên<input required autoComplete="name" maxLength={180} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>}
      <label>Email<input required type="email" autoComplete="username" maxLength={180} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <PasswordField value={password} onChange={setPassword} disabled={busy}/>
      <button className="booking-primary login-submit" disabled={busy}>{busy?'Đang xử lý…':register?'Tạo tài khoản':'Đăng nhập'}<ArrowRight size={17}/></button>
     </fieldset>
    </form>
    <p className="login-register">{register?'Đã có tài khoản? ':'Chưa có tài khoản? '}<a href={(register?'/public/login':'/public/register')+target} onClick={e=>{e.preventDefault();auth.navigate((register?'/public/login':'/public/register')+target);}}>{register?'Đăng nhập':'Tạo tài khoản'}</a></p>
   </div>
 </section>;
}

/** Compatibility export for focused auth tests; routing now renders PatientAuthPanel inside PublicShell. */
export function PatientLoginPage(_props:{brandName?:string}={}){ return <PatientAuthPanel/>; }

export function WorkspaceLoginPage({brandName='Phòng khám'}:{brandName?:string}){
 const auth=useSession()!,location=useLocation();
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const params=new URLSearchParams(location.split('?')[1]??'');
 const returnTo=workspaceReturnTo(params.get('returnTo'));

 useEffect(()=>{
  if(!auth.workspaceSession)return;
  auth.navigate(returnTo??workspaceUrl(auth.workspaceSession),true);
 },[auth.workspaceSession?.token,returnTo]);

 async function submit(event:FormEvent){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  try{
   const user=await auth.authenticateWorkspace(email.trim(),password);setPassword('');
   if(returnTo){
    const url=new URL(returnTo,window.location.origin),requested=url.searchParams.get('clinicId');
    if(requested&&!clinicContexts(user,requested).clinic){auth.signOutWorkspace();throw new Error('Tài khoản không có quyền truy cập không gian làm việc của phòng khám.');}
   }
   auth.navigate(returnTo??workspaceUrl(user),true);
  }catch(e){setPassword('');setError(e instanceof Error?e.message:'Chưa đăng nhập được. Vui lòng thử lại.');}
  finally{setBusy(false);}
 }
 return <div className="login-page login-workspace">
  <aside className="workspace-login-aside">
   <div className="workspace-login-aside-brand"><span className="brand-mark"><Stethoscope size={21}/></span><span><strong>{brandName}</strong><small>Không gian làm việc</small></span></div>
   <div className="workspace-login-aside-copy"><span className="workspace-login-kicker">VẬN HÀNH PHÒNG KHÁM</span><h2>Một nơi cho công việc được phân công.</h2><p>Truy cập đúng phòng khám, vai trò và phạm vi làm việc của tài khoản sau khi xác minh.</p></div>
   <div className="workspace-login-points">
    <div><span><Building2 size={17}/></span><p><strong>Đúng phòng khám</strong><small>Chỉ mở dữ liệu thuộc phạm vi được cấp.</small></p></div>
    <div><span><ShieldCheck size={17}/></span><p><strong>Đúng vai trò</strong><small>Menu và tác vụ được giới hạn theo phân công.</small></p></div>
   </div>
   <div className="workspace-login-aside-foot"><LockKeyhole size={15}/><span>Phiên làm việc được xác minh lại khi quyền thay đổi.</span></div>
  </aside>
  <main className="workspace-login-layout">
   <section className="login-card workspace-login-card" aria-labelledby="workspace-login-title">
    <div className="login-card-brand"><span className="brand-mark"><LockKeyhole size={21}/></span><div><strong>{brandName}</strong><small>Clinic Workspace</small></div></div>
    <div className="login-card-intro"><span className="eyebrow">KHÔNG GIAN LÀM VIỆC</span><h1 id="workspace-login-title">Đăng nhập</h1><p>Đăng nhập dành cho nhân viên phòng khám.</p></div>
    {error&&<p className="login-notice" role="alert">{error}</p>}
    {auth.notice&&!error&&<p className="login-notice" role="status">{auth.notice}</p>}
    <form className="login-form" onSubmit={submit}>
     <fieldset disabled={busy}>
      <label>Email<input required type="email" autoComplete="username" maxLength={180} value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <PasswordField value={password} onChange={setPassword} disabled={busy}/>
      <button className="booking-primary login-submit" disabled={busy}>{busy?'Đang xác minh…':'Đăng nhập'}<ArrowRight size={17}/></button>
     </fieldset>
    </form>
    <p className="login-card-footer">Quyền truy cập được xác minh theo phân công và phạm vi phòng khám sau khi đăng nhập.</p>
   </section>
  </main>
 </div>;
}
