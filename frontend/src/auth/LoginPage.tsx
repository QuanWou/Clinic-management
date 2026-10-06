import {useState} from 'react';
import {ArrowLeft,ArrowRight,Building2,Eye,EyeOff,Stethoscope,UserRound} from 'lucide-react';
import {useSession} from './SessionProvider';
import {clinicContexts,workspaceUrl} from './access';
type Area='public'|'workspace';
const areas=[{id:'public' as const,label:'Bệnh nhân',icon:UserRound},{id:'workspace' as const,label:'Phòng khám',icon:Building2}];
export function LoginPage({area='workspace',brandName,registerMode}:{area?:Area;brandName?:string;registerMode?:boolean}){
 const auth=useSession()!,[email,setEmail]=useState(''),[password,setPassword]=useState(''),[fullName,setFullName]=useState(''),[showPassword,setShowPassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const register=area==='public'&&(registerMode??new URLSearchParams(location.search).get('register')==='1');
 async function submit(){
  if(busy)return;setBusy(true);setError('');
  try{
   const user=await auth.authenticate(email.trim(),password,register?fullName.trim():undefined);setPassword('');
   const requested=new URLSearchParams(location.search).get('clinicId');
   if(area==='workspace'){
    const scope=clinicContexts(user,requested);
    if(requested&&!scope.clinic){auth.signOut();throw new Error('Bạn chưa được cấp quyền tại phòng khám trong đường dẫn này.');}
    if(!user.contexts.length){auth.navigate('/workspace?view=settings',true);}
    else if(!scope.clinic){auth.navigate('/workspace',true);}
    else{const params=new URLSearchParams(location.search);const view=params.get('view');auth.navigate(view?'/workspace?'+new URLSearchParams({view,clinicId:scope.clinic}):workspaceUrl(user,scope.clinic),true);}
   }else{const next=new URLSearchParams(location.search).get('next');auth.navigate(next==='booking'||next==='dat-lich'?'/dat-lich':'/tai-khoan/lich-kham',true);}
  }catch(e){setPassword('');setError(e instanceof Error?e.message:'Chưa đăng nhập được. Vui lòng thử lại.');}finally{setBusy(false);}
 }
 return <div className={`login-page login-${area}`}>
  <header className="login-header"><a className="brand" href="/public" onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/public');}}><span className="brand-mark"><Stethoscope size={23}/></span><span><strong>{brandName??'Phòng khám'}</strong><small>Chăm sóc ngoại trú</small></span></a><a href="/public" onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/public');}}><ArrowLeft size={16}/> Về trang Public</a></header>
  <main id="main-content" tabIndex={-1} className="login-layout">
   <section className="login-card" aria-labelledby="login-title"><header className="login-card-brand"><span className="brand-mark"><Stethoscope size={21}/></span><div><strong>{brandName??'Phòng khám'}</strong><small>Chăm sóc ngoại trú</small></div></header><nav className="login-areas" aria-label="Loại tài khoản">{areas.map(({id,label,icon:Icon})=><a key={id} href={'/login?area='+id+(register&&id==='public'?'&register=1':'')} aria-current={area===id?'page':undefined} onClick={e=>{e.preventDefault();if(!busy)auth.navigate('/login?area='+id+(register&&id==='public'?'&register=1':''));}}><Icon size={16}/>{label}</a>)}</nav><div className="login-card-intro"><span className="eyebrow">CỔNG THÔNG TIN PHÒNG KHÁM</span><h1 id="login-title">{register?'Tạo tài khoản bệnh nhân':'Đăng nhập'}</h1><p>{register?'Tạo tài khoản để lưu hồ sơ và theo dõi lịch khám.':'Tiếp tục với hồ sơ bệnh nhân hoặc không gian làm việc của phòng khám.'}</p></div>{auth.notice&&<p role="status" className="login-notice">{auth.notice}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}
    <form onSubmit={e=>{e.preventDefault();void submit();}} className="login-form"><fieldset disabled={busy}>{register&&<label>Họ tên<input autoComplete="name" required maxLength={180} value={fullName} onChange={e=>setFullName(e.target.value)}/></label>}<label>Email<input autoComplete="username" type="email" required maxLength={180} value={email} onChange={e=>setEmail(e.target.value)} placeholder="ten@phongkham.vn"/></label><label>Mật khẩu<span className="password-field"><input aria-label="Mật khẩu" autoComplete={register?'new-password':'current-password'} type={showPassword?'text':'password'} required minLength={register?8:undefined} maxLength={100} value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" aria-label={showPassword?'Ẩn mật khẩu':'Hiện mật khẩu'} aria-pressed={showPassword} onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><button className="booking-primary login-submit" type="submit">{busy?'Đang đăng nhập…':register?'Tạo tài khoản':'Đăng nhập'}<ArrowRight size={18}/></button></fieldset></form>
    {area==='public'&&<p className="login-register">{register?'Đã có tài khoản?':'Chưa có tài khoản?'} <a href={(register?'/dang-nhap':'/dang-ky')+'?next='+(new URLSearchParams(location.search).get('next')==='booking'?'booking':'account')} onClick={e=>{e.preventDefault();if(!busy)auth.navigate((register?'/dang-nhap':'/dang-ky')+'?next='+(new URLSearchParams(location.search).get('next')==='booking'?'booking':'account'));}}>{register?'Đăng nhập':'Tạo tài khoản'}</a></p>}<p className="login-card-footer">{area==='workspace'?'Tài khoản nhân sự được Quản trị cấp quyền.':'Đăng ký tài khoản để lưu hồ sơ và theo dõi lịch khám.'}</p>
   </section>
  </main>
 </div>;
}
