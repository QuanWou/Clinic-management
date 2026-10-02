import {usePanelSession,useLocation,navigateLocal} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import {workspaceUrl} from '../auth/access';
import { useEffect, useRef, useState } from 'react';
import { Stethoscope,ArrowRight } from 'lucide-react';
import type { UiState } from '../types/contracts';
import { UiStatePanel } from '../components/UiStatePanel';
import * as api from '../api/booking';
import { requestJson } from '../api/client';
import { stableOperationKey, forgetOperationKey } from '../api/idempotency';
import {PublicClinicHome} from '../components/PublicClinicHome';
import { PatientHistoryPanel } from '../components/PatientHistoryPanel';
import type { FollowUpPlan } from '../api/portal';

const empty: api.ProfileInput = { fullName: '', dateOfBirth: '', sex: '', phone: '', email: '', expectedVersion: 0 };
const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); };

export function PublicShell({ state,background=false,onSiteName }: { state: UiState;background?:boolean;onSiteName?:(name:string)=>void }) {
  const shared=usePanelSession(()=>run(login));
  const location=useLocation();
  const view=location.split('?')[0]==='/public/booking'?'booking':location.split('?')[0]==='/public/account'?'account':'home';
  const navigate=shared?.navigate??navigateLocal;
  const previousView=useRef(view);
  useEffect(()=>{if(previousView.current!==view){previousView.current=view;window.scrollTo(0,0);if(!background)document.getElementById('main-content')?.focus();}},[view,background]);
  const [siteLoading,setSiteLoading]=useState(state==='ready');
  const [siteError,setSiteError]=useState('');
  const [siteAttempt,setSiteAttempt]=useState(0);
  const siteClinicId=useRef<string|null>(null);
  const [clinic, setClinic] = useState<api.Clinic | null>(null);
  useEffect(()=>{if(clinic?.name)onSiteName?.(clinic.name);},[clinic?.name,onSiteName]);
  useEffect(()=>{if(!background)document.title=(view==='booking'?'Đặt lịch khám | ':view==='account'?'Tài khoản bệnh nhân | ':'')+(clinic?.name??'Phòng khám');},[view,clinic?.name,background]);
  const [branch, setBranch] = useState('');
  const [doctors, setDoctors] = useState<api.Doctor[]>([]);
  const [offerings, setOfferings] = useState<api.Offering[]>([]);
  const [doctor, setDoctor] = useState('');
  const [offering, setOffering] = useState('');
  const [date, setDate] = useState(tomorrow);
  const [slots, setSlots] = useState<api.Slot[] | null>(null);
  const [hold, setHold] = useState<api.Hold | null>(null);
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [draft, setDraft] = useState(empty);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [register, setRegister] = useState(false);
  const [appointments, setAppointments] = useState<api.Appointment[]>([]);
  const [appointmentsLoaded,setAppointmentsLoaded]=useState(false);
  const [moving, setMoving] = useState<api.Appointment | null>(null);
  const [followUp,setFollowUp]=useState<FollowUpPlan|null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [notifications, setNotifications] = useState<api.Notification[]>([]);
  const [reminders, setReminders] = useState<boolean | null>(null);
  const [pendingHolds, setPendingHolds] = useState<api.PendingHold[]>([]);
  const running = useRef(false);
  const keys = useRef({ payload: '', hold: '', confirm: '' });
  useEffect(()=>{
    if(state!=='ready')return;
    let mounted=true;setSiteLoading(true);setSiteError('');
    void (async()=>{
      try{
        const c=await api.getSiteClinic();
        const b=c.branches.length===1?c.branches[0].branchId:'';
        if(!mounted)return;
        siteClinicId.current=c.clinicId;setClinic(c);setBranch(b);
        const [d,o]=await Promise.all([api.getDoctors(c.clinicId,b||undefined),api.getOfferings(c.clinicId,b||undefined)]);
        if(!mounted)return;
        setDoctors(d);setOfferings(o);
      }catch(e){if(mounted)setSiteError(e instanceof Error?e.message:'Chưa tải được thông tin phòng khám. Vui lòng thử lại.');}
      finally{if(mounted)setSiteLoading(false);}
    })();
    return()=>{mounted=false;};
  },[state,siteAttempt]);
  useEffect(()=>{
    if(view!=='account'||!clinic||!profile||!token)return;
    let active=true;setAppointments([]);setAppointmentsLoaded(false);
    void api.myAppointments(token,clinic.clinicId,profile.patientId).then(list=>{if(active){setAppointments(list);setAppointmentsLoaded(true);}}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Chưa tải được lịch khám. Hãy thử lại.');});
    return()=>{active=false;};
  },[view,clinic?.clinicId,profile?.patientId,token]);
  useEffect(() => { if (!hold) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [hold]);
  async function run(action: () => Promise<void>) {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể hoàn tất. Hãy thử lại.'); }
    finally { running.current = false; setBusy(false); }
  }
  function clear() { setSlots(null); setHold(null); setPendingHolds([]); keys.current = { payload: '', hold: '', confirm: '' }; }
  async function selectClinic(id: string) {
    if(!siteClinicId.current||id!==siteClinicId.current)throw new Error('Lịch tái khám này thuộc phòng khám khác. Vui lòng liên hệ phòng khám đã khám để đặt lịch.');
    const c=await api.getSiteClinic(id);
    const b=c.branches.length===1?c.branches[0].branchId:'';
    const [d,o]=await Promise.all([api.getDoctors(c.clinicId,b||undefined),api.getOfferings(c.clinicId,b||undefined)]);
    setClinic(c);setBranch(b);setDoctors(d);setOfferings(o);setDoctor('');setOffering('');setAppointments([]);setMoving(null);setFollowUp(null);clear();
  }
  async function selectBranch(id: string) {
    if (!clinic) return;
    setBranch(id); setDoctor(''); setOffering(''); setDoctors([]); setOfferings([]); clear();
    if (!id) return;
    const [d, o] = await Promise.all([api.getDoctors(clinic.clinicId, id), api.getOfferings(clinic.clinicId, id)]);
    setDoctors(d); setOfferings(o);
  }
  async function reload() {
    if (clinic && profile) {setAppointments(await api.myAppointments(token, clinic.clinicId, profile.patientId));setAppointmentsLoaded(true);}
  }
  async function login() {
    const response = shared?.session?{data:{accessToken:shared.session.token}}:await api.signIn(email, password, register ? name : undefined);
    const accessToken = response.data.accessToken;
    setToken(accessToken); setEmail(shared?.session?.email??email); setPassword(''); setFollowUp(null);setNotifications([]);setReminders(null);clear();
    const result = await requestJson<api.Profile>((import.meta.env.VITE_PATIENT_V2_URL ?? '/s1/patient') + '/api/v2/me/patient-profile', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (result.ok && result.data) { setProfile(result.data); setDraft({ ...result.data, expectedVersion: result.data.version }); }
    else if (result.status === 404) { setProfile(null); setDraft({ ...empty, fullName: name, email }); }
    else throw new Error(result.message);
    setMessage('Đã đăng nhập. Kiểm tra hồ sơ trước khi đặt lịch.');
  }
  async function reserve(s: api.Slot) {
    if (!clinic || !profile) return;
    const input = { clinicId: clinic.clinicId, branchId: branch, doctorId: doctor, offeringId: offering, slotId: s.slotId, patientId: profile.patientId, ...(followUp ? {priorEncounterId:followUp.encounterId,priorBranchId:followUp.branchId} : {}) };
    const payload = JSON.stringify(input);
    if (keys.current.payload !== payload) keys.current = { payload, hold: await stableOperationKey('hold',input), confirm: '' };
    const held=followUp ? await api.holdFollowUp(token,{...input,priorEncounterId:followUp.encounterId,priorBranchId:followUp.branchId},keys.current.hold) : await api.holdSlot(token,input,keys.current.hold);
    if (held.state !== 'ACTIVE') { await reload(); throw new Error('Lượt giữ giờ đã được xử lý. Kiểm tra lịch của bạn trước khi đặt tiếp.'); }
    if (Date.parse(held.expiresAt) <= Date.now()) { await forgetOperationKey('hold', input); keys.current.payload = ''; }
    keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:profile.patientId,holdId:held.holdId});
    setHold(held);setNow(Date.now());
  }
  async function confirm() {
    if (!clinic || !profile || !hold) return;
    if(!keys.current.confirm)keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:profile.patientId,holdId:hold.holdId});
    const a = moving ? await api.rescheduleAppointment(token, moving, profile.patientId, hold.holdId) : await api.confirmHold(token, clinic.clinicId, profile.patientId, hold.holdId, keys.current.confirm);
    setMessage((moving ? 'Đã đổi lịch: ' : 'Đã xác nhận: ') + a.appointmentCode + ' · ' + when(a.startsAt));
    setHold(null); setMoving(null);setFollowUp(null); setSlots(null); await reload();
  }
  function openAccount(){navigate('/public/account');}
  function openBooking(d?:api.Doctor,o?:api.Offering){
    navigate('/public/booking');
    if(d||o)void run(async()=>{const chosenBranch=d?.branchId??o?.branchId;if(chosenBranch&&chosenBranch!==branch)await selectBranch(chosenBranch);if(d)setDoctor(d.doctorId);if(o)setOffering(o.offeringId);clear();});
  }
  const remaining = hold ? Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000)) : 0;
  return <div className="public-app">
    <header className="public-header"><a className="brand" href="/public" onClick={e=>{if(shared){e.preventDefault();shared.navigate('/public');}}}><span className="brand-mark"><Stethoscope size={22} /></span><span><strong>{clinic?.name??'Phòng khám'}</strong><small>Đặt lịch & hồ sơ bệnh nhân</small></span></a>
      <nav className="public-nav" aria-label="Điều hướng công khai">{[['about','Giới thiệu'],['services','Dịch vụ'],['doctors','Bác sĩ'],['contact','Liên hệ']].map(([id,label])=><a key={id} href={'/public#'+id} onClick={e=>{e.preventDefault();navigate('/public#'+id);}}>{label}</a>)}<a href="/public/account" onClick={e=>{e.preventDefault();openAccount();}}>Tài khoản bệnh nhân</a><a className="public-sign-in" href="/public/booking" onClick={e=>{e.preventDefault();openBooking();}}>Đặt lịch khám <ArrowRight size={16}/></a></nav></header>
    <main tabIndex={-1} id={background?'public-background-content':'main-content'}>
      {view!=='home'&&<section className="public-section public-inner-heading"><a href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}>← Trang chủ</a><span className="eyebrow">{clinic?.name??'Phòng khám'}</span><h1>{view==='booking'?'Đặt lịch khám':'Tài khoản bệnh nhân'}</h1><p>{view==='booking'?'Chọn lịch phù hợp và xác nhận thông tin trước khi đến khám.':'Hồ sơ, lịch khám và biên nhận của bạn tại phòng khám.'}</p></section>}
      <div className="booking-feedback" aria-live="polite">{busy&&<p role="status">Đang xử lý…</p>}{siteLoading&&<p role="status">Đang tải thông tin và lịch khám…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{siteError&&<div role="alert" className="booking-error"><p>{siteError}</p><button className="button-secondary" disabled={siteLoading} onClick={()=>setSiteAttempt(v=>v+1)}>Tải lại thông tin phòng khám</button></div>}{state!=='ready'&&<UiStatePanel state={state}/>}</div>
      {view==='home'&&<PublicClinicHome clinic={clinic} doctors={doctors} offerings={offerings} book={openBooking} openAccount={openAccount}/>}
      {view==='booking'&&clinic && <section className="public-section booking-panel" id="booking"><h2>Chọn lịch khám</h2><p>Chọn bác sĩ, dịch vụ và ngày bạn muốn đến khám.</p>{moving && <p role="status">Đổi lịch {moving.appointmentCode}. Lịch hiện tại được giữ đến khi xác nhận giờ mới.</p>}
        <form className="booking-form" onSubmit={e => { e.preventDefault(); void run(async () => { clear(); setSlots(await api.getSlots({ clinicId: clinic.clinicId, branchId: branch, offeringId: offering, doctorId: doctor, date })); }); }}>
          {clinic.branches.length>1&&<label>Địa điểm khám<select required disabled={busy} value={branch} onChange={e=>void run(()=>selectBranch(e.target.value))}><option value="">Chọn địa điểm khám</option>{clinic.branches.map(b=><option key={b.branchId} value={b.branchId}>{b.name} · {b.address}</option>)}</select></label>}
          <label>Bác sĩ<select required disabled={busy} value={doctor} onChange={e => { setDoctor(e.target.value); clear(); }}><option value="">Chọn bác sĩ</option>{doctors.map(d => <option key={d.doctorId} value={d.doctorId}>{d.displayName}</option>)}</select></label>
          <label>Dịch vụ<select required disabled={busy} value={offering} onChange={e => { setOffering(e.target.value); clear(); }}><option value="">Chọn dịch vụ</option>{offerings.map(o => <option key={o.offeringId} value={o.offeringId}>{o.name} · {money(o.amountVnd)}</option>)}</select></label>
          <label>Ngày khám<input required disabled={busy} type="date" value={date} onChange={e => { setDate(e.target.value); clear(); }} /></label><button className="booking-primary" disabled={busy||!branch}>Xem giờ còn trống</button>
        </form>
        {slots?.length === 0 && <p role="status">Không còn giờ khám phù hợp trong ngày này. Chọn ngày khác.</p>}
        <div className="booking-slots" aria-label="Giờ khám còn trống">{slots?.map(s => <button className="button-secondary" key={s.slotId} disabled={busy || !profile || !!hold} onClick={() => void run(() => reserve(s))}>{when(s.startsAt)} · {money(s.price.amountVnd)}</button>)}</div>
        {!profile && <p>Đăng nhập và lưu hồ sơ bệnh nhân trước khi giữ giờ khám.</p>}
        {hold && <div className="booking-confirm"><h3>Giờ khám đang được giữ</h3><p>Giá: {money(hold.price.amountVnd)} · Có hiệu lực từ {when(hold.price.effectiveFrom)}</p><p>{hold.price.taxPolicyCode && 'Thuế: ' + hold.price.taxPolicyCode + '. '}{hold.price.discountPolicyCode && 'Ưu đãi: ' + hold.price.discountPolicyCode}</p><p role="timer">{remaining > 0 ? 'Còn ' + Math.floor(remaining / 60) + ' phút ' + remaining % 60 + ' giây để xác nhận.' : 'Hết thời gian giữ giờ. Tải lại giờ còn trống.'}</p><p>Không yêu cầu đặt cọc cho lượt đặt lịch này.</p><button className="booking-primary" disabled={busy || remaining <= 0} onClick={() => void run(confirm)}>Xác nhận {moving ? 'đổi lịch' : 'đặt lịch'}</button><button className="button-secondary" disabled={busy} onClick={clear}>Chọn lại giờ</button></div>}
      </section>}
      {view!=='home'&&<section className="public-section booking-panel" id="profile"><h2>Hồ sơ bệnh nhân</h2>{!token&&shared?<>{shared.session?<SourceSessionState error={error} retry={()=>void run(login)}/>:<div className="public-account-entry"><p>Đăng nhập để lưu hồ sơ, đặt lịch và theo dõi lịch khám của bạn.</p><button className="booking-primary" onClick={()=>shared.navigate('/login?area=public&next='+view)}>{view==='booking'?'Đăng nhập để đặt lịch':'Đăng nhập tài khoản'}</button><button className="button-secondary" onClick={()=>shared.navigate('/login?area=public&register=1&next='+view)}>Tạo tài khoản bệnh nhân</button></div>}</>:!token ? <form className="booking-form" onSubmit={e => { e.preventDefault(); void run(login); }}>
        <label>Email<input required type="email" autoComplete="username" disabled={busy} value={email} maxLength={180} onChange={e => setEmail(e.target.value)} /></label>
        <label>Mật khẩu<input required type="password" autoComplete={register ? 'new-password' : 'current-password'} disabled={busy} minLength={register ? 8 : undefined} maxLength={100} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {register && <label>Họ tên<input required autoComplete="name" disabled={busy} maxLength={180} value={name} onChange={e => setName(e.target.value)} /></label>}
        <button className="booking-primary" disabled={busy}>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</button><button type="button" className="button-secondary" disabled={busy} onClick={() => setRegister(!register)}>{register ? 'Đã có tài khoản' : 'Tạo tài khoản mới'}</button>
      </form> : <><form className="booking-form" onSubmit={e => { e.preventDefault(); void run(async () => { const p = await api.saveProfile(token, draft); setProfile(p); setDraft({ ...p, expectedVersion: p.version }); clear(); setMessage('Đã lưu hồ sơ.'); }); }}>
        <label>Họ tên<input required autoComplete="name" disabled={busy} maxLength={180} value={draft.fullName} onChange={e => setDraft({ ...draft, fullName: e.target.value })} /></label>
        <label>Ngày sinh<input required type="date" disabled={busy} value={draft.dateOfBirth} onChange={e => setDraft({ ...draft, dateOfBirth: e.target.value })} /></label>
        <label>Giới tính<select disabled={busy} value={draft.sex ?? ''} onChange={e => setDraft({ ...draft, sex: e.target.value })}><option value="">Chưa cung cấp</option><option value="FEMALE">Nữ</option><option value="MALE">Nam</option><option value="OTHER">Khác</option></select></label>
        <label>Số điện thoại<input type="tel" autoComplete="tel" disabled={busy} maxLength={30} value={draft.phone ?? ''} onChange={e => setDraft({ ...draft, phone: e.target.value })} /></label>
        <label>Email<input type="email" autoComplete="email" disabled={busy} maxLength={180} value={draft.email ?? ''} onChange={e => setDraft({ ...draft, email: e.target.value })} /></label><button className="booking-primary" disabled={busy}>Lưu hồ sơ</button>
      </form><button className="button-secondary" disabled={busy} onClick={() => void run(async () => { const p=await api.getProfile(token);setProfile(p);setDraft({...p,expectedVersion:p.version});setMessage('Đã tải hồ sơ mới nhất.'); })}>Tải lại hồ sơ</button> <button className="button-secondary" disabled={busy} onClick={() => { shared?.signOut();setToken('');setFollowUp(null); setProfile(null); setDraft(empty); setAppointments([]); setNotifications([]);setReminders(null);setMoving(null); clear(); }}>Đăng xuất</button></>}</section>}
      {view==='account'&&<section className="public-section booking-panel" id="portal"><h2>Lịch khám của tôi</h2>{!clinic || !profile ? <p>Đăng nhập để xem, đổi hoặc hủy lịch khám của bạn.</p> : <><button className="button-secondary" disabled={busy} onClick={() => void run(reload)}>Tải lại lịch</button>{appointmentsLoaded&&appointments.length===0&&<p role="status">Bạn chưa có lịch khám tại phòng khám.</p>}{appointments.map(a => <article className="booking-appointment" key={a.id}><h3>{a.appointmentCode}</h3><p>{when(a.startsAt)} · {money(a.price.amountVnd)} · {a.status}</p>{a.status === 'CONFIRMED' && <><button className="button-secondary" disabled={busy} onClick={() => { setMoving(a);setFollowUp(null); clear();navigate('/public/booking'); }}>Đổi giờ khám</button><button className="button-secondary" disabled={busy} onClick={() => void run(async () => { await api.cancelAppointment(token, a, profile.patientId); await reload(); setMessage('Đã hủy lịch.'); })}>Hủy lịch</button></>}</article>)}</>}</section>}
      {view!=='home'&&clinic && profile && <section className="public-section booking-panel"><h2>Giờ khám đang giữ</h2><p>Sau khi tải lại trang, đăng nhập để tiếp tục giờ còn đang giữ. Kiểm tra lịch của bạn trước nếu chưa rõ kết quả xác nhận.</p><button className="button-secondary" disabled={busy} onClick={() => void run(async () => setPendingHolds(await api.getPendingHolds(token,clinic.clinicId,profile.patientId)))}>Tải giờ đang giữ</button>{pendingHolds.map(p => <p key={p.hold.holdId}><button className="button-secondary" disabled={busy} onClick={() => void run(async () => { navigate('/public/booking');await selectBranch(p.hold.branchId);setDoctor(p.doctorId);setOffering(p.offeringId);setMoving(null);setHold(p.hold);setNow(Date.now());keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:profile.patientId,holdId:p.hold.holdId}); })}>Tiếp tục {when(p.startsAt)} · {money(p.hold.price.amountVnd)}</button></p>)}</section>}
      {view==='account'&&token && <section className="public-section booking-panel"><h2>Thông báo của tôi</h2><button className="button-secondary" disabled={busy} onClick={() => void run(async () => { const [list, preference] = await Promise.all([api.getNotifications(token), api.getReminderPreference(token)]); setNotifications(list); setReminders(preference.remindersEnabled); })}>Tải thông báo và lựa chọn nhắc lịch</button>{reminders !== null && <p><label><input type="checkbox" disabled={busy} checked={reminders} onChange={e => { const enabled=e.target.checked; void run(async () => setReminders((await api.setReminderPreference(token,enabled)).remindersEnabled)); }} /> Nhận nhắc lịch trong ứng dụng</label></p>}{notifications.map(n => <p key={n.id}>{n.message} · {when(n.created_at)}</p>)}</section>}
      {view==='booking'&&followUp && <p className="booking-feedback" role="status">Đang tạo lịch tái khám mới theo ngày đề xuất {followUp.proposedDate}. Chọn bác sĩ, dịch vụ và giờ còn trống.</p>}
      {view==='account'&&profile && token && <PatientHistoryPanel token={token} patientId={profile.patientId} onFollowUp={async plan=>{await selectClinic(plan.clinicId);setFollowUp(plan);setDate(plan.proposedDate);navigate('/public/booking');}} />}
    </main><footer className="public-footer"><span>{clinic?.name??'Phòng khám'}</span><nav aria-label="Liên kết cuối trang"><a href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}>Trang chủ</a><a href="/workspace" onClick={e=>{e.preventDefault();navigate(shared?.session?workspaceUrl(shared.session):'/workspace');}}>Workspace phòng khám</a><a href="/platform" onClick={e=>{e.preventDefault();navigate('/platform');}}>Platform</a></nav></footer>
  </div>;
}

