// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useEffect,useState} from 'react';
import { PublicShell } from '../shells/PublicShell';
import {SessionProvider,useSession} from '../auth/SessionProvider';
import {readBookingReturnState,saveBookingReturnState} from '../auth/bookingReturn';
import * as api from '../api/booking';
import { requestJson } from '../api/client';

vi.mock('../api/booking', async importOriginal => { const actual=await importOriginal<typeof import('../api/booking')>(); return {...actual,getSiteClinic:vi.fn(),getClinic:vi.fn(),getDoctors:vi.fn(),getOfferings:vi.fn(),getPublicContent:vi.fn(),getBookingOptions:vi.fn(),getAvailabilityResult:vi.fn(),signIn:vi.fn(),refreshAuth:vi.fn(),logoutAuth:vi.fn(),saveProfile:vi.fn(),getSlots:vi.fn(),holdSlot:vi.fn(),holdReschedule:vi.fn(),getPendingHolds:vi.fn(),confirmHold:vi.fn(),myAppointments:vi.fn(),cancelAppointment:vi.fn(),rescheduleAppointment:vi.fn()};});
vi.mock('../api/client', () => ({ requestJson: vi.fn() }));
vi.mock('../api/idempotency', () => ({ stableOperationKey: vi.fn(async () => crypto.randomUUID()), forgetOperationKey: vi.fn() }));
const clinic = { clinicId: 'clinic-a', name: 'Synthetic Clinic', branches: [{ branchId: 'branch-a', name: 'Synthetic Branch', address: 'Synthetic address', openingHours: '08-17' }] };
const profile = { patientId: 'patient-a', fullName: 'Synthetic Patient', dateOfBirth: '1990-01-01', sex: '', phone: '', email: '', version: 0 };
const price = { amountVnd: 100000, currency: 'VND', priceVersionId: 'price-a', effectiveFrom: '2026-01-01T00:00:00Z' };
const doctors=[
 {doctorId:'doctor-a',clinicId:'clinic-a',branchId:'branch-a',displayName:'Bác sĩ Nhi',specialtyName:'Nhi'},
 {doctorId:'doctor-b',clinicId:'clinic-a',branchId:'branch-a',displayName:'Bác sĩ Nội',specialtyName:'Nội khoa'},
];
const offerings=[
 {offeringId:'offering-a',clinicId:'clinic-a',branchId:'branch-a',name:'Khám Nhi',amountVnd:100000,priceVersionId:'price-a'},
 {offeringId:'offering-b',clinicId:'clinic-a',branchId:'branch-a',name:'Khám Nội khoa',amountVnd:120000,priceVersionId:'price-b'},
];
const publicContent={
 clinic:{},
 specialties:[
  {specialtyId:'sp-nhi',databaseName:'Nhi',displayName:'Nhi',slug:'nhi',shortDescription:'',description:'',commonConditions:[],keyExpertise:[],doctorCount:1,cta:''},
  {specialtyId:'sp-noi',databaseName:'Nội khoa',displayName:'Nội khoa',slug:'noi-khoa',shortDescription:'',description:'',commonConditions:[],keyExpertise:[],doctorCount:1,cta:''},
 ],
 doctors:[],
 services:[
  {offeringId:'offering-a',code:'DV-NHI',name:'Khám Nhi',specialtyName:'Nhi',specialtySlug:'nhi',description:'',suitableFor:'',preparation:'',cta:''},
  {offeringId:'offering-b',code:'DV-NOI',name:'Khám Nội khoa',specialtyName:'Nội khoa',specialtySlug:'noi-khoa',description:'',suitableFor:'',preparation:'',cta:''},
 ],
};
const bookingOptions:api.BookingOptions={
 specialties:[{code:'nhi',name:'Nhi'},{code:'noi',name:'Nội khoa'}],
 doctors:[
  {doctorId:'doctor-a',displayName:'Bác sĩ Nhi',specialtyCode:'nhi',specialtyName:'Nhi',professionalTitle:'Bác sĩ',schedules:[{dayOfWeek:2,startTime:'08:00:00',endTime:'17:00:00',timezone:'Asia/Ho_Chi_Minh',effectiveFrom:'2026-01-01',version:1}]},
  {doctorId:'doctor-b',displayName:'Bác sĩ Nội',specialtyCode:'noi',specialtyName:'Nội khoa',professionalTitle:'Bác sĩ',schedules:[{dayOfWeek:2,startTime:'08:00:00',endTime:'17:00:00',timezone:'Asia/Ho_Chi_Minh',effectiveFrom:'2026-01-01',version:1}]},
 ],
 offerings:[
  {offeringId:'offering-a',code:'DV-NHI',name:'Khám Nhi',specialtyCode:'nhi',durationMinutes:30},
  {offeringId:'offering-b',code:'DV-NOI',name:'Khám Nội khoa',specialtyCode:'noi',durationMinutes:30},
 ],
};
beforeEach(() => {
 window.history.replaceState(null,'','/public/booking');
 sessionStorage.clear();
 vi.resetAllMocks();
 vi.mocked(api.getSiteClinic).mockResolvedValue(clinic);
 vi.mocked(api.getClinic).mockResolvedValue(clinic);
 vi.mocked(api.getDoctors).mockResolvedValue(doctors);
 vi.mocked(api.getOfferings).mockResolvedValue(offerings);
 vi.mocked(api.getPublicContent).mockResolvedValue(publicContent);
 vi.mocked(api.getBookingOptions).mockResolvedValue(bookingOptions);
 vi.mocked(api.signIn).mockResolvedValue({ data: { accessToken: 'synthetic-token',email:'synthetic@example.invalid',fullName:'Synthetic Patient' } });
 vi.mocked(requestJson).mockImplementation(async url=>{
  const path=String(url);
  if(path.endsWith('/api/me/current'))return {ok:true,status:200,data:{userId:'patient-a',legacyRoles:['ROLE_PATIENT'],platformOperator:false}} as never;
  if(path.endsWith('/api/me/contexts'))return {ok:true,status:200,data:[]} as never;
  if(path.endsWith('/api/me/patient-profile'))return {ok:true,status:200,data:profile} as never;
  return {ok:true,status:200,data:profile} as never;
 });
 vi.mocked(api.getAvailabilityResult).mockImplementation(async query=>({available:true,reason:'AVAILABLE',doctorId:query.doctorId,doctorName:query.doctorId==='doctor-a'?'Bác sĩ Nhi':'Bác sĩ Nội',date:query.date,slots:[{ slotId: 'slot-a', doctorId:query.doctorId, offeringId:query.offeringId, startsAt: '2026-12-01T01:00:00Z', endsAt: '2026-12-01T01:30:00Z', remaining: 1, price }]}));
 vi.mocked(api.holdSlot).mockResolvedValue({ holdId: 'hold-a', state: 'ACTIVE', purpose: 'BOOKING', expiresAt: new Date(Date.now() + 600000).toISOString(), price });
 vi.mocked(api.confirmHold).mockResolvedValue({ id: 'appointment-a', appointmentCode: 'AP-SYN', clinicId: 'clinic-a', status: 'CONFIRMED', startsAt: '2026-12-01T01:00:00Z', endsAt: '2026-12-01T01:30:00Z', price });
 vi.mocked(api.myAppointments).mockResolvedValue([]);
 vi.mocked(api.getPendingHolds).mockResolvedValue([]);
});
afterEach(cleanup);
it('keeps the public page healthy when optional content is absent during background refresh',async()=>{
 window.history.replaceState(null,'','/public');
 vi.mocked(api.getPublicContent).mockResolvedValue(null);
 render(<PublicShell state="ready"/>);
 await waitFor(()=>expect(api.getPublicContent).toHaveBeenCalled());
 const initialCalls=vi.mocked(api.getPublicContent).mock.calls.length;
 window.dispatchEvent(new Event('focus'));
 await waitFor(()=>expect(vi.mocked(api.getPublicContent).mock.calls.length).toBeGreaterThan(initialCalls));
 expect(screen.queryByText('Chưa cập nhật được thông tin phòng khám. Hệ thống sẽ thử lại.')).toBeNull();
 expect(screen.getAllByText('Synthetic Clinic').length).toBeGreaterThan(0);
});
async function waitForBookingOptions(){await screen.findByRole('option',{name:'Nhi'});}
function AuthenticatedPublicShell(){
 const auth=useSession();
 useEffect(()=>{if(!auth?.patientSession)void auth?.authenticatePatient('synthetic@example.invalid','synthetic-password');},[]);
 if(!auth?.patientSession)return <p role="status">Đang đăng nhập bệnh nhân kiểm thử…</p>;
 return <PublicShell state="ready"/>;
}
function renderAuthenticatedPublic(){render(<SessionProvider><AuthenticatedPublicShell/></SessionProvider>);}
function StickyAuthenticatedPublicShell(){
 const auth=useSession(),[ready,setReady]=useState(false);
 useEffect(()=>{if(!ready&&!auth?.patientSession)void auth?.authenticatePatient('synthetic@example.invalid','synthetic-password').then(()=>setReady(true));},[ready,auth?.patientSession?.token]);
 if(!ready)return <p role="status">Đang đăng nhập bệnh nhân kiểm thử…</p>;
 return <PublicShell state="ready"/>;
}
function renderStickyAuthenticatedPublic(){render(<SessionProvider><StickyAuthenticatedPublicShell/></SessionProvider>);}
async function reachSlot(renderShell=renderAuthenticatedPublic) {
 saveBookingReturnState({branch:'branch-a',specialty:'Nhi',specialtyCode:'nhi',offering:'offering-a',doctorMode:'recommended',doctor:'',date:'2026-12-01',slotId:'slot-a',slotDoctorId:'doctor-a',slotOfferingId:'offering-a',slotStartsAt:'2026-12-01T01:00:00Z'});
 const user=userEvent.setup();renderShell();
 await screen.findByRole('heading',{name:'Xác nhận lịch khám'});
 expect(screen.queryByText('Đăng nhập / Hồ sơ')).toBeNull();
 expect(screen.getByRole('list',{name:'Các bước đặt lịch'}).querySelectorAll('li')).toHaveLength(3);
 expect(screen.queryByRole('searchbox')).toBeNull();
 expect(screen.queryByRole('combobox',{name:'Địa điểm khám'})).toBeNull();
 const confirm=await screen.findByRole('button',{name:'Xác nhận đặt lịch'});
 return {user,confirm};
}

