import {RefreshCw} from 'lucide-react';
import {usePanelSession} from '../auth/SessionProvider';
import {roleNames} from '../auth/access';
import {SourceSessionState} from '../auth/SourceSessionState';
import {useEffect,useRef,useState} from 'react';
import {signIn} from '../api/booking';
import {contexts} from '../api/reception';
import * as api from '../api/configuration';
import type {CurrentActor,IamContextView} from '../types/contracts';

type Account={actor:CurrentActor;contexts:IamContextView[]};

export function AccountSettingsPanel(){
 const shared=usePanelSession(login);
 const [token,setToken]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[account,setAccount]=useState<Account|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[lastUpdated,setLastUpdated]=useState<Date|null>(null);
 const epoch=useRef(0),locked=useRef(false);
 const adminMode=shared?.workspaceSession?.contexts.some(context=>context.role==='ADMIN')??false;
 useEffect(()=>()=>{epoch.current++;},[]);
 const read=async(access:string):Promise<Account>=>{const [actor,grants]=await Promise.all([api.current(access),contexts(access)]);return {actor,contexts:grants};};
 function logout(){epoch.current++;locked.current=false;setToken('');setAccount(null);setLastUpdated(null);setPassword('');setBusy(false);setError('');setNotice('');}
 async function login(){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');const current=++epoch.current;
  try{
   const access=shared?.session?.token??(await signIn(email,password)).data.accessToken;
   setEmail(shared?.session?.email??email);setPassword('');
   const data=await read(access);
   if(current===epoch.current){setToken(access);setAccount(data);setLastUpdated(new Date());}
  }catch(e){if(current===epoch.current){setToken('');setAccount(null);setError(e instanceof Error?e.message:'Không thể đọc tài khoản.');}}
  finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }
 async function refresh(){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');const current=epoch.current;
  try{const data=await read(token);await shared?.refresh();if(current===epoch.current){setAccount(data);setLastUpdated(new Date());}}
  catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Không thể đối chiếu tài khoản.');}
  finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }
 async function revoke(){
  if(locked.current)return;locked.current=true;setBusy(true);setError('');const current=epoch.current;
  try{await api.revokeSession(token);if(current===epoch.current){logout();shared?.signOut('Đã thu hồi các phiên hiện tại. Vui lòng đăng nhập lại.');setNotice('Đã thu hồi các phiên hiện tại. Vui lòng đăng nhập lại.');}}
  catch(e){if(current===epoch.current){logout();setError(e instanceof Error?e.message:'Chưa xác nhận được kết quả thu hồi phiên.');}}
  finally{if(current===epoch.current){locked.current=false;setBusy(false);}}
 }
 return <section className="booking-panel reception-panel doctor-panel configuration-panel account-settings-panel">
  {adminMode?<header className="task-panel-header admin-page-header"><div><span className="eyebrow">HỆ THỐNG</span><h1>Cài đặt</h1><p>Xem thông tin phiên đăng nhập, quyền làm việc và các thao tác bảo mật của tài khoản quản trị.</p></div>{token&&<div className="admin-page-utilities"><span>Cập nhật lúc {lastUpdated?lastUpdated.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}):'—'}</span><button type="button" className="admin-icon-button" aria-label="Cập nhật quyền tài khoản" title="Cập nhật quyền tài khoản" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={17}/></button></div>}</header>:<><h1>Cài đặt tài khoản</h1><p>Xem thông tin phiên đăng nhập và vai trò làm việc của bạn.</p></>}
  {busy&&<p role="status">Đang đối chiếu tài khoản…</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  {!token&&shared?<SourceSessionState error={error} retry={()=>void login()}/>:!token?
   <form className="booking-form" onSubmit={e=>{e.preventDefault();void login();}}><label>Email tài khoản<input type="email" required autoComplete="username" disabled={busy} value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Mật khẩu tài khoản<input type="password" required autoComplete="current-password" disabled={busy} value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="booking-primary" disabled={busy}>Đăng nhập tài khoản</button></form>
  :<>{!shared&&<button onClick={logout}>Đăng xuất tài khoản</button>}
   <div className="account-settings-grid">
    <article className="dashboard-card"><h2>Thông tin đăng nhập</h2><div className="account-avatar" aria-hidden="true">{email.slice(0,1).toUpperCase()}</div><strong>{email}</strong><p>Vai trò quyết định những công việc bạn được sử dụng trong phòng khám.</p>{!adminMode&&<button disabled={busy} onClick={()=>void refresh()}>Tải lại quyền tài khoản</button>}</article>
    <article className="dashboard-card"><h2>Bảo mật đăng nhập</h2><p>Nếu bạn đã đăng nhập trên máy dùng chung, thu hồi phiên để yêu cầu đăng nhập lại. Thao tác này cũng kết thúc phiên hiện tại.</p><button className="danger-button" disabled={busy} onClick={()=>void revoke()}>Thu hồi phiên hiện tại</button></article>
   </div>
   {account&&<article className="dashboard-card account-permissions"><h2>Quyền làm việc</h2>{!account.contexts.length&&<p>Chưa có quyền vận hành phòng khám.</p>}<ul>{account.contexts.map(m=><li key={m.membershipId}>{roleNames[m.role]??m.role} tại phòng khám</li>)}</ul></article>}
  </>}
 </section>;
}
