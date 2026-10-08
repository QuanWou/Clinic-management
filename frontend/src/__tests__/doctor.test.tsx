// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {DoctorPanel} from '../components/DoctorPanel';
import * as care from '../api/care';
import * as medical from '../api/medical';
import {contexts,type Visit} from '../api/reception';
import {signIn,RequestError} from '../api/booking';

vi.mock('../api/care',()=>({directory:vi.fn(),worklist:vi.fn(),worklistPage:vi.fn(),command:vi.fn()}));
vi.mock('../api/medical',()=>({worklistSummaries:vi.fn()}));
vi.mock('../components/MedicalPanel',()=>({MedicalPanel:()=>null}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID())}));

const ticket=(code='R1-20261001-0001',state='CALLED',id='ticket')=>({id,visitId:'visit',servicePointId:'point',date:'2026-10-01',number:1,code,state,version:1});
const visit:Visit={id:'visit',appointmentId:null,status:'WAITING',version:1,ticket:ticket(),patient:{patientId:'patient',patientCode:'BN000001',fullName:'Nguyễn An',dateOfBirth:'1990-01-01'},consultation:null};

beforeEach(()=>{
 vi.resetAllMocks();
 vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}]);
 vi.mocked(care.directory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true},{id:'other',name:'Other granted branch',active:true}]});
 vi.mocked(care.worklist).mockResolvedValue([visit]);
 vi.mocked(medical.worklistSummaries).mockResolvedValue([]);
});
afterEach(cleanup);

async function login(){
 const user=userEvent.setup();render(<DoctorPanel/>);
 await user.type(screen.getByLabelText('Email bác sĩ'),'synthetic@example.invalid');
 await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'synthetic-password');
 await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));
 await user.selectOptions(await screen.findByLabelText('Địa điểm khám'),'branch');
 await screen.findByLabelText('Tìm trong hàng đợi');
 return user;
}

it('pages the operational worklist without duplicating the cursor row',async()=>{
 const rows=[visit,...Array.from({length:199},(_,n)=>({...visit,id:'visit-'+n,ticket:{...ticket('Q-'+n,'CALLED','t-'+n),visitId:'visit-'+n}}))];
 vi.mocked(care.worklist).mockResolvedValue(rows);
 const extra={...visit,id:'extra',ticket:{...ticket('EXTRA','CALLED','extra-ticket'),visitId:'extra'}};
 vi.mocked(care.worklistPage).mockRejectedValueOnce(new Error('Synthetic page unavailable')).mockResolvedValueOnce({items:[rows.at(-1)!,extra],nextAfter:null});
 const user=await login();
 await user.click(screen.getByRole('button',{name:'Tải thêm lượt khám'}));await screen.findByRole('alert');
 expect(screen.getAllByRole('button',{name:/Xem chi tiết/})).toHaveLength(200);
 await user.click(screen.getByRole('button',{name:'Tải thêm lượt khám'}));
 await screen.findByRole('button',{name:'Xem chi tiết EXTRA'});
 expect(screen.getAllByRole('button',{name:/Xem chi tiết/})).toHaveLength(201);
 expect(screen.queryByRole('button',{name:'Tải thêm lượt khám'})).toBeNull();
 expect(vi.mocked(care.worklistPage).mock.calls[0]).toEqual(vi.mocked(care.worklistPage).mock.calls[1]);
},15000);

it('starts care, releases the active slot while awaiting results, then requeues the same encounter when results arrive',async()=>{
 const active={...visit,status:'IN_PROGRESS',version:2,ticket:{...ticket(),state:'SERVING'}} as Visit;
 const waiting={...visit,status:'AWAITING_RESULTS',version:3,ticket:null} as Visit;
 const resumed={...waiting,version:4,ticket:ticket('R1-20261001-0002','WAITING','return-ticket')} as Visit;
 vi.mocked(care.worklist).mockResolvedValueOnce([visit]).mockResolvedValueOnce([active]).mockResolvedValueOnce([waiting]).mockResolvedValueOnce([resumed]);
 vi.mocked(medical.worklistSummaries)
  .mockResolvedValueOnce([])
  .mockResolvedValueOnce([])
  .mockResolvedValueOnce([{encounterId:'visit',pendingOrderCount:0,unreviewedResultCount:1,latestResultAt:'2026-10-01T08:30:00Z',latestResultName:'Công thức máu'}])
  .mockResolvedValueOnce([]);
 vi.mocked(care.command).mockResolvedValueOnce(active).mockResolvedValueOnce(waiting).mockResolvedValueOnce(resumed);
 const user=await login();
 await user.click(screen.getByRole('button',{name:'Bắt đầu khám R1-20261001-0001'}));
 await screen.findByText('Đã bắt đầu hoặc tiếp tục khám.');
 await user.click(screen.getByRole('button',{name:'Chuyển sang chờ kết quả'}));
 await screen.findByText('Đã chuyển sang chờ kết quả và nhường lượt khám hiện tại.');
 expect(await screen.findByRole('heading',{name:'Có kết quả mới'})).toBeTruthy();
 expect(screen.getByText('Chưa được bác sĩ xem xét')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Tiếp tục xử lý Nguyễn An'}));
 await screen.findByText('Đã đưa lượt có kết quả trở lại hàng đợi để tiếp tục xử lý.');
 expect(vi.mocked(care.command).mock.calls.map(x=>[x[1],x[2],x[3].expectedVersion])).toEqual([
  ['visit','start',1],['visit','await-results',2],['visit','resume-queue',3]
 ]);
 expect(vi.mocked(care.command).mock.calls[2][3]).not.toHaveProperty('servicePointId');
});

it('keeps an uncertain care command frozen and retries the exact same payload and idempotency key',async()=>{
 const active={...visit,status:'IN_PROGRESS',version:2,ticket:{...ticket(),state:'SERVING'}} as Visit;
 vi.mocked(care.command).mockRejectedValueOnce(new Error('Synthetic response lost')).mockResolvedValueOnce(active);
 vi.mocked(care.worklist).mockResolvedValueOnce([visit]).mockResolvedValueOnce([active]);
 const user=await login();
 await user.click(screen.getByRole('button',{name:'Bắt đầu khám R1-20261001-0001'}));
 await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Thử lại thao tác khám đang chờ'})).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Thử lại thao tác khám đang chờ'}));
 await screen.findByText('Đã bắt đầu hoặc tiếp tục khám.');
 expect(vi.mocked(care.command).mock.calls[0]).toEqual(vi.mocked(care.command).mock.calls[1]);
});