it('filters Nhi doctors and services and resets invalid selections when specialty changes',async()=>{
 const user=userEvent.setup();render(<PublicShell state="ready" />);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 await waitForBookingOptions();
 const specialtySelect=screen.getByLabelText('Chuyên khoa') as HTMLSelectElement;
 const serviceSelect=screen.getByLabelText('Dịch vụ') as HTMLSelectElement;
 expect(serviceSelect.disabled).toBe(true);
 await user.selectOptions(specialtySelect,'Nhi');
 expect(serviceSelect.disabled).toBe(false);
 expect(screen.getByRole('option',{name:'Khám Nhi'})).toBeTruthy();
 expect(screen.queryByRole('option',{name:'Khám Nội khoa'})).toBeNull();
 await user.click(screen.getByRole('radio',{name:/Chọn bác sĩ cụ thể/}));
 const doctorSelect=screen.getByLabelText('Bác sĩ') as HTMLSelectElement;
 expect(screen.getByRole('option',{name:'Bác sĩ Nhi'})).toBeTruthy();
 expect(screen.queryByRole('option',{name:'Bác sĩ Nội'})).toBeNull();
 await user.selectOptions(doctorSelect,'doctor-a');
 await user.selectOptions(serviceSelect,'offering-a');
 await user.selectOptions(specialtySelect,'Nội khoa');
 expect((screen.getByLabelText('Bác sĩ') as HTMLSelectElement).value).toBe('');
 expect((screen.getByLabelText('Dịch vụ') as HTMLSelectElement).value).toBe('');
 expect(screen.getByRole('option',{name:'Bác sĩ Nội'})).toBeTruthy();
 expect(screen.queryByRole('option',{name:'Bác sĩ Nhi'})).toBeNull();
 expect(screen.getByRole('option',{name:'Khám Nội khoa'})).toBeTruthy();
 expect(screen.queryByRole('option',{name:'Khám Nhi'})).toBeNull();
});

