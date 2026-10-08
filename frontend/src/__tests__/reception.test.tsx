// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,cleanup,within,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ReceptionPanel} from '../components/ReceptionPanel';
import * as api from '../api/reception';
import {signIn,RequestError} from '../api/booking';
vi.mock('../api/reception',()=>Object.fromEntries(['workload','requests','openExceptions','appointmentDetail','createRequest','changeHold','changeAppointment','contexts','directory','doctors','offerings','offeringPrice','points','arrivals','recoverArrival','createPoint','recentPatients','suggestions','provisional','review','appointments','walkIn','checkIn','queuePage','move','readVisit','doctorAbsences','reportAbsence','applyAbsence','exceptions','recordException'].map(k=>[k,vi.fn()])));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID()),forgetOperationKey:vi.fn()}));
vi.mock('../api/realtime',async original=>({...await original<typeof import('../api/realtime')>(),subscribeRealtime:vi.fn((_subscription,onChange,onState)=>{onState('connected');onChange();return()=>{};})}));
vi.mock('../components/AbsenceLifecyclePanel',()=>({AbsenceLifecyclePanel:()=>null}));
vi.mock('../components/SupervisorArrivalPanel',()=>({SupervisorArrivalPanel:()=>null}));
vi.mock('../components/OvernightQueuePanel',()=>({OvernightQueuePanel:()=>null}));
const patient={patientId:'patient',clinicPatientLinkId:'link',patientCode:'PT-SYN',fullName:'Synthetic Patient',dateOfBirth:'2000-01-01',phoneLast4:'4567',status:'VERIFIED',version:0};
const ticket={id:'ticket',visitId:'visit',servicePointId:'point',date:'2026-10-01',number:1,code:'R1-0001',state:'WAITING',version:0,patient,doctorId:'doctor'};
const visit={id:'visit',appointmentId:null,status:'WAITING',version:0,ticket};
const appointment={id:'booking',appointmentCode:'AP-001',patientId:'patient',startsAt:'2026-10-04T03:00:00Z',status:'CONFIRMED',patient};
beforeEach(()=>{
 vi.resetAllMocks();
 vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});
 vi.mocked(api.contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1}]);
 vi.mocked(api.directory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]});
 vi.mocked(api.doctors).mockResolvedValue([{practitionerId:'doctor',displayName:'Synthetic Doctor',specialtyCode:'GENERAL',specialtyName:'Nội tổng quát',active:true,effectiveFrom:'2020-01-01',effectiveUntil:null}]);
 vi.mocked(api.offerings).mockResolvedValue([{offering:{id:'consult',name:'Consultation',specialtyCode:'GENERAL',active:true},active:true}]);
 vi.mocked(api.offeringPrice).mockResolvedValue({amountVnd:100000,priceVersionId:'price'});
 vi.mocked(api.points).mockResolvedValue([{id:'point',code:'R1',name:'Phòng 1',active:true}]);
 vi.mocked(api.workload).mockResolvedValue([]);vi.mocked(api.requests).mockResolvedValue([]);vi.mocked(api.openExceptions).mockResolvedValue([]);vi.mocked(api.appointmentDetail).mockResolvedValue({...appointment,clinicId:'clinic',branchId:'branch',doctorId:'doctor',offeringId:'consult',price:{amountVnd:100000},version:0});
 vi.mocked(api.arrivals).mockResolvedValue([]);vi.mocked(api.appointments).mockResolvedValue([appointment]);
 vi.mocked(api.recentPatients).mockResolvedValue([patient]);vi.mocked(api.suggestions).mockResolvedValue([patient]);
 vi.mocked(api.provisional).mockResolvedValue(patient);vi.mocked(api.exceptions).mockResolvedValue([]);
 vi.mocked(api.walkIn).mockResolvedValue(visit);vi.mocked(api.checkIn).mockResolvedValue({...visit,appointmentId:'booking'});
 vi.mocked(api.queuePage).mockResolvedValue({items:[ticket],nextAfterNumber:null});
});
afterEach(cleanup);
async function desk(){const user=userEvent.setup();render(<ReceptionPanel/>);await user.type(screen.getByLabelText('Email nhân viên'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu nhân viên'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tiếp nhận'}));await user.selectOptions(await screen.findByLabelText('Địa điểm tiếp nhận'),'branch');await screen.findByRole('button',{name:/Chọn lịch|Đã tiếp nhận/});return user;}
async function walk(){const user=await desk();await user.click(screen.getByRole('button',{name:'Khách đến trực tiếp'}));await user.click(await screen.findByRole('button',{name:'Chọn hồ sơ'}));await user.selectOptions(screen.getByLabelText('Chuyên khoa tiếp nhận'),'GENERAL');await user.selectOptions(screen.getByLabelText('Dịch vụ bệnh nhân sử dụng'),'consult');await screen.findByText(/100.000/);expect(screen.getByLabelText('Phòng hoặc khu vực tiếp nhận')).toBeTruthy();return user;}
it('places a reissued ticket after later arrivals using authoritative ticket issuance time',async()=>{
 vi.mocked(api.queuePage).mockResolvedValue({items:[{...ticket,id:'returned',code:'RETURNED',number:3,checkedInAt:'2026-10-06T01:00:00Z',issuedAt:'2026-10-06T04:00:00Z'},{...ticket,id:'new-arrival',code:'NEW-ARRIVAL',number:2,checkedInAt:'2026-10-06T03:00:00Z',issuedAt:'2026-10-06T03:00:00Z'}],nextAfterNumber:null});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 const rows=within(screen.getByRole('table',{name:'Danh sách hàng đợi'})).getAllByRole('row');expect(rows[1].textContent).toContain('NEW-ARRIVAL');expect(rows[2].textContent).toContain('RETURNED');
});
it('opens daily appointments automatically and checks in the selected appointment patient without a second lookup',async()=>{
 const user=await desk();expect(screen.queryByRole('button',{name:/Tải/})).toBeNull();expect(screen.queryByRole('heading',{name:'Xác nhận tiếp nhận'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'Chọn lịch'}));expect(api.checkIn).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 expect(api.checkIn).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic',branch:'branch'}),appointment,'patient','point','Tiếp nhận lịch hẹn tại quầy',expect.any(String));
 expect(api.walkIn).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Tiếp nhận & cấp số'})).toBeNull();expect(screen.getByRole('button',{name:'Tiếp nhận khách tiếp theo'}).classList.contains('button-secondary')).toBe(true);
});
it('does not offer a second check-in after an appointment has already been received',async()=>{
 const user=await desk();await user.click(screen.getByRole('button',{name:'Chọn lịch'}));
 vi.mocked(api.appointments).mockResolvedValue([{...appointment,status:'CHECKED_IN'}]);
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 await user.click(screen.getByRole('button',{name:'Tiếp nhận khách tiếp theo'}));
 const received=screen.getByRole('button',{name:'Đã tiếp nhận'});expect(received).toHaveProperty('disabled',true);
 expect(screen.queryByRole('button',{name:'Tiếp nhận & cấp số'})).toBeNull();expect(api.checkIn).toHaveBeenCalledTimes(1);
});
it('loads recent patient rows and requires selection and service before walk-in',async()=>{
 const user=await walk();expect(api.recentPatients).toHaveBeenCalled();expect(api.walkIn).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 expect(api.walkIn).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'patient','','point','Tiếp nhận khách đến trực tiếp tại quầy',expect.any(String),'consult');
 await user.click(screen.getByRole('button',{name:'Tiếp nhận khách tiếp theo'}));expect(screen.queryByRole('heading',{name:'Xác nhận tiếp nhận'})).toBeNull();
});
it('retries an uncertain walk-in with exactly the same payload and key',async()=>{
 vi.mocked(api.walkIn).mockRejectedValueOnce(new Error('Lost response'));const user=await walk();
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByRole('alert');
 expect(screen.getByLabelText('Lý do đến khám').closest('fieldset')).toHaveProperty('disabled',true);
 await user.click(screen.getByRole('button',{name:'Thử lại lượt tiếp nhận đang chờ'}));await screen.findByText('Đã cấp số');
 expect(vi.mocked(api.walkIn).mock.calls[0]).toEqual(vi.mocked(api.walkIn).mock.calls[1]);
});
it('retries uncertain appointment arrival without changing appointment or key',async()=>{
 vi.mocked(api.checkIn).mockRejectedValueOnce(new Error('Lost response'));const user=await desk();await user.click(screen.getByRole('button',{name:'Chọn lịch'}));
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Khách đến trực tiếp'}).closest('fieldset')).toHaveProperty('disabled',true);expect(screen.getByRole('button',{name:'Thử lại tiếp nhận lịch đang chờ'}).classList.contains('booking-primary')).toBe(true);
 await user.click(screen.getByRole('button',{name:'Thử lại tiếp nhận lịch đang chờ'}));await screen.findByText('Đã cấp số');
 expect(vi.mocked(api.checkIn).mock.calls[0]).toEqual(vi.mocked(api.checkIn).mock.calls[1]);
});
it('keeps an acknowledged arrival if queue refresh fails',async()=>{
 const user=await walk();vi.mocked(api.queuePage).mockRejectedValueOnce(new RequestError('Queue unavailable',503));
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByRole('alert');expect(screen.getByText('Đã cấp số')).toBeTruthy();
 expect(api.walkIn).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:'Thử lại lượt tiếp nhận đang chờ'})).toBeNull();
});
it('loads all queue pages automatically and supports filtering',async()=>{
 const second={...ticket,id:'second',code:'R1-0002',number:2,state:'CALLED',doctorId:'doctor-2'};
 vi.mocked(api.queuePage).mockImplementation(async(_scope,_point,_date,after)=>after?{items:[second],nextAfterNumber:null}:{items:[ticket],nextAfterNumber:1});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 const table=screen.getByRole('table',{name:'Danh sách hàng đợi'});expect(within(table).getByText('R1-0001')).toBeTruthy();expect(within(table).getByText('R1-0002')).toBeTruthy();
 expect(vi.mocked(api.queuePage).mock.calls[1][3]).toBe(1);expect(screen.queryByRole('button',{name:/Tải/})).toBeNull();
 await user.selectOptions(screen.getByLabelText('Trạng thái'),'WAITING');expect(within(table).queryByText('R1-0002')).toBeNull();
});
it('keeps each doctor queue independent while blocking the next ticket of the same doctor',async()=>{
 const called={...ticket,date:'2026-10-04',state:'CALLED'};
 const otherDoctor={...ticket,id:'other',visitId:'visit-other',date:'2026-10-04',number:2,code:'R1-0002',state:'WAITING',doctorId:'doctor-2'};
 const sameDoctor={...ticket,id:'same',visitId:'visit-same',date:'2026-10-04',number:3,code:'R1-0003',state:'WAITING'};
 vi.mocked(api.queuePage).mockResolvedValue({items:[called,otherDoctor,sameDoctor],nextAfterNumber:null});const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 const calledButton=screen.getByRole('button',{name:'Gọi lại'}),otherButton=screen.getByRole('button',{name:'Gọi R1-0002'}),sameButton=screen.getByRole('button',{name:'Gọi R1-0003'});
 expect((calledButton as HTMLButtonElement).disabled).toBe(false);expect((otherButton as HTMLButtonElement).disabled).toBe(false);expect((sameButton as HTMLButtonElement).disabled).toBe(true);expect(sameButton.getAttribute('title')).toContain('R1-0001');
 expect(screen.getByText(/Hàng đợi của bác sĩ khác vẫn hoạt động độc lập/)).toBeTruthy();
});
it('refreshes daily data when window regains focus',async()=>{
 await desk();const before=vi.mocked(api.appointments).mock.calls.length;fireEvent.focus(window);await waitFor(()=>expect(vi.mocked(api.appointments).mock.calls.length).toBeGreaterThan(before));
 await screen.findByText(/Đã cập nhật/);
});
it('shows arrival time and an explicit empty state when the doctor filter has no matching tickets',async()=>{
 vi.mocked(api.queuePage).mockResolvedValue({items:[{...ticket,doctorId:'another-doctor',checkedInAt:'2026-10-04T03:15:00Z'}],nextAfterNumber:null});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 expect(screen.getByText('Đến 10:15')).toBeTruthy();
 await user.selectOptions(screen.getByLabelText('Bác sĩ trong hàng đợi'),'doctor');
 expect(screen.getByText('Hiện không có bệnh nhân đang chờ phù hợp tại điểm phục vụ này.')).toBeTruthy();
});
it('keeps history secondary and reads shared closed visits without replaying intake',async()=>{
 vi.mocked(api.workload).mockResolvedValue([{operation:'walk-in',createdAt:new Date().toISOString(),visit:{...visit,id:'closed',status:'CLOSED',ticket:null,patient}}]);
 vi.mocked(api.readVisit).mockResolvedValue({...visit,id:'closed',status:'CLOSED',ticket:null,patient});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Lịch sử'}));
 await screen.findByRole('heading',{name:'Lượt đã đóng'});await user.click(screen.getByRole('button',{name:'Xem trạng thái từ máy chủ'}));
 await waitFor(()=>expect(api.readVisit).toHaveBeenCalled());expect(api.walkIn).not.toHaveBeenCalled();expect(api.checkIn).not.toHaveBeenCalled();
});
it('routes post-check-in reassignment to a persisted Admin request without exposing a transfer control',async()=>{
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 expect(screen.queryByRole('button',{name:'Chuyển phòng'})).toBeNull();
 await user.click(screen.getByText('Yêu cầu đổi bác sĩ / chuyên khoa'));
 expect(screen.getByText(/Lễ tân không có quyền điều chuyển bác sĩ/)).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Tạo yêu cầu xử lý'}));
 expect(screen.getByLabelText('Điều gì đã xảy ra?')).toHaveProperty('value','Bệnh nhân yêu cầu đổi bác sĩ sau khi đã vào hàng đợi');
 vi.mocked(api.createRequest).mockResolvedValue({id:'request',visitId:'visit',patientId:'patient',type:'DOCTOR_CHANGE',reason:'Patient requested',state:'OPEN',actorUserId:'staff',createdAt:new Date().toISOString()});
 await user.click(screen.getByRole('button',{name:'Gửi yêu cầu xử lý'}));
 await waitFor(()=>expect(api.createRequest).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({visitId:'visit',type:'DOCTOR_CHANGE'}),expect.any(String)));
 expect(api.move).not.toHaveBeenCalled();
});
it('shows current workloads from real states and current wait duration',async()=>{
 vi.mocked(api.queuePage).mockResolvedValue({items:[{...ticket,checkedInAt:new Date(Date.now()-23*60000).toISOString()},{...ticket,id:'called',code:'R1-0002',doctorId:'doctor-2',state:'CALLED'}],nextAfterNumber:null});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 expect(screen.getByText('Đã chờ 23 phút')).toBeTruthy();
 const summary=screen.getByLabelText('Công việc đang chờ');expect(within(summary).getByRole('button',{name:/Chờ tiếp nhận\s*1/})).toBeTruthy();expect(within(summary).getByRole('button',{name:/Đang chờ khám\s*1/})).toBeTruthy();expect(within(summary).getByRole('button',{name:/Đã gọi \/ chưa vào\s*1/})).toBeTruthy();
});
it('offers the backend absence and return-to-end transitions',async()=>{
 vi.mocked(api.queuePage).mockResolvedValue({items:[{...ticket,state:'ABSENT'}],nextAfterNumber:null});
 vi.mocked(api.move).mockResolvedValue({...ticket,state:'TRANSFERRED'});vi.mocked(api.readVisit).mockResolvedValue(visit);
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));await user.type(screen.getByLabelText('Lý do thao tác hàng đợi'),'Patient returned');
 await user.click(screen.getByRole('button',{name:'Đưa lại cuối hàng'}));await waitFor(()=>expect(api.move).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({state:'ABSENT'}),'requeue',expect.stringContaining('Patient returned'),undefined));
});
