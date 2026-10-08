import {NotificationInbox} from '../components/NotificationInbox';
import {Fragment,lazy,useEffect,useRef,useState} from 'react';
import {Activity,AlertTriangle,ArrowUpRight,BadgeDollarSign,Building2,ClipboardList,History,KeyRound,LayoutDashboard,LogOut,Menu,Settings,ShieldCheck,Stethoscope,Tags,UsersRound,WalletCards} from 'lucide-react';
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
const AdminFinancePanel=lazy(()=>import('../components/AdminFinancePanel').then(m=>({default:m.AdminFinancePanel})));
const AdminExceptionPanel=lazy(()=>import('../components/AdminExceptionPanel').then(m=>({default:m.AdminExceptionPanel})));
const AdminSystemPanel=lazy(()=>import('../components/AdminSystemPanel').then(m=>({default:m.AdminSystemPanel})));

type NavGroup='overview'|'clinic'|'monitor'|'work'|'system'|'platform'|'account';
type NavItem={view:WorkspaceView;label:string;Icon:typeof Building2;group:NavGroup};
const navigation:NavItem[]=[
 {view:'overview',label:'Tổng quan vận hành',Icon:LayoutDashboard,group:'overview'},
 {view:'profile',label:'Hồ sơ phòng khám',Icon:Building2,group:'clinic'},
 {view:'members',label:'Nhân sự',Icon:UsersRound,group:'clinic'},
 {view:'customers',label:'Tài khoản bệnh nhân',Icon:UsersRound,group:'clinic'},
 {view:'patients',label:'Hồ sơ bệnh nhân',Icon:ClipboardList,group:'clinic'},
 {view:'schedules',label:'Bác sĩ & lịch làm việc',Icon:Stethoscope,group:'clinic'},
 {view:'services',label:'Chuyên khoa & dịch vụ',Icon:Tags,group:'clinic'},
 {view:'prices',label:'Bảng giá',Icon:BadgeDollarSign,group:'clinic'},
 {view:'operations',label:'Vận hành hôm nay',Icon:Activity,group:'monitor'},
 {view:'finance',label:'Tài chính & đối soát',Icon:WalletCards,group:'monitor'},
 {view:'exceptions',label:'Ngoại lệ cần xử lý',Icon:AlertTriangle,group:'monitor'},
 {view:'permissions',label:'Phân quyền',Icon:KeyRound,group:'system'},
 {view:'audit',label:'Nhật ký hoạt động',Icon:History,group:'system'},
 {view:'reception',label:'Tiếp nhận & hàng đợi',Icon:ClipboardList,group:'work'},
 {view:'doctor',label:'Danh sách khám',Icon:Stethoscope,group:'work'},
 {view:'lab',label:'Kết quả xét nghiệm',Icon:ClipboardList,group:'work'},
 {view:'billing',label:'Thu phí & ca thu',Icon:Tags,group:'work'},
 {view:'system',label:'Kiểm duyệt nền tảng',Icon:ShieldCheck,group:'platform'},
 {view:'settings',label:'Cài đặt tài khoản',Icon:Settings,group:'system'}
];
const aliases:Partial<Record<WorkspaceView,WorkspaceView>>={catalog:'services'};
const groupLabels:Record<NavGroup,string>={
 overview:'TỔNG QUAN',
 clinic:'PHÒNG KHÁM',
 monitor:'GIÁM SÁT',
 work:'CÔNG VIỆC',
 system:'HỆ THỐNG',
 platform:'NỀN TẢNG',
 account:'TÀI KHOẢN'
};
const groupOrder:NavGroup[]=['overview','clinic','monitor','system','work','platform','account'];