it('lets guests inspect a slot but blocks holding and confirmation until login',async()=>{
 const user=userEvent.setup();render(<SessionProvider><PublicShell state="ready" /></SessionProvider>);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 expect(screen.getByRole('list',{name:'Các bước đặt lịch'}).querySelectorAll('li')).toHaveLength(3);
 expect(screen.queryByText('Đăng nhập / Hồ sơ')).toBeNull();
 await waitForBookingOptions();
 await user.selectOptions(screen.getByLabelText('Chuyên khoa'),'Nhi');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('button',{name:'Tìm giờ khám'}));
 const slot=await screen.findByRole('button',{name:/Bác sĩ Nhi/});
 await user.click(slot);
 const login=screen.getByRole('button',{name:'Đăng nhập để tiếp tục'});
 expect(login).toBeTruthy();
 expect(api.holdSlot).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Xác nhận đặt lịch'})).toBeNull();
 await user.click(login);
 expect(window.location.pathname).toBe('/public/login');
 expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/dat-lich');
 expect(readBookingReturnState()).toEqual(expect.objectContaining({specialty:'Nhi',specialtyCode:'nhi',offering:'offering-a',slotId:'slot-a',slotDoctorId:'doctor-a',slotOfferingId:'offering-a'}));
});

it('returns to step 2 when the slot saved before login is no longer available',async()=>{
 saveBookingReturnState({branch:'branch-a',specialty:'Nhi',specialtyCode:'nhi',offering:'offering-a',doctorMode:'recommended',doctor:'',date:'2026-12-01',slotId:'slot-a',slotDoctorId:'doctor-a',slotOfferingId:'offering-a',slotStartsAt:'2026-12-01T01:00:00Z'});
 vi.mocked(api.getAvailabilityResult).mockResolvedValue({available:false,reason:'FULLY_BOOKED',doctorId:'doctor-a',doctorName:'Bác sĩ Nhi',date:'2026-12-01',slots:[]});
 renderAuthenticatedPublic();
 expect(await screen.findByText('Khung giờ bạn đã chọn vừa không còn khả dụng. Vui lòng chọn khung giờ khác.')).toBeTruthy();
 const steps=screen.getByRole('list',{name:'Các bước đặt lịch'}).querySelectorAll('li');
 expect(steps).toHaveLength(3);
 expect(steps[1].getAttribute('aria-current')).toBe('step');
 expect(steps[2].getAttribute('data-state')).toBe('upcoming');
 expect(api.holdSlot).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Xác nhận đặt lịch'})).toBeNull();
});

