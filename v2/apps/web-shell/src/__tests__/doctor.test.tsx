// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DoctorPanel } from '../components/DoctorPanel';
import * as care from '../api/care';
import { contexts } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
vi.mock('../api/care',()=>({directory:vi.fn(),worklist:vi.fn(),worklistPage:vi.fn(),points:vi.fn(),command:vi.fn()}));
vi.mock('../components/MedicalPanel',()=>({MedicalPanel:()=>null}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID())}));
const ticket={id:'ticket',visitId:'visit',servicePointId:'point',date:'2026-10-01',number:1,code:'R1-20261001-0001',state:'CALLED',version:1};
const visit={id:'visit',appointmentId:null,status:'WAITING',version:1,ticket};
beforeEach(()=>{
 vi.resetAllMocks();vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}]);
 vi.mocked(care.directory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true},{id:'other',name:'Other granted branch',active:true}]});
 vi.mocked(care.points).mockResolvedValue([{id:'point',code:'R1',name:'Synthetic Room',active:true}]);vi.mocked(care.worklist).mockResolvedValue([visit]);
});
afterEach(cleanup);
it('continues a 200-row worklist, retains a failed read cursor and deduplicates refreshed rows',async()=>{
 const rows=[visit,...Array.from({length:199},(_,n)=>({...visit,id:'visit-'+n,ticket:{...ticket,code:'Q-'+n}}))];vi.mocked(care.worklist).mockResolvedValue(rows);
 const extra={...visit,id:'extra',ticket:{...ticket,code:'EXTRA'}};
 vi.mocked(care.worklistPage).mockRejectedValueOnce(new Error('Synthetic page unavailable')).mockResolvedValueOnce({items:[rows.at(-1)!,extra],nextAfter:null});
 const user=await desk();await user.click(screen.getByRole('button',{name:'Tải thêm lượt khám'}));await screen.findByRole('alert');expect(screen.getAllByRole('button',{name:/Chọn lượt/})).toHaveLength(200);
 await user.click(screen.getByRole('button',{name:'Tải thêm lượt khám'}));await screen.findByRole('button',{name:'Chọn lượt EXTRA'});expect(screen.getAllByRole('button',{name:/Chọn lượt/})).toHaveLength(201);expect(screen.queryByRole('button',{name:'Tải thêm lượt khám'})).toBeNull();expect(vi.mocked(care.worklistPage).mock.calls[0]).toEqual(vi.mocked(care.worklistPage).mock.calls[1]);
});
it('clears old care data when the next page is authoritatively denied',async()=>{
 vi.mocked(care.worklist).mockResolvedValue([visit,...Array.from({length:199},(_,n)=>({...visit,id:'visit-'+n,ticket:{...ticket,code:'Q-'+n}}))]);vi.mocked(care.worklistPage).mockRejectedValue(new RequestError('Synthetic revoked page',403));
 const user=await desk();await user.click(screen.getByRole('button',{name:'Tải thêm lượt khám'}));await screen.findByText(/đối chiếu quyền và dữ liệu/);expect(screen.queryByRole('button',{name:/Chọn lượt/})).toBeNull();expect(screen.queryByText('Lượt đang chọn')).toBeNull();
});
async function desk(){
 const user=userEvent.setup();render(<DoctorPanel/>);await user.type(screen.getByLabelText('Email bác sĩ'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));
 await user.selectOptions(await screen.findByLabelText('Địa điểm khám'),'branch');await user.click(await screen.findByRole('button',{name:'Chọn lượt R1-20261001-0001'}));return user;
}
it('starts, waits and requeues the same encounter without creating an arrival',async()=>{
 vi.mocked(care.command).mockResolvedValueOnce({...visit,status:'IN_PROGRESS',version:2,ticket:{...ticket,state:'SERVING'}}).mockResolvedValueOnce({...visit,status:'AWAITING_RESULTS',version:3,ticket:null}).mockResolvedValueOnce({...visit,status:'AWAITING_RESULTS',version:4,ticket:{...ticket,id:'return-ticket',state:'WAITING'}});
 const user=await desk();expect((screen.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}) as HTMLButtonElement).disabled).toBe(true);
 await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Synthetic start');await user.click(screen.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}));await screen.findByText('Đã bắt đầu hoặc tiếp tục khám.');
 await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Synthetic pending results');await user.click(screen.getByRole('button',{name:'Chuyển sang chờ kết quả'}));await screen.findByText('Đã chuyển sang chờ kết quả và nhường điểm phục vụ.');
 await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Synthetic review');await user.selectOptions(screen.getByLabelText('Điểm phục vụ khi quay lại'),'point');await user.click(screen.getByRole('button',{name:'Đưa lại vào hàng đợi'}));
 await screen.findByText('Đã đưa lượt khám trở lại hàng đợi. Chờ tiếp nhận gọi lượt.');expect(screen.queryByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'})).toBeNull();
 expect(vi.mocked(care.command).mock.calls.map(x=>[x[1],x[2],x[3].expectedVersion])).toEqual([['visit','start',1],['visit','await-results',2],['visit','resume-queue',3]]);
 expect(vi.mocked(care.command).mock.calls[2][3].servicePointId).toBe('point');
});
it('freezes an uncertain command and retries its exact original key and payload',async()=>{
 vi.mocked(care.command).mockRejectedValueOnce(new Error('Synthetic response lost')).mockResolvedValueOnce({...visit,status:'IN_PROGRESS',version:2,ticket:{...ticket,state:'SERVING'}});
 const user=await desk();await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Original reason');await user.click(screen.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}));await screen.findByRole('alert');
 expect((screen.getByLabelText('Lý do chuyển trạng thái khám') as HTMLTextAreaElement).closest('fieldset')?.disabled).toBe(true);
 await user.click(screen.getByRole('button',{name:'Tải lại danh sách khám'}));await screen.findByText(/Chưa nhận được xác nhận/);
 await user.click(screen.getByRole('button',{name:'Thử lại thao tác khám đang chờ'}));await screen.findByText('Đã bắt đầu hoặc tiếp tục khám.');expect(vi.mocked(care.command).mock.calls[0]).toEqual(vi.mocked(care.command).mock.calls[1]);
});
it('requires reload after authoritative conflict and hides stale worklist on branch load failure',async()=>{
 vi.mocked(care.command).mockRejectedValueOnce(new RequestError('Synthetic stale version',409));const user=await desk();await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Start stale');await user.click(screen.getByRole('button',{name:'Bắt đầu hoặc tiếp tục khám'}));
 await screen.findByText(/Tải lại danh sách trước khi thao tác tiếp/);expect(screen.queryByRole('button',{name:'Chọn lượt R1-20261001-0001'})).toBeNull();
 vi.mocked(care.worklist).mockRejectedValueOnce(new RequestError('Synthetic revoked branch',403));await user.selectOptions(screen.getByLabelText('Địa điểm khám'),'other');await screen.findByText('Synthetic revoked branch');expect(screen.queryByText('Lượt đang chọn')).toBeNull();
});
it('closes a completed encounter and recovers its lost acknowledgement with the original version and key',async()=>{
 vi.mocked(care.worklist).mockResolvedValue([{...visit,status:'CLINICALLY_COMPLETED',version:8}]);
 vi.mocked(care.command).mockRejectedValueOnce(new Error('Synthetic closure acknowledgement lost')).mockResolvedValueOnce({...visit,status:'CLOSED',version:9,ticket:null});
 const user=await desk();await user.type(screen.getByLabelText('Lý do chuyển trạng thái khám'),'Synthetic closure');await user.click(screen.getByRole('button',{name:'Đóng lượt khám'}));await screen.findByRole('alert');
 await user.click(screen.getByRole('button',{name:'Thử lại thao tác khám đang chờ'}));await screen.findByText('Đã đóng lượt khám. Thanh toán và phát hành hồ sơ được theo dõi riêng.');
 expect(vi.mocked(care.command).mock.calls[0]).toEqual(vi.mocked(care.command).mock.calls[1]);expect(vi.mocked(care.command).mock.calls[0][2]).toBe('close');expect(vi.mocked(care.command).mock.calls[0][3].expectedVersion).toBe(8);
});
it('rejects a non-doctor session before any care directory or worklist request',async()=>{
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'CLINIC_OWNER',allBranches:true,branchIds:[],version:1}]);
 const user=userEvent.setup();render(<DoctorPanel/>);await user.type(screen.getByLabelText('Email bác sĩ'),'owner@example.invalid');await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));await screen.findByRole('alert');expect(care.directory).not.toHaveBeenCalled();expect(care.worklist).not.toHaveBeenCalled();expect((screen.getByLabelText('Mật khẩu bác sĩ') as HTMLInputElement).value).toBe('');
});
