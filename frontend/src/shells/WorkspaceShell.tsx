import {lazy,useEffect,useRef,useState} from 'react';
import {Building2,ClipboardList,LayoutDashboard,LogOut,Menu,ShieldCheck,Stethoscope,Tags,UsersRound,Settings,ArrowUpRight} from 'lucide-react';
import type {UiState} from '../types/contracts';
import {UiStatePanel} from '../components/UiStatePanel';
import type {ConfigurationMode} from '../components/ConfigurationPanel';
import {AsyncPanel} from '../components/AsyncPanel';
import {useLocation,useSession} from '../auth/SessionProvider';
import {canOpen,clinicContexts,homeView,roleNames,type WorkspaceView} from '../auth/access';
const ReceptionPanel=lazy(()=>import('../components/ReceptionPanel').then(m=>({default:m.ReceptionPanel})));
const DoctorPanel=lazy(()=>import('../components/DoctorPanel').then(m=>({default:m.DoctorPanel})));
const LabPanel=lazy(()=>import('../components/LabPanel').then(m=>({default:m.LabPanel})));
const CashierPanel=lazy(()=>import('../components/CashierPanel').then(m=>({default:m.CashierPanel})));
const OperationsPanel=lazy(()=>import('../components/OperationsPanel').then(m=>({default:m.OperationsPanel})));
const ConfigurationPanel=lazy(()=>import('../components/ConfigurationPanel').then(m=>({default:m.ConfigurationPanel})));
const AccountSettingsPanel=lazy(()=>import('../components/AccountSettingsPanel').then(m=>({default:m.AccountSettingsPanel})));
const SystemPanel=lazy(()=>import('../components/PlatformReviewPanel').then(m=>({default:m.PlatformReviewPanel})));
const navigation:[WorkspaceView,string,typeof Building2][]=[
 ['overview','Tổng quan',LayoutDashboard],['profile','Hồ sơ phòng khám',Building2],['members','Nhân sự',UsersRound],['schedules','Bác sĩ & lịch làm việc',Stethoscope],['catalog','Danh mục & bảng giá',Tags],['reception','Tiếp nhận & hàng đợi',ClipboardList],['doctor','Danh sách khám',Stethoscope],['lab','Kết quả xét nghiệm',ClipboardList],['billing','Thu phí & ca thu',Tags],['system','Quản trị hệ thống',ShieldCheck],['settings','Cài đặt tài khoản',Settings]
];
export function WorkspaceShell({state}:{state:UiState}){
 const auth=useSession(),locationKey=useLocation();
 const [collapsed,setCollapsed]=useState(false),[clinicName,setClinicName]=useState('Phòng khám của bạn'),[navigationLock,setNavigationLock]=useState<string|null>(null),[navigating,setNavigating]=useState(false),[error,setError]=useState('');
 const main=useRef<HTMLElement>(null);
 useEffect(()=>{const label=navigation.find(([name])=>name===new URLSearchParams(window.location.search).get('view'))?.[1]??'Không gian phòng khám';document.title=`${label} · ${clinicName}`;},[clinicName,locationKey]);
 if(!auth?.session)return <main id="main-content"><h1>Clinic Workspace</h1><p>Đăng nhập để mở công việc được phân công.</p></main>;
 const session=auth.session,params=new URLSearchParams(location.search),scope=clinicContexts(session,params.get('clinicId'));
 const requested=params.get('view');const known=navigation.some(([view])=>view===requested);
 const view=(requested&&known?requested:homeView(scope.contexts)) as WorkspaceView;
 const requestedWrongClinic=!!params.get('clinicId')&&!scope.clinic;
 const denied=requestedWrongClinic||!!requested&&!known||!canOpen(view,scope.contexts)||(view==='system'&&!session.actor.platformOperator);
 const allowed=navigation.filter(([next])=>canOpen(next,scope.contexts)&&(next!=='system'||session.actor.platformOperator));
 const roles=[...new Set(scope.contexts.map(c=>roleNames[c.role]??c.role))].join(' · ')||'Tài khoản của tôi';
 function revealFocus(target:HTMLElement){if(!target.matches('input,select,textarea,button,a,summary')||!target.matches(':focus-visible'))return;const rect=target.getBoundingClientRect(),header=main.current?.parentElement?.querySelector('header')?.getBoundingClientRect();if(rect.top<Math.max(0,header?.bottom??0)+12||rect.bottom>window.innerHeight-12)target.scrollIntoView({block:'center',inline:'nearest'});}
 async function navigate(next:WorkspaceView){
  if(navigationLock||navigating)return;setNavigating(true);setError('');
  try{const verified=await auth!.refresh();if(!verified)return;const current=clinicContexts(verified,scope.clinic);if(!canOpen(next,current.contexts))throw new Error('Quyền của bạn đã thay đổi. Màn này chưa được cấp quyền.');auth!.navigate('/workspace?'+new URLSearchParams({view:next,...(current.clinic?{clinicId:current.clinic}:{})}));main.current?.focus();}catch(e){setError(e instanceof Error?e.message:'Chưa xác minh được quyền. Vui lòng thử lại.');}finally{setNavigating(false);}
 }
 const busy=!!navigationLock||navigating;
 return <div className={`workspace-shell ${collapsed?'sidebar-collapsed':''}`}>
  <aside className="workspace-sidebar"><div className="workspace-brand"><span className="brand-mark"><Stethoscope size={21}/></span>{!collapsed&&<span><strong>Phòng khám</strong><small>Không gian làm việc</small></span>}</div><button className="collapse-button" type="button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Mở rộng thanh điều hướng':'Thu gọn thanh điều hướng'} aria-expanded={!collapsed} aria-controls="workspace-navigation"><Menu size={18}/></button>
   {!collapsed&&<p className="workspace-nav-label">KHÔNG GIAN LÀM VIỆC</p>}<nav id="workspace-navigation" className="workspace-nav" aria-label="Điều hướng Clinic Workspace">{allowed.map(([next,label,Icon])=><button key={next} type="button" className={!denied&&view===next?'nav-active':''} disabled={busy&&view!==next} aria-label={label} aria-current={!denied&&view===next?'page':undefined} aria-describedby={navigationLock?'workspace-navigation-lock':undefined} title={label} onClick={()=>void navigate(next)}><Icon size={18} aria-hidden="true"/>{!collapsed&&<span>{label}</span>}</button>)}</nav>
   <div className="sidebar-footer">{!collapsed&&<span><strong>{roles}</strong><small>Quyền được cấp tại phòng khám</small></span>}</div>
  </aside>
  <div className="workspace-main"><header className="workspace-topbar"><div className="single-clinic-context" aria-label="Phòng khám đang quản lý"><div className="context-field single-clinic-field"><Building2 size={16} aria-hidden="true"/><div><span className="context-label">Phòng khám</span><strong>{scope.clinic?clinicName:'Chưa có quyền phòng khám'}</strong></div></div><div className="context-role"><ShieldCheck size={16} aria-hidden="true"/><span>{roles}</span></div></div><div className="workspace-account"><span title={session.email}>{session.email}</span><button disabled={busy} title="Mở trang Public" aria-label="Mở trang Public" onClick={()=>auth.navigate('/public')}><ArrowUpRight size={17}/></button><button disabled={busy} aria-label="Đăng xuất" title="Đăng xuất" onClick={()=>{auth.signOut();auth.navigate('/workspace',true);}}><LogOut size={17}/></button></div></header>
   <main ref={main} onFocusCapture={e=>revealFocus(e.target as HTMLElement)} tabIndex={-1} id="main-content" className="workspace-content">{navigationLock&&<p id="workspace-navigation-lock" role="status" className="navigation-lock">{navigationLock}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}<AsyncPanel key={view}><>{denied?<section className="booking-panel"><h1>Màn hình chưa được cấp quyền</h1><p>Bạn không có quyền mở nội dung này tại phòng khám trong đường dẫn. Chọn công việc được cấp quyền ở thanh bên hoặc liên hệ Quản trị phòng khám.</p></section>:state!=='ready'?<UiStatePanel state={state}/>:view==='settings'?<AccountSettingsPanel/>:['profile','members','schedules','catalog'].includes(view)?<ConfigurationPanel mode={view as ConfigurationMode} onClinic={setClinicName} onNavigationLock={setNavigationLock}/>:view==='system'?<SystemPanel onNavigationLock={setNavigationLock}/>:view==='billing'?<CashierPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>:view==='lab'?<LabPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>:view==='doctor'?<DoctorPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>:view==='reception'?<ReceptionPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>:<OperationsPanel onClinic={setClinicName}/>}</></AsyncPanel></main>
  </div>
 </div>;
}