it('asks only for backend-required profile fields before confirmation when the patient has no profile',async()=>{
 saveBookingReturnState({branch:'branch-a',specialty:'Nhi',specialtyCode:'nhi',offering:'offering-a',doctorMode:'recommended',doctor:'',date:'2026-12-01',slotId:'slot-a',slotDoctorId:'doctor-a',slotOfferingId:'offering-a',slotStartsAt:'2026-12-01T01:00:00Z'});
 vi.mocked(requestJson).mockImplementation(async url=>{
  const path=String(url);
  if(path.endsWith('/api/me/current'))return {ok:true,status:200,data:{userId:'patient-a',legacyRoles:['ROLE_PATIENT'],platformOperator:false}} as never;
  if(path.endsWith('/api/me/contexts'))return {ok:true,status:200,data:[]} as never;
  if(path.endsWith('/api/me/patient-profile'))return {ok:false,status:404,message:'Chưa có hồ sơ'} as never;
  return {ok:true,status:200,data:profile} as never;
 });
 vi.mocked(api.saveProfile).mockResolvedValue(profile);
 const user=userEvent.setup();renderAuthenticatedPublic();
 const continueButton=await screen.findByRole('button',{name:'Bổ sung và tiếp tục'});
 expect(screen.getByLabelText('Họ tên')).toBeTruthy();
 expect(screen.getByLabelText('Ngày sinh')).toBeTruthy();
 expect(screen.queryByLabelText('Giới tính')).toBeNull();
 expect(screen.queryByLabelText('Số điện thoại')).toBeNull();
 expect(screen.queryByLabelText('Email')).toBeNull();
 await user.clear(screen.getByLabelText('Ngày sinh'));
 await user.type(screen.getByLabelText('Ngày sinh'),'1990-01-01');
 await user.click(continueButton);
 expect(await screen.findByRole('heading',{name:'Xác nhận lịch khám'})).toBeTruthy();
 expect(api.saveProfile).toHaveBeenCalledWith('synthetic-token',expect.objectContaining({fullName:'Synthetic Patient',dateOfBirth:'1990-01-01',expectedVersion:0}));
 expect(api.holdSlot).toHaveBeenCalledTimes(1);
});

it('shows a clear empty state with recovery actions when no slot exists',async()=>{
 vi.mocked(api.getAvailabilityResult).mockResolvedValue({available:false,reason:'NO_ELIGIBLE_DOCTOR',doctorId:'doctor-a',doctorName:'Bác sĩ Nhi',date:'2026-12-01',slots:[]});
 const user=userEvent.setup();render(<PublicShell state="ready" />);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 await waitForBookingOptions();
 await user.selectOptions(screen.getByLabelText('Chuyên khoa'),'Nhi');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('button',{name:'Tìm giờ khám'}));
 expect(await screen.findByText('Chưa có bác sĩ phù hợp với chuyên khoa và ngày khám đã chọn.')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Chọn ngày khác'})).toBeTruthy();
});