export function WorkspaceShell({state}:{state:UiState}){
 const auth=useSession(),locationKey=useLocation();
 const [collapsed,setCollapsed]=useState(false),[clinicName,setClinicName]=useState('Phòng khám của bạn'),[navigationLock,setNavigationLock]=useState<string|null>(null),[navigating,setNavigating]=useState(false),[error,setError]=useState('');
 const main=useRef<HTMLElement>(null);
 useEffect(()=>{const raw=new URLSearchParams(window.location.search).get('view') as WorkspaceView|null;const resolved=raw?(aliases[raw]??raw):null;const label=navigation.find(item=>item.view===resolved)?.label??'Không gian phòng khám';document.title=`${label} · ${clinicName}`;},[clinicName,locationKey]);
 if(!auth?.workspaceSession)return <main id="main-content"><h1>Clinic Workspace</h1><p>Đăng nhập để mở công việc được phân công.</p></main>;

 const session=auth.workspaceSession,params=new URLSearchParams(location.search),scope=clinicContexts(session,params.get('clinicId'));
 const requested=params.get('view') as WorkspaceView|null;
 const known=!!requested&&(navigation.some(item=>item.view===requested)||requested in aliases);
 const resolved=(requested?(aliases[requested]??requested):homeView(scope.contexts)) as WorkspaceView;
 const requestedWrongClinic=!!params.get('clinicId')&&!scope.clinic;
 const mayOpen=(next:WorkspaceView,contexts=scope.contexts)=>next==='system'?session.actor.platformOperator:canOpen(next,contexts);
 const denied=requestedWrongClinic||!!requested&&!known||!mayOpen(resolved);
 const allowed=navigation.filter(item=>mayOpen(item.view));
 const isClinicAdmin=scope.contexts.some(context=>context.role==='ADMIN');
 const adminSurface=isClinicAdmin&&['overview','profile','members','customers','patients','schedules','services','prices','catalog','operations','finance','exceptions','permissions','audit','settings'].includes(resolved);
 const roles=[...new Set(scope.contexts.map(c=>roleNames[c.role]??c.role))].join(' · ')||(session.actor.platformOperator?'Quản trị nền tảng':'Tài khoản của tôi');

 function revealFocus(target:HTMLElement){if(!target.matches('input,select,textarea,button,a,summary')||!target.matches(':focus-visible'))return;const rect=target.getBoundingClientRect(),header=main.current?.parentElement?.querySelector('header')?.getBoundingClientRect();if(rect.top<Math.max(0,header?.bottom??0)+12||rect.bottom>window.innerHeight-12)target.scrollIntoView({block:'center',inline:'nearest'});}
 async function navigate(next:WorkspaceView){
  if(navigationLock||navigating)return;setNavigating(true);setError('');
  try{
   const verified=await auth!.refreshWorkspace();if(!verified)return;
   const current=clinicContexts(verified,scope.clinic);
   const allowedNow=next==='system'?verified.actor.platformOperator:canOpen(next,current.contexts);
   if(!allowedNow)throw new Error('Quyền của bạn đã thay đổi. Màn này chưa được cấp quyền.');
   auth!.navigate('/workspace?'+new URLSearchParams({view:next,...(current.clinic?{clinicId:current.clinic}:{})}));
   main.current?.focus();
  }catch(e){setError(e instanceof Error?e.message:'Chưa xác minh được quyền. Vui lòng thử lại.');}
  finally{setNavigating(false);}
 }
 const busy=!!navigationLock||navigating;
 const receptionWorkspace=['reception','billing'].includes(resolved)||(resolved==='settings'&&scope.contexts.length>0&&scope.contexts.every(c=>c.role==='STAFF'));

 function content(){
  if(denied)return <section className="booking-panel"><h1>Màn hình chưa được cấp quyền</h1><p>Bạn không có quyền mở nội dung này tại phòng khám trong đường dẫn. Chọn công việc được cấp quyền ở thanh bên hoặc liên hệ Quản trị phòng khám.</p></section>;
  if(state!=='ready')return <UiStatePanel state={state}/>;
  if(resolved==='settings')return <AccountSettingsPanel/>;
  if(resolved==='permissions'||resolved==='audit')return scope.clinic?<AdminSystemPanel mode={resolved} clinicId={scope.clinic}/>:null;
  if(resolved==='finance')return scope.clinic?<AdminFinancePanel clinicId={scope.clinic} onClinic={setClinicName}/>:null;
  if(resolved==='exceptions')return scope.clinic?<AdminExceptionPanel clinicId={scope.clinic} onClinic={setClinicName}/>:null;
  if(['profile','members','customers','patients','schedules','services','prices','catalog'].includes(resolved))return <ConfigurationPanel mode={resolved as ConfigurationMode} onClinic={setClinicName} onNavigationLock={setNavigationLock}/>;
  if(resolved==='system')return <SystemPanel onNavigationLock={setNavigationLock}/>;
  if(resolved==='billing')return <CashierPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>;
  if(resolved==='lab')return <LabPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>;
  if(resolved==='doctor')return <DoctorPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>;
  if(resolved==='reception')return <ReceptionPanel onClinic={setClinicName} onNavigationLock={setNavigationLock}/>;
  if(resolved==='operations')return <OperationsPanel onClinic={setClinicName} mode="operations"/>;
  return <OperationsPanel onClinic={setClinicName}/>;
 }

 return <div className={`workspace-shell ${collapsed?'sidebar-collapsed':''} ${adminSurface?'admin-workspace':''} ${receptionWorkspace?'reception-workspace':''} ${['doctor','lab'].includes(resolved)?'doctor-workspace':''}`}>
  <aside className="workspace-sidebar">
   <div className="workspace-brand"><span className="brand-mark"><Stethoscope size={21}/></span>{!collapsed&&<span><strong>Phòng khám</strong><small>Không gian làm việc</small></span>}</div>
   <button className="collapse-button" type="button" onClick={()=>setCollapsed(v=>!v)} aria-label={collapsed?'Mở rộng thanh điều hướng':'Thu gọn thanh điều hướng'} aria-expanded={!collapsed} aria-controls="workspace-navigation"><Menu size={18}/></button>
   <nav id="workspace-navigation" className="workspace-nav" aria-label="Điều hướng Clinic Workspace">
    {groupOrder.map(group=>{const items=allowed.filter(item=>{const displayGroup=item.view==='settings'&&!isClinicAdmin?'account':item.group;return displayGroup===group;});if(!items.length)return null;return <Fragment key={group}>{!collapsed&&<p className="workspace-nav-label">{groupLabels[group]}</p>}{items.map(({view:next,label,Icon})=>{const displayLabel=next==='settings'&&isClinicAdmin?'Cài đặt':label;return <button key={next} type="button" className={!denied&&resolved===next?'nav-active':''} disabled={busy&&resolved!==next} aria-label={displayLabel} aria-current={!denied&&resolved===next?'page':undefined} aria-describedby={navigationLock?'workspace-navigation-lock':undefined} title={displayLabel} onClick={()=>void navigate(next)}><Icon size={18} aria-hidden="true"/>{!collapsed&&<span>{displayLabel}</span>}</button>;})}</Fragment>;})}
   </nav>
   <div className="sidebar-footer">{!collapsed&&<span><strong>{roles}</strong><small>Quyền được cấp tại phòng khám</small></span>}</div>
  </aside>
  <div className="workspace-main">
   <header className="workspace-topbar"><div className="single-clinic-context" aria-label="Phòng khám đang quản lý"><div className="context-field single-clinic-field"><Building2 size={16} aria-hidden="true"/><div><span className="context-label">PHÒNG KHÁM</span><strong>{scope.clinic?clinicName:session.actor.platformOperator?'Toàn nền tảng':'Chưa có quyền phòng khám'}</strong></div></div><div className="context-role"><ShieldCheck size={16} aria-hidden="true"/><span>{isClinicAdmin?'Quản trị':roles}</span></div></div><div className="workspace-account"><NotificationInbox token={session.token}/><span title={session.email}>{session.email}</span><button disabled={busy} title="Mở trang Public" aria-label="Mở trang Public" onClick={()=>auth.navigate('/public')}><ArrowUpRight size={17}/></button><button disabled={busy} aria-label="Đăng xuất" title="Đăng xuất" onClick={()=>{auth.signOutWorkspace();auth.navigate('/workspace/login',true);}}><LogOut size={17}/></button></div></header>
   <main ref={main} onFocusCapture={e=>revealFocus(e.target as HTMLElement)} tabIndex={-1} id="main-content" className="workspace-content">{navigationLock&&<p id="workspace-navigation-lock" role="status" className="navigation-lock">{navigationLock}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}<AsyncPanel key={resolved}>{content()}</AsyncPanel></main>
  </div>
 </div>;
}
