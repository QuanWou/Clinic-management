import {useAuthoritativeSync} from '../components/useAuthoritativeSync';
import {appointmentSubscription,notificationSubscription} from '../api/realtime';
import {NotificationInbox} from '../components/NotificationInbox';
import {ConfirmDialog} from '../components/ConfirmDialog';
import {DatePreview} from '../components/DatePreview';
import {dateLabel,stateName} from '../utils/display';
import {useNavigationLock} from '../components/useNavigationLock';
import {usePanelSession,useLocation,navigateLocal} from '../auth/SessionProvider';
import {SourceSessionState} from '../auth/SourceSessionState';
import {PatientAuthPanel} from '../auth/LoginPage';
import {loginUrl} from '../auth/returnTo';
import {clearBookingReturnState,readBookingReturnState,saveBookingReturnState} from '../auth/bookingReturn';
import { lazy, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Clock3, MapPin, Phone, RefreshCw, Search, Stethoscope, UserRound } from 'lucide-react';
import type { UiState } from '../types/contracts';
import { UiStatePanel } from '../components/UiStatePanel';
import * as api from '../api/booking';
import { requestJson } from '../api/client';
import { stableOperationKey, forgetOperationKey } from '../api/idempotency';
import {PublicHomeV2,PublicInfoPage,type PublicInfoView} from '../components/PublicWebV2';
import {AsyncPanel} from '../components/AsyncPanel';
const PatientHistoryPanel=lazy(()=>import('../components/PatientHistoryPanel').then(m=>({default:m.PatientHistoryPanel})));
import type { FollowUpPlan } from '../api/portal';

const empty: api.ProfileInput = { fullName: '', dateOfBirth: '', sex: '', phone: '', email: '', expectedVersion: 0 };
const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
const when = (s: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(s));
const slotTime = (s:string) => new Intl.DateTimeFormat('vi-VN',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(s));
const slotDate = (s:string) => new Intl.DateTimeFormat('vi-VN',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(s));
const slotPeriod = (s:string) => {
  const hour=Number(new Intl.DateTimeFormat('en-US',{hour:'2-digit',hourCycle:'h23',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(s)));
  return hour<12?'morning':hour<17?'afternoon':'evening';
};
const localDate = (value:string) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); };
const bookingDateLabel=(value:string)=>new Intl.DateTimeFormat('vi-VN',{weekday:'long',day:'2-digit',month:'2-digit',year:'numeric',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value+'T12:00:00+07:00'));
const weekdayLabel=(day:number)=>['','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy','Chủ Nhật'][day]??'';