it('explains that a specific doctor does not work on the selected date',async()=>{
 vi.mocked(api.getAvailabilityResult).mockResolvedValue({available:false,reason:'DOCTOR_NOT_WORKING',doctorId:'doctor-a',doctorName:'Bác sĩ Nhi',date:'2026-08-08',slots:[]});
 const user=userEvent.setup();render(<PublicShell state="ready"/>);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 await waitForBookingOptions();
 await user.selectOptions(screen.getByLabelText('Chuyên khoa'),'Nhi');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('radio',{name:/Chọn bác sĩ cụ thể/}));
 await user.selectOptions(screen.getByLabelText('Bác sĩ'),'doctor-a');
 await user.clear(screen.getByLabelText('Ngày khám'));await user.type(screen.getByLabelText('Ngày khám'),'2026-08-08');
 await user.click(screen.getByRole('button',{name:'Tìm giờ khám'}));
 expect(await screen.findByText(/Bác sĩ Bác sĩ Nhi không có lịch làm việc.*08\/08\/2026/)).toBeTruthy();
 expect(screen.getByRole('button',{name:'Tìm với bác sĩ phù hợp'})).toBeTruthy();
});

it('shows API error and a retry action instead of a dead slot panel',async()=>{
 vi.mocked(api.getAvailabilityResult).mockRejectedValue(new Error('Synthetic availability failure'));
 const user=userEvent.setup();render(<PublicShell state="ready" />);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 await waitForBookingOptions();
 await user.selectOptions(screen.getByLabelText('Chuyên khoa'),'Nhi');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('button',{name:'Tìm giờ khám'}));
 const alert=await screen.findByRole('alert');
 expect(alert.textContent).toContain('Không thể tải lịch khám lúc này');
 expect(screen.getByRole('button',{name:'Thử lại'})).toBeTruthy();
});

it('shows loading feedback while availability is being fetched',async()=>{
 let release:((value:api.AvailabilityResult)=>void)|undefined;
 vi.mocked(api.getAvailabilityResult).mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));
 const user=userEvent.setup();render(<PublicShell state="ready" />);
 await screen.findByRole('heading',{name:'Chọn thông tin khám'});
 await waitForBookingOptions();
 await user.selectOptions(screen.getByLabelText('Chuyên khoa'),'Nhi');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('button',{name:'Tìm giờ khám'}));
 expect(await screen.findByText('Đang kiểm tra lịch trống')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Đang tìm giờ khám…'})).toHaveProperty('disabled',true);
 release?.({available:true,reason:'AVAILABLE',doctorId:'doctor-a',doctorName:'Bác sĩ Nhi',date:'2026-12-01',slots:[{slotId:'slot-loading',doctorId:'doctor-a',offeringId:'offering-a',startsAt:'2026-12-01T01:00:00Z',endsAt:'2026-12-01T01:30:00Z',remaining:1,price}]});
 expect(await screen.findByRole('button',{name:/Bác sĩ Nhi/})).toBeTruthy();
});

describe('S1 booking workflow',()=>{
 it('confirms using the owned profile, stable hold and frozen displayed price',async()=>{
  const {user,confirm}=await reachSlot();
  await user.click(confirm);
  await screen.findByRole('heading',{name:'Đặt lịch thành công'});
  expect(screen.getByText('AP-SYN')).toBeTruthy();
  expect(screen.getByRole('button',{name:'Xem lịch khám của tôi'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'Về trang chủ'})).toBeTruthy();
  expect(api.holdSlot).toHaveBeenCalledWith('synthetic-token',expect.objectContaining({patientId:'patient-a',clinicId:'clinic-a',branchId:'branch-a',slotId:'slot-a'}),expect.any(String));
  expect(api.confirmHold).toHaveBeenCalledWith('synthetic-token','clinic-a','patient-a','hold-a',expect.any(String));
 });
 it('sends an expired confirmation session to Public Patient Login and preserves booking return state',async()=>{
  const {user,confirm}=await reachSlot(renderStickyAuthenticatedPublic);
  vi.mocked(api.confirmHold).mockRejectedValueOnce(new api.RequestError('Phiên đăng nhập đã hết hạn.',401));
  await user.click(confirm);
  await waitFor(()=>expect(window.location.pathname).toBe('/public/login'));
  expect(new URLSearchParams(window.location.search).get('returnTo')).toBe('/dat-lich');
  expect(window.location.pathname).not.toBe('/workspace/login');
  expect(readBookingReturnState()).toEqual(expect.objectContaining({specialtyCode:'nhi',offering:'offering-a',slotId:'slot-a',slotDoctorId:'doctor-a'}));
 });
 it('retries an uncertain confirmation with the same idempotency key',async()=>{
  vi.mocked(api.confirmHold).mockRejectedValueOnce(new Error('Chưa xác định được kết quả.'));
  const {user,confirm}=await reachSlot();
  await user.click(confirm);
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button',{name:'Xác nhận đặt lịch'}));
  await screen.findByRole('heading',{name:'Đặt lịch thành công'});
  const calls=vi.mocked(api.confirmHold).mock.calls;expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);
 });
 it('blocks confirmation after the server hold TTL expires',async()=>{
  vi.mocked(api.holdSlot).mockResolvedValue({holdId:'hold-a',state:'ACTIVE',purpose:'BOOKING',expiresAt:new Date(Date.now()-1000).toISOString(),price});
  const {confirm}=await reachSlot();
  expect((confirm as HTMLButtonElement).disabled).toBe(true);expect(api.confirmHold).not.toHaveBeenCalled();
 });
});