it('disables starting or calling another patient while one encounter is active',async()=>{
 const active={...visit,id:'active',status:'IN_PROGRESS',version:2,ticket:{...ticket('ACTIVE','SERVING','active-ticket'),visitId:'active'}} as Visit;
 const waiting={...visit,id:'waiting',ticket:{...ticket('WAITING','WAITING','waiting-ticket'),visitId:'waiting'}} as Visit;
 vi.mocked(care.worklist).mockResolvedValue([active,waiting]);
 const user=await login();
 const call=screen.getByRole('button',{name:'Chờ lượt trước WAITING'});
 expect(call).toHaveProperty('disabled',true);
 await user.click(screen.getByRole('button',{name:'Xem chi tiết WAITING'}));
 expect(screen.getByText(/Đang có một bệnh nhân được khám/)).toBeTruthy();
});

it('closes a clinically completed encounter and releases the worklist for the next patient',async()=>{
 const completed={...visit,status:'CLINICALLY_COMPLETED',version:7,ticket:null} as Visit;
 const closed={...completed,status:'CLOSED',version:8} as Visit;
 vi.mocked(care.worklist).mockResolvedValueOnce([completed]).mockResolvedValueOnce([]);
 vi.mocked(care.command).mockResolvedValue(closed);
 const user=await login();
 const close=await screen.findByRole('button',{name:'Đóng lượt khám Nguyễn An'});expect(close).toHaveProperty('disabled',false);
 await user.click(close);await screen.findByText('Đã đóng lượt khám. Có thể gọi bệnh nhân tiếp theo.');
 expect(care.command).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic',branch:'branch'}),'visit','close',{expectedVersion:7,reason:'Bác sĩ đóng lượt sau khi hoàn tất chuyên môn'},expect.any(String));
 expect(screen.queryByText('Nguyễn An')).toBeNull();
});
it('groups an awaiting encounter with an unreviewed result as Có kết quả mới',async()=>{
 const waiting={...visit,status:'AWAITING_RESULTS',ticket:null} as Visit;
 vi.mocked(care.worklist).mockResolvedValue([waiting]);
 vi.mocked(medical.worklistSummaries).mockResolvedValue([{encounterId:'visit',pendingOrderCount:0,unreviewedResultCount:1,latestResultAt:'2026-10-01T08:00:00Z',latestResultName:'X-quang ngực'}]);
 await login();
 expect(screen.getByRole('heading',{name:'Có kết quả mới'})).toBeTruthy();
 expect(screen.getByText('X-quang ngực')).toBeTruthy();
 expect(screen.getByText('Chưa được bác sĩ xem xét')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Tiếp tục xử lý Nguyễn An'})).toBeTruthy();
});

it('searches only the loaded worklist without issuing another worklist request',async()=>{
 const other={...visit,id:'other',patient:{...visit.patient!,fullName:'Trần Bình'},ticket:{...ticket('R1-OTHER','WAITING','other-ticket'),visitId:'other'}} as Visit;
 vi.mocked(care.worklist).mockResolvedValue([visit,other]);
 const user=await login();
 expect(care.worklist).toHaveBeenCalledTimes(1);
 await user.type(screen.getByLabelText('Tìm trong hàng đợi'),'Trần Bình');
 expect(screen.queryByText('Nguyễn An')).toBeNull();
 expect(screen.getByText('Trần Bình')).toBeTruthy();
 expect(care.worklist).toHaveBeenCalledTimes(1);
 await user.clear(screen.getByLabelText('Tìm trong hàng đợi'));
 expect(screen.getByText('Nguyễn An')).toBeTruthy();
});

it('refreshes after an authoritative care conflict instead of continuing from stale state',async()=>{
 vi.mocked(care.command).mockRejectedValueOnce(new RequestError('Synthetic stale version',409));
 vi.mocked(care.worklist).mockResolvedValueOnce([visit]).mockResolvedValueOnce([visit]);
 const user=await login();
 await user.click(screen.getByRole('button',{name:'Bắt đầu khám R1-20261001-0001'}));
 expect((await screen.findByRole('alert')).textContent).toContain('Synthetic stale version');
 expect(care.worklist).toHaveBeenCalledTimes(2);
 expect(screen.getByRole('button',{name:'Bắt đầu khám R1-20261001-0001'})).toBeTruthy();
});

it('rejects a non-doctor session before loading the doctor directory or worklist',async()=>{
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}]);
 const user=userEvent.setup();render(<DoctorPanel/>);
 await user.type(screen.getByLabelText('Email bác sĩ'),'owner@example.invalid');
 await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'synthetic-password');
 await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));
 await screen.findByRole('alert');
 expect(care.directory).not.toHaveBeenCalled();
 expect(care.worklist).not.toHaveBeenCalled();
 expect((screen.getByLabelText('Mật khẩu bác sĩ') as HTMLInputElement).value).toBe('');
});
