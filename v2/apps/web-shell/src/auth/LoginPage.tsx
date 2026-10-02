import {useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,Eye,EyeOff,ShieldCheck,Stethoscope,UserRound} from 'lucide-react';
import {useSession} from './SessionProvider';
import {clinicContexts,workspaceUrl} from './access';
type Area='public'|'workspace'|'platform';
const areas=[{id:'public' as const,label:'Bệnh nhân',icon:UserRound},{id:'workspace' as const,label:'Phòng khám',icon:Building2},{id:'platform' as const,label:'Platform',icon:ShieldCheck}];
export function LoginPage({area='workspace',brandName}:{area?:Area;brandName?:string}){
 const auth=useSession()!,[email,setEmail]=useState(''),[password,setPassword]=useState(''),[fullName,setFullName]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const register=area==='public'&&new URLSearchParams(location.search).get('register')==='1';
 const titles={public:'Chăm sóc sức khỏe, theo lịch của bạn.',workspace:'Công việc phòng khám, trong một không gian.',platform:'Kiểm duyệt rõ ràng, đúng phạm vi.'};
 async function submit(){
  if(busy)return;setBusy(true);setError('');
  try{
   const user=await auth.authenticate(email.trim(),password,register?fullName.trim():undefined);setPassword('');
   const requested=new URLSearchParams(location.search).get('clinicId');
   if(area==='platform'){if(!user.actor.platformOperator){auth.signOut();throw new Error('Tài khoản chưa được cấp quyền quản trị nền tảng.');}auth.navigate('/platform',true);}
   else if(area==='workspace'){
    const scope=clinicContexts(user,requested);
    if(requested&&!scope.clinic){auth.signOut();throw new Error('Bạn chưa được cấp quyền tại phòng khám trong đường dẫn này.');}
    if(!user.contexts.length){auth.navigate('/workspace?view=settings',true);}
    else if(!scope.clinic){auth.navigate('/workspace',true);}
    else{const params=new URLSearchParams(location.search);const view=params.get('view');auth.navigate(view?'/workspace?'+new URLSearchParams({view,clinicId:scope.clinic}):workspaceUrl(user,scope.clinic),true);}
   }else{const next=new URLSearchParams(location.search).get('next');auth.navigate(next==='booking'?'/public/booking':'/public/account',true);}
  }catch(e){setPassword('');setError(e instanceof Error?e.message:'Chưa đăng nhập được. Vui lòng thử lại.');}finally{setBusy(false);}
 }
 return <div className={`login-page login-${area}`}>
  <header className="login-header"><a className="brand" href="/public" onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/public');}}><span className="brand-mark"><Stethoscope size={23}/></span><span><strong>{area==='public'?(brandName??'Phòng khám'):'Clinic V2'}</strong><small>{area==='workspace'?'Clinic Workspace':area==='platform'?'Platform Console':'Chăm sóc ngoại trú'}</small></span></a><a href="/public" onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/public');}}><ArrowLeft size={16}/> Về trang Public</a></header>
  <main id="main-content" tabIndex={-1} className="login-layout">
   <section className="login-story"><span className="eyebrow">{area==='workspace'?'Dành cho nhân sự phòng khám':area==='platform'?'Dành cho vận hành nền tảng':'Dành cho bạn và lịch khám của bạn'}</span><h1>{titles[area]}</h1><p>{area==='workspace'?'Tiếp nhận, khám và thu phí liền mạch. Đăng nhập một lần để tiếp tục công việc được phân công.':area==='platform'?'Theo dõi hồ sơ cơ sở, kiểm duyệt và quản lý công bố trong Console riêng.':'Đặt lịch với bác sĩ và quản lý lịch khám tại phòng khám.'}</p><div className="login-feature"><span><Stethoscope size={20}/></span><div><strong>{area==='workspace'?'Đúng vai trò, đúng công việc':area==='platform'?'Phạm vi nền tảng riêng':'Lịch khám dễ theo dõi'}</strong><p>{area==='workspace'?'Màn hình và điều hướng phù hợp với quyền của bạn.':area==='platform'?'Quyền kiểm duyệt không cấp quyền truy cập bệnh án.':'Xem giờ khám, giá dịch vụ và xác nhận lịch không cọc.'}</p></div></div><div className="login-story-footer"><span className="login-status-dot"/> Một tài khoản · Ba khu vực rõ ràng</div></section>
   <section className="login-card" aria-labelledby="login-title"><nav className="login-areas" aria-label="Khu vực đăng nhập">{areas.map(({id,label,icon:Icon})=><a key={id} href={'/login?area='+id} aria-current={area===id?'page':undefined} onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/login?area='+id);}}><Icon size={16}/>{label}</a>)}</nav><h2 id="login-title">{register?'Tạo tài khoản bệnh nhân':'Đăng nhập'}</h2><p>{area==='workspace'?'Mở không gian làm việc của phòng khám.':area==='platform'?'Mở Console kiểm duyệt nền tảng.':'Tiếp tục với hồ sơ và lịch khám của bạn.'}</p>{auth.notice&&<p role="status" className="login-notice">{auth.notice}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
    <form onSubmit={e=>{e.preventDefault();void submit();}} className="login-form"><fieldset disabled={busy}>{register&&<label>Họ tên<input autoComplete="name" required maxLength={180} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>}<label>Email<input autoComplete="username" type="email" required maxLength={180} value={email} onChange={e=>setEmail(e.target.value)} placeholder="ten@phongkham.vn"/></label><label>Mật khẩu<span className="password-field"><input aria-label="Mật khẩu" autoComplete={register?'new-password':'current-password'} type={showPassword?'text':'password'} required minLength={register?8:undefined} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><button className="booking-primary login-submit" type="submit">{busy?'Đang đăng nhập…':register?'Tạo tài khoản':'Đăng nhập'}<ArrowRight size={18}/></button></fieldset></form>
    {area==='public'&&<p className="login-register">{register?'Đã có tài khoản?':'Chưa có tài khoản?'} <a href={'/login?area=public'+(register?'':'&register=1')+'&next='+(new URLSearchParams(location.search).get('next')==='booking'?'booking':'account')} onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/login?area=public'+(register?'':'&register=1')+'&next='+(new URLSearchParams(location.search).get('next')==='booking'?'booking':'account'));}}>{register?'Đăng nhập':'Tạo tài khoản'}</a></p>}<p className="login-card-footer">{area==='workspace'?'Tài khoản nhân sự được chủ phòng khám cấp quyền.':area==='platform'?'Chỉ tài khoản được cấp quyền nền tảng có thể truy cập.':'Đăng ký tài khoản để lưu hồ sơ và theo dõi lịch khám.'}</p>
   </section>
  </main>
 </div>;
}
