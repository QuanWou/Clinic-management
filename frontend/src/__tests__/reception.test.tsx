// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {render,screen,cleanup,within,waitFor,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ReceptionPanel} from '../components/ReceptionPanel';
import * as api from '../api/reception';
import {signIn,RequestError} from '../api/booking';
vi.mock('../api/reception',()=>Object.fromEntries(['contexts','directory','doctors','offerings','offeringPrice','points','arrivals','recoverArrival','createPoint','recentPatients','suggestions','provisional','review','appointments','walkIn','checkIn','queuePage','move','readVisit','doctorAbsences','reportAbsence','applyAbsence','exceptions','recordException'].map(k=>[k,vi.fn()])));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID()),forgetOperationKey:vi.fn()}));
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
 vi.mocked(api.doctors).mockResolvedValue([{practitionerId:'doctor',displayName:'Synthetic Doctor',active:true,effectiveFrom:'2020-01-01',effectiveUntil:null}]);
 vi.mocked(api.offerings).mockResolvedValue([{offering:{id:'consult',name:'Consultation',active:true},active:true}]);
 vi.mocked(api.offeringPrice).mockResolvedValue({amountVnd:100000,priceVersionId:'price'});
 vi.mocked(api.points).mockResolvedValue([{id:'point',code:'R1',name:'Phòng 1',active:true}]);
 vi.mocked(api.arrivals).mockResolvedValue([]);vi.mocked(api.appointments).mockResolvedValue([appointment]);
 vi.mocked(api.recentPatients).mockResolvedValue([patient]);vi.mocked(api.suggestions).mockResolvedValue([patient]);
 vi.mocked(api.provisional).mockResolvedValue(patient);vi.mocked(api.exceptions).mockResolvedValue([]);
 vi.mocked(api.walkIn).mockResolvedValue(visit);vi.mocked(api.checkIn).mockResolvedValue({...visit,appointmentId:'booking'});
 vi.mocked(api.queuePage).mockResolvedValue({items:[ticket],nextAfterNumber:null});
});
afterEach(cleanup);
async function desk(){const user=userEvent.setup();render(<ReceptionPanel/>);await user.type(screen.getByLabelText('Email nhân viên'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu nhân viên'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tiếp nhận'}));await user.selectOptions(await screen.findByLabelText('Địa điểm tiếp nhận'),'branch');await screen.findByRole('button',{name:/Chọn lịch|Đã tiếp nhận/});return user;}
async function walk(){const user=await desk();await user.click(screen.getByRole('button',{name:'Khách đến trực tiếp'}));await user.click(await screen.findByRole('button',{name:'Chọn hồ sơ'}));await user.selectOptions(screen.getByLabelText('Bác sĩ phụ trách'),'doctor');await user.selectOptions(screen.getByLabelText('Dịch vụ bệnh nhân sử dụng'),'consult');await screen.findByText(/100.000/);expect(screen.getByLabelText('Phòng hoặc khu vực tiếp nhận')).toBeTruthy();return user;}
it('opens daily appointments automatically and checks in the selected appointment patient without a second lookup',async()=>{
 const user=await desk();expect(screen.queryByRole('button',{name:/Tải/})).toBeNull();expect(screen.queryByRole('heading',{name:'Xác nhận tiếp nhận'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'Chọn lịch'}));expect(api.checkIn).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 expect(api.checkIn).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic',branch:'branch'}),appointment,'patient','point','Tiếp nhận lịch hẹn tại quầy',expect.any(String));
 expect(api.walkIn).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Tiếp nhận & cấp số'})).toBeNull();expect(screen.getByRole('button',{name:'Tiếp nhận khách tiếp theo'}).classList.contains('button-secondary')).toBe(true);
});
it('does not offer a second check-in after an appointment has already been received',async()=>{
 const user=await desk();await user.click(screen.getByRole('button',{name:'Chọn lịch'}));
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 await user.click(screen.getByRole('button',{name:'Tiếp nhận khách tiếp theo'}));
 const received=screen.getByRole('button',{name:'Đã tiếp nhận'});expect(received).toHaveProperty('disabled',true);
 expect(screen.queryByRole('button',{name:'Tiếp nhận & cấp số'})).toBeNull();expect(api.checkIn).toHaveBeenCalledTimes(1);
});
it('loads recent patient rows and requires selection and service before walk-in',async()=>{
 const user=await walk();expect(api.recentPatients).toHaveBeenCalled();expect(api.walkIn).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Tiếp nhận & cấp số'}));await screen.findByText('Đã cấp số');
 expect(api.walkIn).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'patient','doctor','point','Tiếp nhận khách đến trực tiếp tại quầy',expect.any(String),'consult');
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
 const second={...ticket,id:'second',code:'R1-0002',number:2,state:'DONE'};
 vi.mocked(api.queuePage).mockResolvedValueOnce({items:[ticket],nextAfterNumber:1}).mockResolvedValue({items:[second],nextAfterNumber:null});
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
 const calledButton=screen.getByRole('button',{name:'Đã gọi R1-0001'}),otherButton=screen.getByRole('button',{name:'Gọi R1-0002'}),sameButton=screen.getByRole('button',{name:'Gọi R1-0003'});
 expect((calledButton as HTMLButtonElement).disabled).toBe(true);expect((otherButton as HTMLButtonElement).disabled).toBe(false);expect((sameButton as HTMLButtonElement).disabled).toBe(true);expect(sameButton.getAttribute('title')).toContain('R1-0001');
 expect(screen.getByText(/hàng đợi của bác sĩ khác vẫn hoạt động độc lập/)).toBeTruthy();
});
it('refreshes daily data when window regains focus',async()=>{
 await desk();const before=vi.mocked(api.appointments).mock.calls.length;fireEvent.focus(window);await waitFor(()=>expect(api.appointments).toHaveBeenCalledTimes(before+1));
 await screen.findByText(/Đã cập nhật/);
});
it('shows arrival time and an explicit empty state when the doctor filter has no matching tickets',async()=>{
 vi.mocked(api.queuePage).mockResolvedValue({items:[{...ticket,doctorId:'another-doctor',checkedInAt:'2026-10-04T03:15:00Z'}],nextAfterNumber:null});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));
 expect(screen.getByText('10:15')).toBeTruthy();
 await user.selectOptions(screen.getByLabelText('Bác sĩ trong hàng đợi'),'doctor');
 expect(screen.getByText('Không có bệnh nhân phù hợp trong hàng đợi.')).toBeTruthy();
});
it('labels closed historical visits and recovers pending arrivals without new visits',async()=>{
 const pending={id:'pending',appointmentId:'booking',status:'ARRIVAL_PENDING',version:0,ticket:null};
 vi.mocked(api.arrivals).mockResolvedValue([{operation:'check-in',createdAt:new Date().toISOString(),visit:pending},{operation:'walk-in',createdAt:new Date().toISOString(),visit:{...visit,id:'closed',status:'CLOSED',ticket:null}}]);
 vi.mocked(api.recoverArrival).mockResolvedValue({...pending,status:'WAITING',ticket});const user=await desk();await user.click(screen.getByRole('button',{name:'Lịch sử tiếp nhận'}));
 await screen.findByRole('heading',{name:'Lượt đã đóng'});await user.type(screen.getByLabelText('Lý do tiếp nhận hoặc điều phối'),'Review pending');
 await user.click(screen.getByRole('button',{name:'Tiếp tục tiếp nhận lịch đang chờ'}));await screen.findByText(/Đã xác nhận lượt tiếp nhận đã ghi/);
 expect(api.walkIn).not.toHaveBeenCalled();expect(api.checkIn).not.toHaveBeenCalled();
});
it('reads the current visit after transferring rather than retaining the old ticket',async()=>{
 vi.mocked(api.points).mockResolvedValue([{id:'point',code:'R1',name:'Phòng 1',active:true},{id:'point-2',code:'R2',name:'Phòng 2',active:true}]);
 const user=await desk();await user.click(screen.getByRole('button',{name:'Hàng đợi'}));await user.click(screen.getByText('Lý do điều phối & chuyển phòng'));
 expect(screen.getByRole('button',{name:'Bỏ qua'}).classList.contains('button-secondary')).toBe(true);expect(screen.getByRole('button',{name:'Chuyển phòng'}).classList.contains('button-secondary')).toBe(true);
 await user.type(screen.getByLabelText('Lý do tiếp nhận hoặc điều phối'),'Transfer');await user.selectOptions(screen.getByLabelText('Chuyển đến điểm phục vụ'),'point-2');
 vi.mocked(api.move).mockResolvedValue({...ticket,state:'TRANSFERRED'});vi.mocked(api.readVisit).mockResolvedValue({...visit,ticket:{...ticket,code:'R2-0001'}});
 await user.click(screen.getByRole('button',{name:'Chuyển phòng'}));await screen.findByText(/Lượt tiếp nhận: Chờ khám · R2-0001/);expect(api.readVisit).toHaveBeenCalled();
});