it('recovers a reschedule hold from server intent and never confirms it as a new booking',async()=>{
 const {user}=await reachSlot();
 const original={id:'original-a',appointmentCode:'AP-ORIGINAL',clinicId:'clinic-a',status:'CONFIRMED',startsAt:'2026-11-01T01:00:00Z',endsAt:'2026-11-01T01:30:00Z',price};
 vi.mocked(api.myAppointments).mockResolvedValue([original]);
 vi.mocked(api.getPendingHolds).mockResolvedValue([{hold:{holdId:'moving-hold',clinicId:'clinic-a',branchId:'branch-a',state:'ACTIVE',purpose:'RESCHEDULE',rescheduleAppointmentId:'original-a',expiresAt:new Date(Date.now()+600000).toISOString(),price},doctorId:'doctor-a',offeringId:'offering-a',startsAt:'2026-12-01T01:00:00Z',endsAt:'2026-12-01T01:30:00Z'}]);
 vi.mocked(api.rescheduleAppointment).mockResolvedValue({...original,startsAt:'2026-12-01T01:00:00Z'});
 await user.click(screen.getByRole('button',{name:'Tải giờ đang giữ'}));
 await user.click(await screen.findByRole('button',{name:/Tiếp tục đổi lịch/}));
 expect(await screen.findByRole('heading',{name:'Xác nhận giờ khám thay thế'})).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Xác nhận đổi lịch'}));
 await screen.findByText(/Đã đổi lịch: AP-ORIGINAL/);
 expect(api.rescheduleAppointment).toHaveBeenCalledWith('synthetic-token',{id:'original-a',clinicId:'clinic-a'},'patient-a','moving-hold');
 expect(api.confirmHold).not.toHaveBeenCalled();
});

it('opens upcoming appointments first and reviews cancellation before changing server state',async()=>{
 const appointment={id:'ap',appointmentCode:'AP-UPCOMING',clinicId:'clinic-a',status:'CONFIRMED',startsAt:'2026-12-01T01:00:00Z',endsAt:'2026-12-01T01:30:00Z',price};vi.mocked(api.myAppointments).mockResolvedValue([appointment]);
 const user=userEvent.setup();window.history.replaceState(null,'','/public/account');renderAuthenticatedPublic();
 await screen.findByRole('button',{name:'Lịch khám'});
 await screen.findByText('AP-UPCOMING');expect(screen.queryByLabelText('Họ tên người khám')).toBeNull();expect(screen.getByRole('button',{name:'Lịch khám'})).toHaveProperty('ariaPressed','true');
 await user.click(screen.getByRole('button',{name:'Hủy lịch'}));await screen.findByRole('dialog');expect(api.cancelAppointment).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Quay lại kiểm tra'}));expect(api.cancelAppointment).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Hủy lịch'}));vi.mocked(api.cancelAppointment).mockResolvedValue({...appointment,status:'CANCELLED'});vi.mocked(api.myAppointments).mockResolvedValue([{...appointment,status:'CANCELLED'}]);
 await user.click(screen.getByRole('button',{name:'Xác nhận hủy lịch'}));await screen.findByText('Đã hủy lịch AP-UPCOMING.');expect(api.cancelAppointment).toHaveBeenCalledTimes(1);
});