export function PublicShell({ state,background=false,onSiteName }: { state: UiState;background?:boolean;onSiteName?:(name:string)=>void }) {
  const appRef=useRef<HTMLDivElement>(null);
  const shared=usePanelSession(()=>run(login));
  const location=useLocation();
  const pathname=location.split('?')[0];
  const infoMatch=pathname.match(/^\/(chuyen-khoa|bac-si|dich-vu)\/([^/?#]+)$/);
  const infoView:PublicInfoView|null=pathname==='/gioi-thieu'?'about':pathname==='/chuyen-khoa'?'specialties':infoMatch?.[1]==='chuyen-khoa'?'specialty':pathname==='/bac-si'?'doctors':infoMatch?.[1]==='bac-si'?'doctor':pathname==='/dich-vu'?'services':infoMatch?.[1]==='dich-vu'?'service':pathname==='/lien-he'?'contact':null;
  const infoSlug=infoMatch?.[2]??'';
  const isBooking=pathname==='/public/booking'||pathname==='/dat-lich';
  const isAccount=pathname==='/public/account'||pathname.startsWith('/tai-khoan');
  const isAuth=pathname==='/public/login'||pathname==='/public/register';
  const view=isBooking?'booking':isAccount?'account':isAuth?'auth':infoView?'info':'home';
  const navigate=shared?.navigate??navigateLocal;
  const previousView=useRef(view);
  useEffect(()=>{if(previousView.current!==view){previousView.current=view;window.scrollTo(0,0);if(!background)document.getElementById('main-content')?.focus();}},[view,background]);
  const [siteLoading,setSiteLoading]=useState(state==='ready');
  const [siteError,setSiteError]=useState('');
  const [siteAttempt,setSiteAttempt]=useState(0);
  const siteClinicId=useRef<string|null>(null);
  const [clinic, setClinic] = useState<api.Clinic | null>(null);
  useEffect(()=>{if(clinic?.name)onSiteName?.(clinic.name);},[clinic?.name,onSiteName]);
  useEffect(()=>{if(!background)document.title=(view==='booking'?'Đặt lịch khám | ':view==='account'?'Tài khoản bệnh nhân | ':view==='auth'?(pathname==='/public/register'?'Tạo tài khoản | ':'Đăng nhập | '):'')+(clinic?.name??'Phòng khám');},[view,pathname,clinic?.name,background]);
  const [branch, setBranch] = useState('');
  const [doctors, setDoctors] = useState<api.Doctor[]>([]);
  const [offerings, setOfferings] = useState<api.Offering[]>([]);
  const [publicContent,setPublicContent]=useState<api.PublicWebContent|null>(null);
  const [bookingOptions,setBookingOptions]=useState<api.BookingOptions|null>(null);
  const [bookingOptionsError,setBookingOptionsError]=useState('');
  const [specialty,setSpecialty]=useState('');
  const [doctorMode,setDoctorMode]=useState<'recommended'|'specific'>('recommended');
  const [doctor, setDoctor] = useState('');
  const [offering, setOffering] = useState('');
  const [date, setDate] = useState(tomorrow);
  const [slots, setSlots] = useState<api.Slot[] | null>(null);
  const [slotState,setSlotState]=useState<'idle'|'loading'|'success'|'empty'|'error'>('idle');
  const [slotError,setSlotError]=useState('');
  const [slotReason,setSlotReason]=useState<api.AvailabilityReason|null>(null);
  const [slotReasonDoctor,setSlotReasonDoctor]=useState('');
  const [selectedSlot,setSelectedSlot]=useState<api.Slot|null>(null);
  const [heldDetails,setHeldDetails]=useState<Omit<api.PendingHold,'hold'>|null>(null);
  const [hold, setHold] = useState<api.Hold | null>(null);
  const [token, setToken] = useState('');
  const [profile, setProfile] = useState<api.Profile | null>(null);
  const [draft, setDraft] = useState(empty);
  const bookingRestore=useRef(isBooking?readBookingReturnState():null);
  const bookingAuthRedirect=useRef(false);
  const [bookingSuccess,setBookingSuccess]=useState<{appointment:api.Appointment;doctorId:string;offeringId:string;branchId:string;specialty:string}|null>(null);
  const [accountTab,setAccountTab]=useState(()=>{const query=new URLSearchParams(location.split('?')[1]??'');return pathname.endsWith('/hoa-don')?'fees':pathname.endsWith('/ho-so')?'history':pathname.endsWith('/thong-tin')?'profile':query.get('tab')==='notifications'?'notifications':query.get('tab')==='history'?'history':'appointments';}),[canceling,setCanceling]=useState<api.Appointment|null>(null);
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
  useEffect(()=>{
    const root=appRef.current;
    if(!root||background||siteLoading)return;
    root.classList.remove('motion-page-ready');
    const reduced=typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cancelReady=()=>{};
    if(typeof window.requestAnimationFrame==='function'){
      const frame=window.requestAnimationFrame(()=>root.classList.add('motion-page-ready'));
      cancelReady=()=>window.cancelAnimationFrame(frame);
    }else{
      const timer=window.setTimeout(()=>root.classList.add('motion-page-ready'),0);
      cancelReady=()=>window.clearTimeout(timer);
    }
    const targets=Array.from(root.querySelectorAll<HTMLElement>([
      '.fresh-clinic-home > .fresh-band',
      '.fresh-clinic-home > .fresh-container.fresh-section',
      '.fresh-clinic-home > .fresh-services-section',
      '.fresh-clinic-home > .fresh-trust-section',
      '.fresh-clinic-home > .fresh-final-cta',
      '.fresh-info-page .fresh-page-body > *',
      '.public-booking-page > .booking-panel',
      '.public-booking-page > .booking-recovery',
      '.public-account-page > .booking-panel',
    ].join(',')));
    targets.forEach(target=>target.classList.add('motion-reveal'));
    if(reduced||typeof window.IntersectionObserver!=='function'){
      targets.forEach(target=>target.classList.add('is-revealed'));
      return cancelReady;
    }
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        (entry.target as HTMLElement).classList.add('is-revealed');
        observer.unobserve(entry.target);
      });
    },{threshold:.12,rootMargin:'0px 0px -7% 0px'});
    targets.forEach(target=>observer.observe(target));
    return()=>{cancelReady();observer.disconnect();};
  },[view,siteLoading,background]);
  useEffect(()=>{if(view!=='account')return;const next=pathname.endsWith('/hoa-don')?'fees':pathname.endsWith('/ho-so')?'history':pathname.endsWith('/thong-tin')?'profile':new URLSearchParams(location.split('?')[1]??'').get('tab')==='notifications'?'notifications':'appointments';setAccountTab(next);},[pathname,location,view]);
  const profileDirty=!!token&&(profile?['fullName','dateOfBirth','sex','phone','email'].some(key=>String(draft[key as keyof api.ProfileInput]??'')!==String(profile[key as keyof api.Profile]??'')):!!draft.dateOfBirth||!!draft.phone);
  useNavigationLock(background?null:busy?'Đợi thao tác hoàn tất trước khi chuyển trang.':canceling?'Xem lại hoặc bỏ yêu cầu hủy lịch trước khi chuyển trang.':profileDirty?'Lưu hoặc bỏ thay đổi hồ sơ trước khi chuyển trang.':null);
  const [nextView,setNextView]=useState<string|null>(null);
  useEffect(()=>{if(nextView&&!busy&&!profileDirty&&!canceling){navigate(nextView);setNextView(null);}},[nextView,busy,profileDirty,canceling,navigate]);
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
        const [d,o,content]=await Promise.all([api.getDoctors(c.clinicId,b||undefined),api.getOfferings(c.clinicId,b||undefined),api.getPublicContent(c.clinicId)]);
        if(!mounted)return;
        setDoctors(d);setOfferings(o);setPublicContent(content);
      }catch(e){if(mounted)setSiteError(e instanceof Error?e.message:'Chưa tải được thông tin phòng khám. Vui lòng thử lại.');}
      finally{if(mounted)setSiteLoading(false);}
    })();
    return()=>{mounted=false;};
  },[state,siteAttempt]);
  useEffect(()=>{
    if(view!=='booking'||!clinic||!branch){setBookingOptions(null);setBookingOptionsError('');return;}
    let active=true;setBookingOptions(null);setBookingOptionsError('');
    void api.getBookingOptions(clinic.clinicId,branch).then(value=>{if(active)setBookingOptions(value);}).catch(()=>{if(active)setBookingOptionsError('Không thể tải danh sách bác sĩ và dịch vụ có thể đặt lịch. Vui lòng thử lại.');});
    return()=>{active=false;};
  },[view,clinic?.clinicId,branch,siteAttempt]);
  useEffect(()=>{
    if(!bookingOptions||hold)return;
    const specialtyOption=bookingOptions.specialties.find(item=>item.name===specialty);
    if(specialty&&!specialtyOption){setSpecialty('');setDoctor('');setOffering('');setDoctorMode('recommended');clear();return;}
    if(doctor&&!bookingOptions.doctors.some(item=>item.doctorId===doctor&&(!specialtyOption||item.specialtyCode===specialtyOption.code))){setDoctor('');setDoctorMode('recommended');clear();}
    if(offering&&!bookingOptions.offerings.some(item=>item.offeringId===offering&&(!specialtyOption||item.specialtyCode===specialtyOption.code))){setOffering('');clear();}
  },[bookingOptions]);
  useEffect(()=>{
    if(view!=='booking'){bookingAuthRedirect.current=false;return;}
    if(bookingAuthRedirect.current)return;
    const saved=bookingRestore.current??(view==='booking'?readBookingReturnState():null);
    if(!saved||!clinic||!branch||!bookingOptions)return;
    if(shared?.patientSession&&!token)return;
    if(saved.branch&&saved.branch!==branch){
      if(clinic.branches.some(item=>item.branchId===saved.branch)){setBranch(saved.branch);return;}
      bookingRestore.current=null;clearBookingReturnState();setMessage('Cơ sở đã chọn trước đó không còn khả dụng. Vui lòng chọn lại lịch khám.');return;
    }
    bookingRestore.current=null;
    const specialtyOption=bookingOptions.specialties.find(item=>saved.specialtyCode?item.code===saved.specialtyCode:item.name===saved.specialty);
    const offeringOption=bookingOptions.offerings.find(item=>item.offeringId===saved.offering&&(!specialtyOption||item.specialtyCode===specialtyOption.code));
    const specificDoctor=saved.doctorMode==='specific'?bookingOptions.doctors.find(item=>item.doctorId===saved.doctor&&(!specialtyOption||item.specialtyCode===specialtyOption.code)):null;
    if(!specialtyOption||!offeringOption||(saved.doctorMode==='specific'&&!specificDoctor)){
      clearBookingReturnState();setMessage('Thông tin đặt lịch trước đó đã thay đổi. Vui lòng chọn lại bác sĩ hoặc dịch vụ.');return;
    }
    setSpecialty(specialtyOption.name);setOffering(saved.offering);setDoctorMode(saved.doctorMode);setDoctor(saved.doctor);setDate(saved.date);setSlotState('loading');setSlotError('');
    void (async()=>{
      try{
        if(token&&profile){
          const pending=await api.getPendingHolds(token,clinic.clinicId,profile.patientId).catch(()=>[]);
          const existing=pending.find(item=>item.hold.state==='ACTIVE'&&Date.parse(item.hold.expiresAt)>Date.now()&&item.hold.branchId===branch&&item.offeringId===saved.slotOfferingId&&item.doctorId===saved.slotDoctorId&&(!saved.slotStartsAt||item.startsAt===saved.slotStartsAt));
          if(existing){
            const restored:{slotId:string;startsAt:string;endsAt:string;remaining:number;price:api.Price;doctorId:string;offeringId:string}={slotId:saved.slotId,startsAt:existing.startsAt,endsAt:existing.endsAt,remaining:0,price:existing.hold.price,doctorId:existing.doctorId,offeringId:existing.offeringId};
            setSlots([restored]);setSelectedSlot(restored);setHold(existing.hold);setHeldDetails({doctorId:existing.doctorId,offeringId:existing.offeringId,startsAt:existing.startsAt,endsAt:existing.endsAt});setNow(Date.now());setSlotReason('AVAILABLE');setSlotState('success');setMessage('Đã khôi phục giờ khám đang được giữ và tiếp tục xác nhận.');return;
          }
        }
        const candidates=saved.doctorMode==='specific'?[specificDoctor!]:bookingOptions.doctors.filter(item=>item.specialtyCode===specialtyOption.code);
        const results=await Promise.allSettled(candidates.map(item=>api.getAvailabilityResult({clinicId:clinic.clinicId,branchId:branch,offeringId:saved.offering,doctorId:item.doctorId,date:saved.date})));
        const fulfilled=results.filter((item):item is PromiseFulfilledResult<api.AvailabilityResult>=>item.status==='fulfilled').map(item=>item.value);
        if(!fulfilled.length)throw new Error('Không thể kiểm tra lại lịch đã chọn.');
        const available=[...new Map(fulfilled.flatMap(result=>result.slots.map(slot=>({...slot,doctorId:slot.doctorId??result.doctorId,offeringId:slot.offeringId??saved.offering}))).map(slot=>[slot.slotId,slot])).values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
        setSlots(available);
        const restored=available.find(slot=>slot.slotId===saved.slotId)||(saved.slotStartsAt?available.find(slot=>slot.startsAt===saved.slotStartsAt&&(!saved.slotDoctorId||slot.doctorId===saved.slotDoctorId)):undefined);
        if(restored){
          setSelectedSlot(restored);setSlotReason('AVAILABLE');setSlotState('success');
          if(token&&profile){
            try{await reserve(restored);setMessage('Đã kiểm tra lại khung giờ và chuyển sang xác nhận lịch.');}
            catch{setSelectedSlot(null);setHold(null);setHeldDetails(null);setMessage('Khung giờ bạn đã chọn vừa không còn khả dụng. Vui lòng chọn khung giờ khác.');}
          }else if(token&&!profile)setMessage('Khung giờ vẫn còn khả dụng. Vui lòng bổ sung thông tin bắt buộc trước khi xác nhận lịch.');
          else setMessage('Đã khôi phục lựa chọn đặt lịch và kiểm tra lại khung giờ còn trống.');
        }
        else{setSelectedSlot(null);setSlotState(available.length?'success':'empty');setSlotReason(available.length?'AVAILABLE':'FULLY_BOOKED');setMessage('Khung giờ bạn đã chọn vừa không còn khả dụng. Vui lòng chọn khung giờ khác.');}
      }catch{setSelectedSlot(null);setSlots(null);setSlotReason('ERROR');setSlotState('error');setSlotError('Không thể kiểm tra lại khung giờ đã chọn. Vui lòng tìm lịch lại.');}
      finally{clearBookingReturnState();}
    })();
  },[view,clinic?.clinicId,branch,bookingOptions,shared?.patientSession?.token,token,profile?.patientId]);
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
    try { await action(); } catch (e) {
      if(e instanceof api.RequestError&&e.status===401&&view==='booking'&&selectedSlot){
        persistBookingReturn();
        bookingAuthRedirect.current=true;
        shared?.signOutPatient();setToken('');setProfile(null);
        setNextView(loginUrl('patient','/dat-lich'));return;
      }
      setError(e instanceof Error ? e.message : 'Không thể hoàn tất. Hãy thử lại.');
    }
    finally { running.current = false; setBusy(false); }
  }
  function clear() { setSelectedSlot(null); setHeldDetails(null); setSlots(null); setSlotState('idle');setSlotError('');setSlotReason(null);setSlotReasonDoctor('');setHold(null);setBookingSuccess(null); setPendingHolds([]); keys.current = { payload: '', hold: '', confirm: '' }; }
  async function selectClinic(id: string) {
    if(!siteClinicId.current||id!==siteClinicId.current)throw new Error('Lịch tái khám này thuộc phòng khám khác. Vui lòng liên hệ phòng khám đã khám để đặt lịch.');
    const c=await api.getSiteClinic(id);
    const b=c.branches.length===1?c.branches[0].branchId:'';
    const [d,o,content]=await Promise.all([api.getDoctors(c.clinicId,b||undefined),api.getOfferings(c.clinicId,b||undefined),api.getPublicContent(c.clinicId)]);
    setClinic(c);setBranch(b);setDoctors(d);setOfferings(o);setPublicContent(content);setBookingOptions(null);setSpecialty('');setDoctorMode('recommended');setDoctor('');setOffering('');setAppointments([]);setMoving(null);setFollowUp(null);clear();
  }
  async function selectBranch(id: string) {
    if (!clinic) return;
    setBranch(id); setSpecialty(''); setDoctorMode('recommended'); setDoctor(''); setOffering(''); setDoctors([]); setOfferings([]); setBookingOptions(null); clear();
    if (!id) return;
    const [d, o] = await Promise.all([api.getDoctors(clinic.clinicId, id), api.getOfferings(clinic.clinicId, id)]);
    setDoctors(d); setOfferings(o);
  }
  async function reload() {
    if (clinic && profile) {setAppointments(await api.myAppointments(token, clinic.clinicId, profile.patientId));setAppointmentsLoaded(true);}
  }
  async function searchAvailability() {
    if(!clinic||!branch||!specialty||!offering||!date){
      setSlotState('error');setSlotError('Vui lòng chọn đầy đủ chuyên khoa, dịch vụ và ngày khám trước khi tìm giờ.');
      return;
    }
    if(doctorMode==='specific'&&!doctor){
      setSlotState('error');setSlotError('Vui lòng chọn bác sĩ cụ thể hoặc chuyển sang “Bác sĩ phù hợp”.');
      return;
    }
    clear();
    setSlotState('loading');
    try{
      let found:api.Slot[]=[];
      let emptyReason:api.AvailabilityReason='NO_ELIGIBLE_DOCTOR';
      let reasonDoctor='';
      if(doctorMode==='specific'){
        const result=await api.getAvailabilityResult({clinicId:clinic.clinicId,branchId:branch,offeringId:offering,doctorId:doctor,date});
        found=result.slots.map(slot=>({...slot,doctorId:slot.doctorId??doctor,offeringId:slot.offeringId??offering}));
        emptyReason=result.reason;reasonDoctor=result.doctorName??bookingDoctors.find(item=>item.doctorId===doctor)?.displayName??'';
      }else{
        if(!bookingDoctors.length){setSlotReason('NO_ELIGIBLE_DOCTOR');setSlotState('empty');setSlots([]);return;}
        const results=await Promise.allSettled(bookingDoctors.map(item=>api.getAvailabilityResult({clinicId:clinic.clinicId,branchId:branch,offeringId:offering,doctorId:item.doctorId,date})));
        const fulfilled=results.filter((result):result is PromiseFulfilledResult<api.AvailabilityResult>=>result.status==='fulfilled').map(result=>result.value);
        if(!fulfilled.length){
          const failure=results.find(result=>result.status==='rejected');
          throw failure&&failure.status==='rejected'&&failure.reason instanceof Error?failure.reason:new Error('Không thể tải khung giờ. Vui lòng thử lại.');
        }
        found=fulfilled.flatMap(result=>result.slots.map(slot=>({...slot,doctorId:slot.doctorId??result.doctorId,offeringId:slot.offeringId??offering})));
        if(!found.length){
          if(fulfilled.length===1){emptyReason=fulfilled[0].reason;reasonDoctor=fulfilled[0].doctorName??'';}
          else if(fulfilled.every(result=>result.reason==='FULLY_BOOKED'))emptyReason='FULLY_BOOKED';
          else if(fulfilled.every(result=>result.reason==='SERVICE_NOT_SUPPORTED'))emptyReason='SERVICE_NOT_SUPPORTED';
          else emptyReason='NO_ELIGIBLE_DOCTOR';
        }
      }
      const unique=[...new Map(found.map(slot=>[slot.slotId,slot])).values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
      setSlots(unique);
      if(unique.length){setSlotReason('AVAILABLE');setSlotState('success');}
      else{setSlotReason(emptyReason);setSlotReasonDoctor(reasonDoctor);setSlotState('empty');}
    }catch(e){
      setSlots(null);setSlotReason('ERROR');setSlotState('error');setSlotError('Không thể tải lịch khám lúc này. Vui lòng thử lại.');
    }
  }
  async function login() {
    const patient=shared?.patientSession;
    if(!patient)return;
    const accessToken=patient.token;
    setToken(accessToken);setFollowUp(null);setNotifications([]);setReminders(null);setHeldDetails(null);setHold(null);setPendingHolds([]);
    const result = await requestJson<api.Profile>((import.meta.env.VITE_PATIENT_URL ?? '/s1/patient') + '/api/me/patient-profile', { headers: { Authorization: 'Bearer ' + accessToken } });
    if (result.ok && result.data) { setProfile(result.data); setDraft({ ...result.data, expectedVersion: result.data.version }); }
    else if (result.status === 404) { setProfile(null); setDraft({ ...empty, fullName: patient.displayName??'', email:patient.email }); }
    else throw new Error(result.message);
    setMessage('');
  }
  function persistBookingReturn(){
    if(view!=='booking'||!selectedSlot)return;
    const specialtyCode=bookingOptions?.specialties.find(item=>item.name===specialty)?.code;
    saveBookingReturnState({branch,specialty,specialtyCode,offering,doctorMode,doctor,date,slotId:selectedSlot.slotId,slotDoctorId:selectedSlot.doctorId??'',slotOfferingId:selectedSlot.offeringId??offering,slotStartsAt:selectedSlot.startsAt});
  }
  function beginPatientLogin(){
    persistBookingReturn();
    navigate(loginUrl('patient',view==='booking'?'/dat-lich':pathname+window.location.search));
  }
  function beginPatientRegistration(){
    persistBookingReturn();
    const returnTo=view==='booking'?'/dat-lich':pathname+window.location.search;
    navigate('/public/register?'+new URLSearchParams({returnTo}));
  }
  function logoutPatient(){
    shared?.signOutPatient();setToken('');setFollowUp(null);setProfile(null);setDraft(empty);setAppointments([]);setNotifications([]);setReminders(null);setMoving(null);clear();
  }
  async function reserve(s: api.Slot, bookingProfile:api.Profile|null=profile) {
    if (!clinic || !token || !bookingProfile) throw new Error('Bạn cần đăng nhập và hoàn thiện hồ sơ bệnh nhân trước khi giữ giờ khám.');
    const slotDoctorId=s.doctorId??doctor;
    if(!slotDoctorId)throw new Error('Chưa xác định được bác sĩ cho khung giờ đã chọn. Vui lòng tìm lại lịch.');
    const input = { clinicId: clinic.clinicId, branchId: branch, doctorId: slotDoctorId, offeringId: s.offeringId??offering, slotId: s.slotId, patientId: bookingProfile.patientId, ...(followUp ? {priorEncounterId:followUp.encounterId,priorBranchId:followUp.branchId} : {}) };
    const operation = {...input, ...(moving?{rescheduleAppointmentId:moving.id}:{})};
    const payload = JSON.stringify(operation);
    if (keys.current.payload !== payload) keys.current = { payload, hold: await stableOperationKey('hold',operation), confirm: '' };
    const held=moving ? await api.holdReschedule(token,moving.id,input,keys.current.hold) : followUp ? await api.holdFollowUp(token,{...input,priorEncounterId:followUp.encounterId,priorBranchId:followUp.branchId},keys.current.hold) : await api.holdSlot(token,input,keys.current.hold);
    if (held.state !== 'ACTIVE') { await reload(); throw new Error('Lượt giữ giờ đã được xử lý. Kiểm tra lịch của bạn trước khi đặt tiếp.'); }
    if (Date.parse(held.expiresAt) <= Date.now()) { await forgetOperationKey('hold', input); keys.current.payload = ''; }
    keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:bookingProfile.patientId,holdId:held.holdId});
    setHold(held);setHeldDetails({doctorId:slotDoctorId,offeringId:s.offeringId??offering,startsAt:s.startsAt,endsAt:s.endsAt});setNow(Date.now());
  }
  async function confirm() {
    if (!clinic || !profile || !hold) return;
    if(!keys.current.confirm)keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:profile.patientId,holdId:hold.holdId});
    const changing=hold.purpose==='RESCHEDULE';
    if(changing&&!hold.rescheduleAppointmentId)throw new Error('Chưa xác định được lịch cần đổi. Tải lại giờ đang giữ.');
    const a = changing ? await api.rescheduleAppointment(token, {id:hold.rescheduleAppointmentId!,clinicId:clinic.clinicId}, profile.patientId, hold.holdId) : await api.confirmHold(token, clinic.clinicId, profile.patientId, hold.holdId, keys.current.confirm);
    if(changing)setMessage('Đã đổi lịch: '+a.appointmentCode+' · '+when(a.startsAt));
    else setBookingSuccess({appointment:a,doctorId:heldDetails?.doctorId??selectedSlotDoctorId,offeringId:heldDetails?.offeringId??offering,branchId:branch,specialty});
    setHold(null); setMoving(null);setFollowUp(null); setSlots(null); await reload();
  }
  function openAccount(){navigate('/tai-khoan/lich-kham');}
  function openBooking(d?:api.Doctor,o?:api.Offering){
    navigate('/dat-lich');
    if(d||o)void run(async()=>{const chosenBranch=d?.branchId??o?.branchId;if(chosenBranch&&chosenBranch!==branch)await selectBranch(chosenBranch);if(d){setSpecialty(d.specialtyName??'');setDoctorMode('specific');setDoctor(d.doctorId);}if(o){const serviceProfile=publicContent?.services.find(item=>item.offeringId===o.offeringId);if(serviceProfile)setSpecialty(serviceProfile.specialtyName);setOffering(o.offeringId);}clear();});
  }
  const remaining = hold ? Math.max(0, Math.ceil((Date.parse(hold.expiresAt) - now) / 1000)) : 0;
  const bookingSpecialties=(bookingOptions?.specialties??[]).map(item=>item.name);
  const navSpecialties=publicContent?.specialties?.length?publicContent.specialties.map(item=>item.displayName):[...new Set(doctors.map(d=>d.specialtyName).filter((value):value is string=>!!value))];
  const selectedSpecialty=bookingOptions?.specialties.find(item=>item.name===specialty);
  const bookingDoctors=selectedSpecialty?bookingOptions?.doctors.filter(item=>item.specialtyCode===selectedSpecialty.code)??[]:[];
  const bookingOfferings=selectedSpecialty?bookingOptions?.offerings.filter(item=>item.specialtyCode===selectedSpecialty.code)??[]:[];
  useAuthoritativeSync({key:(clinic?.clinicId??'')+branch+pathname,enabled:state!=='loading',initial:true,blocked:busy||siteLoading||profileDirty,refresh:async context=>{
   try{const c=await api.getSiteClinic();const [d,o,content]=await Promise.all([api.getDoctors(c.clinicId,branch||undefined),api.getOfferings(c.clinicId,branch||undefined),api.getPublicContent(c.clinicId)]);if(context.current()){setClinic(c);setDoctors(d);setOfferings(o);setPublicContent(content);setSiteError('');}}catch(e){if(context.current())setSiteError('Chưa cập nhật được thông tin phòng khám. Hệ thống sẽ thử lại.');throw e;}
  }});
  useAuthoritativeSync({key:(clinic?.clinicId??'')+branch+view,enabled:view==='booking'&&!!clinic&&!!branch,blocked:busy||profileDirty,intervalMs:30000,refresh:async context=>{
   try{const options=await api.getBookingOptions(clinic!.clinicId,branch);if(context.current()){setBookingOptions(options);setBookingOptionsError('');}}
   catch(e){if(context.current()){setBookingOptions(null);setBookingOptionsError('Thông tin đặt khám cần được kiểm tra lại. Hệ thống sẽ thử lại.');}throw e;}
  }});
  useAuthoritativeSync({key:[clinic?.clinicId,branch,specialty,doctorMode,doctor,offering,date].join(':'),enabled:view==='booking'&&!!clinic&&!!branch&&!!offering&&slots!==null&&!hold,blocked:busy||slotState==='loading',intervalMs:15000,refresh:async context=>{
   const candidates=doctorMode==='specific'?bookingDoctors.filter(item=>item.doctorId===doctor):bookingDoctors;
   const results=await Promise.all(candidates.map(item=>api.getAvailabilityResult({clinicId:clinic!.clinicId,branchId:branch,offeringId:offering,doctorId:item.doctorId,date})));
   if(!context.current())return;
   const updated=[...new Map(results.flatMap(result=>result.slots.map(slot=>({...slot,doctorId:slot.doctorId??result.doctorId,offeringId:slot.offeringId??offering}))).map(slot=>[slot.slotId,slot])).values()].sort((a,b)=>a.startsAt.localeCompare(b.startsAt));
   setSlots(updated);setSlotState(updated.length?'success':'empty');setSlotReason(updated.length?'AVAILABLE':results[0]?.reason??'NO_ELIGIBLE_DOCTOR');
   if(selectedSlot){const next=updated.find(slot=>slot.slotId===selectedSlot.slotId&&slot.remaining>0);setSelectedSlot(next??null);if(!next)setMessage('Khung giờ vừa thay đổi. Vui lòng chọn giờ còn trống.');}
  }});
  useAuthoritativeSync({key:token+(clinic?.clinicId??'')+(profile?.patientId??''),enabled:!!token&&!!clinic&&!!profile,blocked:busy||!!canceling,subscriptions:[appointmentSubscription(token,clinic?.clinicId??'',profile?.patientId??'')],refresh:async context=>{
   const rows=await api.myAppointments(token,clinic!.clinicId,profile!.patientId);if(context.current()){setAppointments(rows);setAppointmentsLoaded(true);}
  },onDenied:()=>{setAppointments([]);setAppointmentsLoaded(false);}});
  useAuthoritativeSync({key:token,enabled:!!token,subscriptions:[notificationSubscription(token)],blocked:busy,refresh:async context=>{const rows=await api.getNotifications(token);if(context.current()&&Array.isArray(rows))setNotifications(rows);},onDenied:()=>setNotifications([])});
  const bookingInfoReady=Boolean(branch&&specialty&&offering&&date&&(doctorMode==='recommended'?bookingDoctors.length:doctor));
  const selectedSlotDoctorId=selectedSlot?.doctorId??doctor;
  const selectedSlotDoctor=bookingOptions?.doctors.find(item=>item.doctorId===selectedSlotDoctorId);
  const selectedOffering=bookingOptions?.offerings.find(item=>item.offeringId===offering);
  const specificDoctor=bookingOptions?.doctors.find(item=>item.doctorId===doctor);
  const workingDays=specificDoctor?[...new Set(specificDoctor.schedules.map(item=>item.dayOfWeek))].sort((a,b)=>a-b).map(weekdayLabel).join(', '):'';
  const emptyMessage=slotReason==='DOCTOR_NOT_WORKING'?`Bác sĩ ${slotReasonDoctor||specificDoctor?.displayName||'đã chọn'} không có lịch làm việc vào ${bookingDateLabel(date)}.`:slotReason==='FULLY_BOOKED'?'Các khung giờ khám của bác sĩ trong ngày đã được đặt hết.':slotReason==='NO_CAPACITY_CONFIGURED'?'Lịch khám của bác sĩ chưa được cấu hình cho ngày này.':slotReason==='DOCTOR_UNAVAILABLE'?'Bác sĩ hiện không thể nhận lịch trong ngày đã chọn.':slotReason==='SERVICE_NOT_SUPPORTED'?'Dịch vụ đã chọn không được bác sĩ này thực hiện.':slotReason==='INVALID_SPECIALTY'?'Chuyên khoa đã chọn không còn khả dụng để đặt lịch.':'Chưa có bác sĩ phù hợp với chuyên khoa và ngày khám đã chọn.';
  const slotGroups=(slots??[]).reduce<Record<'morning'|'afternoon'|'evening',api.Slot[]>>((groups,slot)=>{groups[slotPeriod(slot.startsAt)].push(slot);return groups;},{morning:[],afternoon:[],evening:[]});
  const primaryHours=clinic?.branches.find(b=>b.openingHours)?.openingHours;
  const primaryAddress=clinic?.branches.find(b=>b.address)?.address;
  const hidePublicPrices=Boolean(publicContent?.services?.length);
  return <div className="public-app" ref={appRef}>
    <div className="public-utility">
      <div>{primaryAddress&&<span><MapPin size={13}/>{primaryAddress}</span>}{!primaryAddress&&<span>Cổng thông tin chính thức của phòng khám</span>}</div>
      <nav aria-label="Thông tin liên hệ">{clinic?.phone&&<a href={'tel:'+clinic.phone.replace(/[^0-9+]/g,'')}><Phone size={13}/>Hotline: {clinic.phone}</a>}{primaryHours&&<span><Clock3 size={13}/>{primaryHours}</span>}</nav>
    </div>
    <header className="public-header">
      <a className="brand public-brand" href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}><span className="brand-mark"><Stethoscope size={22} /></span><span><strong>{clinic?.name??'Phòng khám'}</strong><small>Chăm sóc sức khỏe ngoại trú</small></span></a>
      <nav className="public-nav" aria-label="Điều hướng công khai">
        <a href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}>Trang chủ</a>
        <details className="public-nav-dropdown" onMouseEnter={e=>{e.currentTarget.open=true;}} onMouseLeave={e=>{e.currentTarget.open=false;}}><summary>Phòng khám <ChevronDown size={14}/></summary><div><a href="/gioi-thieu" onClick={e=>{e.preventDefault();navigate('/gioi-thieu');}}>Giới thiệu</a><a href="/public#bac-si" onClick={e=>{e.preventDefault();navigate('/bac-si');}}>Đội ngũ</a><a href="/public#co-so" onClick={e=>{e.preventDefault();navigate('/public#co-so');}}>Cơ sở vật chất</a><a href="/public#quy-trinh" onClick={e=>{e.preventDefault();navigate('/public#quy-trinh');}}>Quy trình khám</a><a href="/lien-he" onClick={e=>{e.preventDefault();navigate('/lien-he');}}>Liên hệ & địa chỉ</a></div></details>
        <details className="public-nav-dropdown public-specialty-menu" onMouseEnter={e=>{e.currentTarget.open=true;}} onMouseLeave={e=>{e.currentTarget.open=false;}}><summary>Chuyên khoa <ChevronDown size={14}/></summary><div>{navSpecialties.slice(0,8).map(value=><a key={value} href={'/chuyen-khoa/'+encodeURIComponent(value)} onClick={e=>{e.preventDefault();navigate('/chuyen-khoa/'+value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''));}}>{value}</a>)}<a className="public-dropdown-all" href="/chuyen-khoa" onClick={e=>{e.preventDefault();navigate('/chuyen-khoa');}}>Xem tất cả chuyên khoa <ArrowRight size={14}/></a></div></details>
        <a href="/bac-si" onClick={e=>{e.preventDefault();navigate('/bac-si');}}>Bác sĩ</a>
        <a href="/dich-vu" onClick={e=>{e.preventDefault();navigate('/dich-vu');}}>Dịch vụ</a>
      </nav>
      <div className="public-header-actions">
        <a className="public-icon-link" aria-label="Tìm kiếm" href="/public#tim-kiem" onClick={e=>{e.preventDefault();navigate('/public#tim-kiem');}}><Search size={19}/></a>
        {shared?.patientSession?<details className="public-account-menu"><summary><UserRound size={17}/><span>{shared.patientSession.displayName??shared.patientSession.email}</span><ChevronDown size={14}/></summary><div><a href="/tai-khoan/lich-kham" onClick={e=>{e.preventDefault();openAccount();}}>Lịch khám của tôi</a><a href="/tai-khoan/ho-so" onClick={e=>{e.preventDefault();navigate('/tai-khoan/ho-so');}}>Hồ sơ của tôi</a><a href="/tai-khoan/hoa-don" onClick={e=>{e.preventDefault();navigate('/tai-khoan/hoa-don');}}>Hóa đơn</a><a href="/tai-khoan/thong-tin" onClick={e=>{e.preventDefault();navigate('/tai-khoan/thong-tin');}}>Thông tin cá nhân</a><button type="button" onClick={()=>{logoutPatient();navigate('/public');}}>Đăng xuất</button></div></details>:<a className="public-login-link" aria-label="Tài khoản bệnh nhân" href="/public/login" onClick={e=>{e.preventDefault();navigate('/public/login');}}>Đăng nhập</a>}
        <a className="public-sign-in" href="/dat-lich" onClick={e=>{e.preventDefault();openBooking();}}>Đặt lịch khám <ArrowRight size={16}/></a>
      </div>
    </header>
    <main className={`public-${view}-page${view==='account'?' fresh-container':''}`} tabIndex={-1} id={background?'public-background-content':'main-content'}>
      {view==='booking'&&<section className="public-section public-inner-heading"><a href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}>← Trang chủ</a><span className="eyebrow">{clinic?.name??'Phòng khám'}</span><h1>Đặt lịch khám</h1><p>Chọn thông tin khám và khung giờ trước. Đăng nhập là bước bắt buộc để giữ và xác nhận lịch.</p></section>}
      {view==='account'&&<section className="account-header"><nav className="account-breadcrumb" aria-label="Breadcrumb"><a href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}>Trang chủ</a><span aria-hidden="true">/</span><span>Tài khoản</span></nav><span className="eyebrow">{clinic?.name??'Phòng khám'}</span><h1>Tài khoản bệnh nhân</h1><p>Quản lý lịch khám, hồ sơ, hóa đơn và thông tin cá nhân của bạn.</p></section>}
      <div className="booking-feedback" aria-live="polite">{busy&&<p role="status">Đang xử lý…</p>}{siteLoading&&<p role="status">Đang tải thông tin và lịch khám…</p>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="booking-error">{error}</p>}{siteError&&<div role="alert" className="booking-error"><p>{siteError}</p><button className="button-secondary" disabled={siteLoading} onClick={()=>setSiteAttempt(v=>v+1)}>Tải lại thông tin phòng khám</button></div>}{state!=='ready'&&<UiStatePanel state={state}/>}</div>
      {view==='account'&&token&&profile&&<div className="account-summary"><div><strong>{profile.fullName}</strong><p>Ngày sinh: {dateLabel(profile.dateOfBirth)}</p></div><div className="account-summary-actions"><NotificationInbox token={token}/><button type="button" className="button-secondary" disabled={busy||profileDirty||!!canceling} onClick={()=>{logoutPatient();navigate('/public');}}>Đăng xuất</button></div></div>}
      {token&&(view!=='account'||!profile)&&<NotificationInbox token={token}/>}
      {view==='account'&&token&&profile&&<nav className="account-tabs" aria-label="Nội dung tài khoản">{[['appointments','Lịch khám','/tai-khoan/lich-kham'],['history','Hồ sơ khám','/tai-khoan/ho-so'],['fees','Hóa đơn','/tai-khoan/hoa-don'],['notifications','Thông báo','/public/account?tab=notifications'],['profile','Thông tin','/tai-khoan/thong-tin']].map(([id,label,path])=><button type="button" key={id} disabled={busy||profileDirty||!!canceling} aria-pressed={accountTab===id} onClick={()=>{setAccountTab(id);navigate(path);if(id==='notifications')void run(async()=>{const [list,preference]=await Promise.all([api.getNotifications(token),api.getReminderPreference(token)]);setNotifications(list);setReminders(preference.remindersEnabled);});}}>{label}</button>)}</nav>}
      {view==='auth'&&<PatientAuthPanel/>}
      {view==='home'&&<PublicHomeV2 clinic={clinic} doctors={doctors} offerings={offerings} content={publicContent} book={openBooking} navigate={navigate}/>} 
      {view==='info'&&infoView&&<PublicInfoPage view={infoView} slug={infoSlug} clinic={clinic} doctors={doctors} offerings={offerings} content={publicContent} book={openBooking} navigate={navigate}/>} 
      {view==='booking'&&clinic&&<ol className="booking-steps" aria-label="Các bước đặt lịch"><li data-state={bookingInfoReady?'complete':'current'} aria-current={!bookingInfoReady?'step':undefined}><span>1</span>Chọn thông tin khám</li><li data-state={selectedSlot||hold||bookingSuccess?'complete':bookingInfoReady?'current':'upcoming'} aria-current={bookingInfoReady&&!selectedSlot&&!hold&&!bookingSuccess?'step':undefined}><span>2</span>Chọn giờ khám</li><li data-state={bookingSuccess?'complete':hold?'current':'upcoming'} aria-current={hold?'step':undefined}><span>3</span>Xác nhận lịch</li></ol>}
      {view==='booking'&&clinic && <section className="public-section booking-panel booking-schedule-card" id="booking">{!hold&&!bookingSuccess&&<><div className="booking-section-head"><div><span className="booking-section-kicker">Bước 1 · Thông tin khám</span><h2>Chọn thông tin khám</h2><p>Chọn chuyên khoa, dịch vụ, cách chọn bác sĩ và ngày khám trước khi tìm khung giờ.</p></div>{slotState==='success'&&slots&&<span className="booking-slot-count">{slots.length} giờ trống</span>}</div>{moving && <p role="status" className="booking-inline-notice">Đang đổi lịch {moving.appointmentCode}. Lịch hiện tại vẫn được giữ đến khi bạn xác nhận giờ mới.</p>}
        {bookingOptionsError&&<div className="booking-inline-notice booking-error" role="alert"><span>{bookingOptionsError}</span><button type="button" className="button-secondary" onClick={()=>setSiteAttempt(value=>value+1)}>Thử lại</button></div>}
        <form className="booking-form booking-search-form" onSubmit={e => { e.preventDefault(); void searchAvailability(); }}>
          {clinic.branches.length>1&&<label>Địa điểm khám<select required disabled={busy||slotState==='loading'} value={branch} onChange={e=>void run(()=>selectBranch(e.target.value))}><option value="">Chọn địa điểm khám</option>{clinic.branches.map(b=><option key={b.branchId} value={b.branchId}>{b.name} · {b.address}</option>)}</select></label>}
          <label>Chuyên khoa<select required disabled={busy||slotState==='loading'||!bookingOptions} value={specialty} onChange={e=>{const next=e.target.value;const nextSpecialty=bookingOptions?.specialties.find(item=>item.name===next);setSpecialty(next);if(!bookingOptions?.doctors.some(item=>item.doctorId===doctor&&item.specialtyCode===nextSpecialty?.code))setDoctor('');if(!bookingOptions?.offerings.some(item=>item.offeringId===offering&&item.specialtyCode===nextSpecialty?.code))setOffering('');clear();}}><option value="">{bookingOptions?'Chọn chuyên khoa':'Đang tải chuyên khoa…'}</option>{bookingSpecialties.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
          <label>Dịch vụ<select required disabled={busy||slotState==='loading'||!specialty} value={offering} onChange={e => { const next=e.target.value;setOffering(next);const nextOffering=bookingOptions?.offerings.find(item=>item.offeringId===next);if(doctor&&specificDoctor&&nextOffering&&specificDoctor.specialtyCode!==nextOffering.specialtyCode){setDoctor('');setDoctorMode('recommended');}clear(); }}><option value="">{!specialty?'Chọn chuyên khoa trước':bookingOfferings.length?'Chọn dịch vụ':'Chưa có dịch vụ thuộc chuyên khoa'}</option>{bookingOfferings.map(o => <option key={o.offeringId} value={o.offeringId}>{o.name}</option>)}</select></label>
          <fieldset className="booking-doctor-choice" disabled={busy||slotState==='loading'||!specialty}><legend>Chọn bác sĩ</legend><label className={doctorMode==='recommended'?'is-selected':''}><input type="radio" name="doctor-mode" value="recommended" checked={doctorMode==='recommended'} onChange={()=>{setDoctorMode('recommended');setDoctor('');clear();}}/><span><strong>Bác sĩ phù hợp</strong><small>Hệ thống tìm giờ trống của các bác sĩ trong chuyên khoa đã chọn.</small></span></label><label className={doctorMode==='specific'?'is-selected':''}><input type="radio" name="doctor-mode" value="specific" checked={doctorMode==='specific'} onChange={()=>{setDoctorMode('specific');clear();}}/><span><strong>Chọn bác sĩ cụ thể</strong><small>Chỉ xem lịch của bác sĩ bạn chọn.</small></span></label></fieldset>
          {doctorMode==='specific'&&<label className="booking-field-group"><span className="booking-field-label">Bác sĩ</span><select className="booking-field-control" required disabled={busy||slotState==='loading'||!specialty} value={doctor} onChange={e => { setDoctor(e.target.value); clear(); }}><option value="">{bookingDoctors.length?'Chọn bác sĩ':'Chưa có bác sĩ có lịch đặt khám thuộc chuyên khoa'}</option>{bookingDoctors.map(d => <option key={d.doctorId} value={d.doctorId}>{d.displayName}</option>)}</select><span className="booking-field-helper">{doctor&&workingDays?'Lịch làm việc: '+workingDays:''}</span></label>}
          <label className="booking-field-group"><span className="booking-field-label">Ngày khám</span><input className="booking-field-control" id="booking-date" aria-label="Ngày khám" required disabled={busy||slotState==='loading'} type="date" value={date} onChange={e => { setDate(e.target.value); clear(); }} /><span className="booking-field-helper"><DatePreview value={date}/></span></label><button className="booking-primary booking-search-submit" disabled={busy||slotState==='loading'||!bookingInfoReady}>{slotState==='loading'?'Đang tìm giờ khám…':'Tìm giờ khám'}</button>
          {!bookingInfoReady&&<p className="booking-form-validation">Chọn chuyên khoa, dịch vụ, ngày khám và {doctorMode==='specific'?'bác sĩ cụ thể':'đảm bảo chuyên khoa có bác sĩ'} để tìm lịch.</p>}
        </form>
        <div className="booking-slot-section"><div className="booking-slot-heading"><div><span className="booking-section-kicker">Bước 2 · Khung giờ</span><h3>{slotState==='success'?'Chọn giờ phù hợp':slotState==='loading'?'Đang tìm khung giờ…':slotState==='empty'?'Chưa tìm thấy giờ phù hợp':slotState==='error'?'Không tải được khung giờ':'Tìm giờ khám còn trống'}</h3></div><p>{slotState==='success'&&slots?slots.length+' lựa chọn trong ngày đã chọn':'Khung giờ luôn được lấy từ lịch trống thực tế.'}</p></div>
        {slotState==='idle'&&<div className="booking-slot-state"><strong>Chưa tìm khung giờ</strong><p>Hoàn tất thông tin khám phía trên rồi bấm “Tìm giờ khám”.</p></div>}
        {slotState==='loading'&&<div className="booking-slot-state is-loading" role="status"><span className="booking-state-spinner" aria-hidden="true"/><div><strong>Đang kiểm tra lịch trống</strong><p>Vui lòng chờ trong khi hệ thống đối chiếu bác sĩ và khung giờ phù hợp.</p></div></div>}
        {slotState==='error'&&<div className="booking-slot-state is-error" role="alert"><strong>Không thể tải khung giờ</strong><p>{slotError||'Đã có lỗi khi tải lịch trống.'}</p><button type="button" className="button-secondary" disabled={busy} onClick={()=>void searchAvailability()}>Thử lại</button></div>}
        {slotState==='empty'&&<div className="booking-slot-state is-empty" role="status"><strong>{emptyMessage}</strong><p>{slotReason==='DOCTOR_NOT_WORKING'?'Hãy chọn một ngày bác sĩ có lịch hoặc chuyển sang chế độ “Bác sĩ phù hợp”.':'Bạn có thể thay đổi lựa chọn và tìm lại lịch khám.'}</p><div className="booking-empty-actions"><button type="button" className="button-secondary" onClick={()=>document.getElementById('booking-date')?.focus()}>Chọn ngày khác</button>{doctorMode==='specific'&&<button type="button" className="button-secondary" onClick={()=>{setDoctorMode('recommended');setDoctor('');clear();}}>Tìm với bác sĩ phù hợp</button>}</div></div>}
        {slotState==='success'&&<div className="booking-slot-groups">{([['morning','Buổi sáng'],['afternoon','Buổi chiều'],['evening','Buổi tối']] as const).map(([period,label])=>slotGroups[period].length>0&&<section key={period} className="booking-slot-group"><div className="booking-slot-group-head"><h4>{label}</h4><span>{slotGroups[period].length} giờ</span></div><div className="booking-slots" aria-label={'Giờ khám '+label.toLowerCase()}>{slotGroups[period].map(s => {const slotDoctor=bookingOptions?.doctors.find(item=>item.doctorId===(s.doctorId??doctor));return <button className={'button-secondary booking-slot-button'+(selectedSlot?.slotId===s.slotId?' is-selected':'')} aria-pressed={selectedSlot?.slotId===s.slotId} key={s.slotId} disabled={busy || !!hold} onClick={() => { setSelectedSlot(s); if(profile&&token) void run(() => reserve(s)); }}><strong>{slotTime(s.startsAt)}</strong><span>{slotDate(s.startsAt)}</span>{slotDoctor&&<em>{slotDoctor.displayName}</em>}<small>{hidePublicPrices?'Giá chưa công bố':money(s.price.amountVnd)}</small></button>;})}</div></section>)}</div>}
        </div></>}
        {hold && <div className="booking-confirm booking-confirm-card"><div className="booking-confirm-head"><div><span className="booking-section-kicker">Bước 3 · Xác nhận lịch</span><h3>{hold.purpose==='RESCHEDULE'?'Xác nhận giờ khám thay thế':hold.purpose==='FOLLOW_UP'?'Xác nhận lịch tái khám':'Xác nhận lịch khám'}</h3></div><strong role="timer" className="booking-timer">{remaining > 0 ? Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2,'0') : '00:00'}</strong></div><section className="booking-confirm-section"><span className="booking-confirm-label">Thông tin người khám</span><strong>{profile?.fullName}</strong><small>{dateLabel(profile?.dateOfBirth)}</small></section>{heldDetails&&<section className="booking-confirm-section"><span className="booking-confirm-label">Thông tin lịch khám</span><dl className="booking-confirm-summary"><div><dt>Chuyên khoa</dt><dd>{specialty||'Chưa chọn'}</dd></div><div><dt>Dịch vụ</dt><dd>{bookingOptions?.offerings.find(o=>o.offeringId===heldDetails.offeringId)?.name??'Dịch vụ đã chọn'}</dd></div><div><dt>Bác sĩ</dt><dd>{bookingOptions?.doctors.find(d=>d.doctorId===heldDetails.doctorId)?.displayName??'Bác sĩ đã chọn'}</dd></div><div><dt>Ngày khám</dt><dd>{slotDate(heldDetails.startsAt)}</dd></div><div><dt>Khung giờ</dt><dd>{slotTime(heldDetails.startsAt)}</dd></div></dl></section>}<div className="booking-price-row"><span>Chi phí dự kiến</span><strong>{hidePublicPrices?'Chưa công bố':money(hold.price.amountVnd)}</strong></div><p className="booking-confirm-note">Giờ khám đang được giữ trong thời gian hiển thị phía trên.</p><div className="booking-confirm-actions"><button type="button" className="button-secondary" disabled={busy} onClick={clear}>Quay lại chỉnh sửa</button><button className="booking-primary" disabled={busy || remaining <= 0 || !token || !profile} onClick={() => void run(confirm)}>{busy?'Đang xác nhận…':hold.purpose==='RESCHEDULE'?'Xác nhận đổi lịch':'Xác nhận đặt lịch'}</button></div></div>}
        {bookingSuccess&&<div className="booking-success" role="status"><span className="booking-section-kicker">Hoàn tất</span><h3>Đặt lịch thành công</h3><dl><div><dt>Bác sĩ</dt><dd>{bookingOptions?.doctors.find(d=>d.doctorId===bookingSuccess.doctorId)?.displayName??'Bác sĩ đã chọn'}</dd></div><div><dt>Chuyên khoa</dt><dd>{bookingSuccess.specialty||'Chưa xác định'}</dd></div><div><dt>Dịch vụ</dt><dd>{bookingOptions?.offerings.find(o=>o.offeringId===bookingSuccess.offeringId)?.name??'Dịch vụ đã chọn'}</dd></div><div><dt>Ngày</dt><dd>{slotDate(bookingSuccess.appointment.startsAt)}</dd></div><div><dt>Giờ</dt><dd>{slotTime(bookingSuccess.appointment.startsAt)}</dd></div><div><dt>Địa điểm</dt><dd>{clinic.branches.find(b=>b.branchId===bookingSuccess.branchId)?.name??'Cơ sở đã chọn'}</dd></div><div><dt>Mã lịch hẹn</dt><dd>{bookingSuccess.appointment.appointmentCode}</dd></div></dl><div className="booking-success-actions"><button type="button" className="booking-primary" onClick={()=>navigate('/tai-khoan/lich-kham')}>Xem lịch khám của tôi</button><button type="button" className="button-secondary" onClick={()=>navigate('/public')}>Về trang chủ</button></div></div>}
      </section>}
      {view==='booking'&&<section className="public-section booking-panel booking-summary-panel" id="booking-summary"><div className="booking-side-summary-head"><strong>Tóm tắt đặt lịch</strong>{token&&profile&&<span className="is-ready">✓ Đã đăng nhập</span>}</div><dl className="booking-summary-live"><div><dt>Chuyên khoa</dt><dd>{specialty||'Chưa chọn'}</dd></div><div><dt>Dịch vụ</dt><dd>{selectedOffering?.name||'Chưa chọn'}</dd></div><div><dt>Bác sĩ</dt><dd>{selectedSlotDoctor?.displayName||(doctorMode==='specific'?specificDoctor?.displayName:specialty?'Bác sĩ phù hợp':'Chưa chọn')||'Chưa chọn'}</dd></div><div><dt>Ngày khám</dt><dd>{date?bookingDateLabel(date):'Chưa chọn'}</dd></div><div><dt>Khung giờ</dt><dd>{selectedSlot?slotTime(selectedSlot.startsAt):heldDetails?slotTime(heldDetails.startsAt):'Chưa chọn'}</dd></div></dl><div className="booking-summary-person"><span>Người khám</span>{profile?<><strong>{profile.fullName}</strong><small>{dateLabel(profile.dateOfBirth)}</small></>:token?<p>Vui lòng bổ sung họ tên và ngày sinh trước khi xác nhận lịch.</p>:<p>Bạn cần đăng nhập để xác nhận lịch.</p>}</div>{!token&&shared?.patientSession&&<SourceSessionState error={error} retry={()=>void run(login)}/>} {!token&&!shared?.patientSession&&selectedSlot&&<div className="booking-summary-auth"><p>Bạn cần đăng nhập để xác nhận lịch.</p><button type="button" className="booking-primary" onClick={beginPatientLogin}>Đăng nhập để tiếp tục</button></div>}{token&&!profile&&selectedSlot&&<form className="booking-missing-profile" onSubmit={e=>{e.preventDefault();void run(async()=>{const p=await api.saveProfile(token,{...draft,sex:'',phone:'',email:draft.email??'',expectedVersion:0});setProfile(p);setDraft({...p,expectedVersion:p.version});await reserve(selectedSlot,p);setMessage('Đã bổ sung thông tin bắt buộc và giữ giờ khám để xác nhận.');});}}><label>Họ tên<input required autoComplete="name" disabled={busy} maxLength={180} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})}/></label><label>Ngày sinh<input required aria-label="Ngày sinh" type="date" disabled={busy} value={draft.dateOfBirth} onChange={e=>setDraft({...draft,dateOfBirth:e.target.value})}/><DatePreview value={draft.dateOfBirth}/></label><button className="booking-primary" disabled={busy}>Bổ sung và tiếp tục</button></form>}{token&&profile&&selectedSlot&&!hold&&!bookingSuccess&&<button type="button" className="booking-primary booking-summary-continue" disabled={busy} onClick={()=>void run(()=>reserve(selectedSlot))}>Tiếp tục xác nhận</button>}</section>}
      {view==='account'&&(!profile||accountTab==='profile')&&<section className="public-section booking-panel booking-profile-card account-content-section" id="profile"><div className="booking-section-head booking-profile-head"><div><span className="booking-section-kicker">Hồ sơ cá nhân</span><h2>Hồ sơ bệnh nhân</h2><p>Cập nhật thông tin hồ sơ của bạn.</p></div></div><form className="booking-form" onSubmit={e=>{e.preventDefault();void run(async()=>{const p=await api.saveProfile(token,draft);setProfile(p);setDraft({...p,expectedVersion:p.version});setMessage('Đã lưu hồ sơ.');});}}><label>Họ tên<input required autoComplete="name" disabled={busy} maxLength={180} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})}/></label><label>Ngày sinh<input aria-label="Ngày sinh" required type="date" disabled={busy} value={draft.dateOfBirth} onChange={e=>setDraft({...draft,dateOfBirth:e.target.value})}/><DatePreview value={draft.dateOfBirth}/></label><label>Giới tính<select disabled={busy} value={draft.sex??''} onChange={e=>setDraft({...draft,sex:e.target.value})}><option value="">Chưa cung cấp</option><option value="FEMALE">Nữ</option><option value="MALE">Nam</option><option value="OTHER">Khác</option></select></label><label>Số điện thoại<input type="tel" autoComplete="tel" disabled={busy} maxLength={30} value={draft.phone??''} onChange={e=>setDraft({...draft,phone:e.target.value})}/></label><label>Email<input type="email" autoComplete="email" disabled={busy} maxLength={180} value={draft.email??''} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><button className="booking-primary" disabled={busy}>Lưu hồ sơ</button></form>{profileDirty&&<button className="button-secondary" disabled={busy} onClick={()=>setDraft(profile?{...profile,expectedVersion:profile.version}:{...empty,fullName:shared?.patientSession?.displayName??'',email:shared?.patientSession?.email??''})}>Bỏ thay đổi hồ sơ</button>}<button className="button-secondary" disabled={busy||profileDirty} onClick={()=>void run(async()=>{const p=await api.getProfile(token);setProfile(p);setDraft({...p,expectedVersion:p.version});setMessage('Đã tải hồ sơ mới nhất.');})}>Tải lại hồ sơ</button></section>}
      {view==='account'&&accountTab==='appointments'&&<section className="public-section booking-panel account-content-section" id="portal"><header className="account-content-heading"><div><span className="booking-section-kicker">Lịch khám</span><h2>Lịch khám của tôi</h2></div>{clinic&&profile&&<button type="button" className="button-secondary account-refresh" aria-label="Cập nhật lịch khám" title="Cập nhật lịch khám" disabled={busy} onClick={() => void run(reload)}><RefreshCw size={16} aria-hidden="true"/><span>Cập nhật</span></button>}</header>{!clinic || !profile ? <p>Đăng nhập để xem, đổi hoặc hủy lịch khám của bạn.</p> : <>{appointmentsLoaded&&!appointments.some(a=>['CONFIRMED','CHECKED_IN'].includes(a.status)&&Date.parse(a.endsAt)>=Date.now())&&<div className="account-empty-state" role="status"><h3>Bạn chưa có lịch khám sắp tới.</h3><p>Khi cần, bạn có thể chọn chuyên khoa, bác sĩ và khung giờ còn trống ngay trên trang đặt lịch.</p><button type="button" className="booking-primary" onClick={()=>openBooking()}>Đặt lịch khám <ArrowRight size={16}/></button></div>}{appointments.filter(a=>['CONFIRMED','CHECKED_IN'].includes(a.status)&&Date.parse(a.endsAt)>=Date.now()).sort((a,b)=>a.startsAt.localeCompare(b.startsAt)).map(a => <article className="booking-appointment" key={a.id}><h3>{a.appointmentCode}</h3><p>{when(a.startsAt)} · {money(a.price.amountVnd)} · {stateName(a.status)}</p>{a.status === 'CONFIRMED' && <><button className="button-secondary" disabled={busy} onClick={() => { setMoving(a);setFollowUp(null); clear();navigate('/dat-lich'); }}>Đổi giờ khám</button><button className="button-secondary" disabled={busy} onClick={() => setCanceling(a)}>Hủy lịch</button></>}</article>)}</>}</section>}
      {(view==='booking'||view==='account'&&accountTab==='appointments')&&clinic && profile && <section className="public-section booking-panel booking-recovery"><h2>Giờ khám đang giữ</h2><p>Sau khi tải lại trang, đăng nhập để tiếp tục giờ còn đang giữ. Kiểm tra lịch của bạn trước nếu chưa rõ kết quả xác nhận.</p><button className="button-secondary" disabled={busy} onClick={() => void run(async () => setPendingHolds(await api.getPendingHolds(token,clinic.clinicId,profile.patientId)))}>Tải giờ đang giữ</button>{pendingHolds.map(p => <p key={p.hold.holdId}><button className="button-secondary" disabled={busy} onClick={() => void run(async () => { const original=p.hold.purpose==='RESCHEDULE'?(await api.myAppointments(token,clinic.clinicId,profile.patientId)).find(a=>a.id===p.hold.rescheduleAppointmentId):null;if(p.hold.purpose==='RESCHEDULE'&&(!original||original.status!=='CONFIRMED'))throw new Error('Lịch gốc không còn có thể đổi. Kiểm tra lịch khám của bạn.');await selectBranch(p.hold.branchId);const options=await api.getBookingOptions(clinic.clinicId,p.hold.branchId);const restoredDoctor=options.doctors.find(item=>item.doctorId===p.doctorId);const restoredOffering=options.offerings.find(item=>item.offeringId===p.offeringId);const specialtyCode=restoredDoctor?.specialtyCode??restoredOffering?.specialtyCode;const restoredSpecialty=options.specialties.find(item=>item.code===specialtyCode);if(!restoredDoctor||!restoredOffering||!restoredSpecialty||restoredDoctor.specialtyCode!==restoredOffering.specialtyCode)throw new Error('Giờ đang giữ không còn phù hợp với bác sĩ hoặc dịch vụ có thể đặt lịch. Vui lòng chọn lịch mới.');setBookingOptions(options);setSpecialty(restoredSpecialty.name);setDoctorMode('specific');setDoctor(p.doctorId);setOffering(p.offeringId);setDate(localDate(p.startsAt));setMoving(original??null);setFollowUp(null);setHold(p.hold);setHeldDetails({doctorId:p.doctorId,offeringId:p.offeringId,startsAt:p.startsAt,endsAt:p.endsAt});setNow(Date.now());setNextView('/dat-lich');keys.current.confirm=await stableOperationKey('confirm',{clinicId:clinic.clinicId,patientId:profile.patientId,holdId:p.hold.holdId}); })}>Tiếp tục {p.hold.purpose==='RESCHEDULE'?'đổi lịch':p.hold.purpose==='FOLLOW_UP'?'tái khám':'đặt lịch'} · {when(p.startsAt)} · {money(p.hold.price.amountVnd)}</button></p>)}</section>}
      {view==='account'&&accountTab==='notifications'&&token && <section className="public-section booking-panel account-content-section"><header className="account-content-heading"><div><span className="booking-section-kicker">Thông báo</span><h2>Thông báo của tôi</h2></div><button type="button" className="button-secondary account-refresh" disabled={busy} onClick={() => void run(async () => { const [list, preference] = await Promise.all([api.getNotifications(token), api.getReminderPreference(token)]); setNotifications(list); setReminders(preference.remindersEnabled); })}><RefreshCw size={16} aria-hidden="true"/><span>Cập nhật</span></button></header>{reminders !== null && <p className="account-preference"><label><input type="checkbox" disabled={busy} checked={reminders} onChange={e => { const enabled=e.target.checked; void run(async () => setReminders((await api.setReminderPreference(token,enabled)).remindersEnabled)); }} /> Nhận nhắc lịch trong ứng dụng</label></p>}{reminders!==null&&notifications.length===0&&<div className="account-empty-state" role="status"><h3>Bạn chưa có thông báo mới.</h3><p>Các cập nhật liên quan đến lịch khám và tài khoản sẽ xuất hiện tại đây.</p></div>}{notifications.map(n => <p className="account-notification" key={n.id}>{n.message}<small>{when(n.created_at)}</small></p>)}</section>}
      {view==='booking'&&followUp && <p className="booking-feedback" role="status">Đang tạo lịch tái khám mới theo ngày đề xuất {followUp.proposedDate}. Chọn bác sĩ, dịch vụ và giờ còn trống.</p>}
      {view==='account'&&accountTab==='history'&&profile && token && <AsyncPanel><PatientHistoryPanel mode="history" clinicId={clinic?.clinicId} token={token} patientId={profile.patientId} onFollowUp={async plan=>{await selectClinic(plan.clinicId);setFollowUp(plan);setDate(plan.proposedDate);navigate('/dat-lich');}} /></AsyncPanel>}
      {view==='account'&&accountTab==='fees'&&profile && token && <AsyncPanel><PatientHistoryPanel mode="fees" clinicId={clinic?.clinicId} token={token} patientId={profile.patientId} onFollowUp={async()=>{}} /></AsyncPanel>}
      {canceling&&profile&&<ConfirmDialog title="Xem lại lịch cần hủy" confirmLabel="Xác nhận hủy lịch" busy={busy} onCancel={()=>setCanceling(null)} onConfirm={()=>void run(async()=>{await api.cancelAppointment(token,canceling,profile.patientId);setCanceling(null);await reload();setMessage('Đã hủy lịch '+canceling.appointmentCode+'.');})}><p>{profile.fullName} · {dateLabel(profile.dateOfBirth)}</p><p><strong>{when(canceling.startsAt)}</strong></p><p>Lịch {canceling.appointmentCode} · {money(canceling.price.amountVnd)}</p><p>Giờ đã đặt sẽ được giải phóng sau khi hủy.</p></ConfirmDialog>}
    </main>
    <footer className="public-footer">
      <div className="public-footer-main">
        <div className="public-footer-brand"><a className="brand" href="/public" onClick={e=>{e.preventDefault();navigate('/public');}}><span className="brand-mark"><Stethoscope size={22}/></span><span><strong>{clinic?.name??'Phòng khám'}</strong><small>Chăm sóc sức khỏe ngoại trú</small></span></a>{primaryAddress&&<p><MapPin size={16}/>{primaryAddress}</p>}{clinic?.phone&&<a href={'tel:'+clinic.phone.replace(/[^0-9+]/g,'')}><Phone size={16}/>{clinic.phone}</a>}{primaryHours&&<p><Clock3 size={16}/>{primaryHours}</p>}</div>
        <nav aria-label="Phòng khám"><strong>Phòng khám</strong><a href="/gioi-thieu" onClick={e=>{e.preventDefault();navigate('/gioi-thieu');}}>Giới thiệu</a><a href="/chuyen-khoa" onClick={e=>{e.preventDefault();navigate('/chuyen-khoa');}}>Chuyên khoa</a><a href="/bac-si" onClick={e=>{e.preventDefault();navigate('/bac-si');}}>Bác sĩ</a><a href="/dich-vu" onClick={e=>{e.preventDefault();navigate('/dich-vu');}}>Dịch vụ</a><a href="/lien-he" onClick={e=>{e.preventDefault();navigate('/lien-he');}}>Liên hệ</a></nav>
        <nav aria-label="Dành cho bệnh nhân"><strong>Dành cho bệnh nhân</strong><a href="/dat-lich" onClick={e=>{e.preventDefault();openBooking();}}>Đặt lịch</a><a href="/tai-khoan/lich-kham" onClick={e=>{e.preventDefault();openAccount();}}>Lịch khám của tôi</a><a href="/tai-khoan/ho-so" onClick={e=>{e.preventDefault();navigate('/tai-khoan/ho-so');}}>Hồ sơ</a><a href="/tai-khoan/hoa-don" onClick={e=>{e.preventDefault();navigate('/tai-khoan/hoa-don');}}>Hóa đơn</a></nav>
        <nav aria-label="Hỗ trợ"><strong>Hỗ trợ</strong><a href="/public#faq" onClick={e=>{e.preventDefault();navigate('/public#faq');}}>Câu hỏi thường gặp</a><a href="/public#quy-trinh" onClick={e=>{e.preventDefault();navigate('/public#quy-trinh');}}>Quy trình khám</a></nav>
      </div>
      <div className="public-footer-bottom"><span>© {new Date().getFullYear()} {clinic?.name??'Phòng khám'}</span><p>Trường hợp cần cấp cứu y tế, vui lòng liên hệ cơ sở cấp cứu phù hợp hoặc 115.</p></div>
    </footer>
  </div>;
}

