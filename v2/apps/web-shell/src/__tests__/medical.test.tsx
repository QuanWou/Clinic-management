// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MedicalPanel } from '../components/MedicalPanel';
import { LabPanel } from '../components/LabPanel';
import * as api from '../api/medical';
import { contexts } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
vi.mock('../api/medical',()=>({draft:vi.fn(),orders:vi.fn(),offerings:vi.fn(),save:vi.fn(),order:vi.fn(),review:vi.fn(),validate:vi.fn(),labDirectory:vi.fn(),lab:vi.fn(),transition:vi.fn(),result:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID())}));
const scope={token:'synthetic-token',clinic:'clinic',branch:'branch'};
const note={reasonForVisit:'Synthetic reason',medicalHistory:'',allergies:'',vitals:'',examination:'',preliminaryDiagnosis:'',conclusion:'Synthetic conclusion',instructions:'Synthetic instructions',followUpDate:null};
const draft={encounterId:'visit',documentVersion:1,caseVersion:1,status:'DRAFT',content:note,authorUserId:'doctor',savedAt:null,contentHash:'synthetic'};
const order={id:'order',encounterId:'visit',offeringId:'offering',name:'Synthetic Lab',state:'ORDERED',version:0,resultVersion:0,acceptedBy:null,result:null,reviewedBy:null};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.draft).mockResolvedValue(draft);vi.mocked(api.orders).mockResolvedValue([]);vi.mocked(api.offerings).mockResolvedValue([{active:true,offering:{id:'offering',name:'Synthetic Lab',active:true}}]);vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'LAB',allBranches:false,branchIds:['branch'],version:1}]);vi.mocked(api.labDirectory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]});vi.mocked(api.lab).mockResolvedValue([order]);});
afterEach(cleanup);
it('saves a versioned draft and does not allow validation with an outstanding order',async()=>{
 vi.mocked(api.orders).mockResolvedValue([order]);vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:2,caseVersion:3});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Lý do khám');await user.type(screen.getByLabelText('Kết luận'),' additional');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByText('Đã lưu bản nháp phiên bản 2.');expect(api.save).toHaveBeenCalledWith(scope,'visit',expect.objectContaining({expectedDocumentVersion:1,content:expect.objectContaining({conclusion:'Synthetic conclusion additional'})}),expect.any(String));await user.type(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ'),'Synthetic confirmation');expect((screen.getByRole('button',{name:'Xác nhận nội dung chuyên môn'}) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps uncertain draft text and retries original version, body and key',async()=>{
 vi.mocked(api.save).mockRejectedValueOnce(new Error('Synthetic response lost')).mockResolvedValueOnce({...draft,documentVersion:2});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.type(screen.getByLabelText('Kết luận'),' retained');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByRole('alert');expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).closest('fieldset')?.disabled).toBe(true);
 await user.click(screen.getByRole('button',{name:'Thử lại hồ sơ đang chờ'}));await screen.findByText('Đã lưu bản nháp phiên bản 2.');expect(vi.mocked(api.save).mock.calls[0]).toEqual(vi.mocked(api.save).mock.calls[1]);expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).value).toContain('retained');
});
it('autosaves only after explicit opt-in with the current draft version',async()=>{
 vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:2,caseVersion:2});const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.type(screen.getByLabelText('Kết luận'),' autosaved');expect(api.save).not.toHaveBeenCalled();await user.click(screen.getByLabelText('Tự lưu bản nháp sau khi ngừng nhập'));await screen.findByText('Đã lưu bản nháp phiên bản 2.',{}, {timeout:3000});expect(api.save).toHaveBeenCalledTimes(1);expect(vi.mocked(api.save).mock.calls[0][2].expectedDocumentVersion).toBe(1);
});
it('preserves a competing draft and requires explicit reconciliation before a new save',async()=>{
 vi.mocked(api.save).mockRejectedValueOnce(new RequestError('Synthetic conflict',409));const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.type(screen.getByLabelText('Kết luận'),' local');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByRole('alert');
 vi.mocked(api.draft).mockResolvedValue({...draft,documentVersion:2,caseVersion:2,content:{...note,conclusion:'Other browser version'}});await user.click(screen.getByRole('button',{name:'Tải phiên bản để đối chiếu'}));await screen.findByText(/Other browser version/);expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).value).toContain('local');expect((screen.getByRole('button',{name:'Lưu bản nháp'}) as HTMLButtonElement).disabled).toBe(true);
 await user.click(screen.getByRole('button',{name:'Giữ nội dung đang sửa trên phiên bản mới'}));vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:3});await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByText('Đã lưu bản nháp phiên bản 3.');expect(vi.mocked(api.save).mock.calls[1][2].expectedDocumentVersion).toBe(2);
});
async function labDesk(){const user=userEvent.setup();render(<LabPanel/>);await user.type(screen.getByLabelText('Email nhân sự lab'),'lab@example.invalid');await user.type(screen.getByLabelText('Mật khẩu nhân sự lab'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập lab'}));await user.selectOptions(await screen.findByLabelText('Địa điểm lab'),'branch');await user.click(await screen.findByRole('button',{name:'Chọn chỉ định Synthetic Lab'}));return user;}
it('keeps an acknowledged order when refreshing its case fails, then recovers without replaying it',async()=>{
 vi.mocked(api.order).mockResolvedValue(order);
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Dịch vụ chỉ định');
 await user.selectOptions(screen.getByLabelText('Dịch vụ chỉ định'),'offering');await user.type(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ'),'Synthetic order');
 vi.mocked(api.draft).mockRejectedValueOnce(new Error('Synthetic head refresh unavailable'));
 await user.click(screen.getByRole('button',{name:'Tạo chỉ định'}));await screen.findByText('Đã tạo chỉ định từ danh mục và giá hiện hành.');
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Thao tác đã được ghi nhận'));
 expect(screen.queryByRole('button',{name:'Thử lại hồ sơ đang chờ'})).toBeNull();expect(screen.getByRole('button',{name:'Tạo chỉ định'}).closest('fieldset')?.disabled).toBe(true);
 vi.mocked(api.draft).mockResolvedValue({...draft,caseVersion:2});vi.mocked(api.orders).mockResolvedValue([order]);
 await user.click(screen.getByRole('button',{name:'Tải phiên bản để đối chiếu'}));await screen.findByText('ORDERED');
 expect(api.order).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Tạo chỉ định'}).closest('fieldset')?.disabled).toBe(false);
});
it('records a sourced lab result while keeping doctor review separate',async()=>{
 vi.mocked(api.transition).mockResolvedValueOnce({...order,state:'ACCEPTED',version:1}).mockResolvedValueOnce({...order,state:'PROCESSING',version:2});vi.mocked(api.result).mockResolvedValue({...order,state:'RESULTED',version:3,resultVersion:1});
 const user=await labDesk();await user.type(screen.getByLabelText('Lý do xử lý lab'),'Synthetic work');await user.click(screen.getByRole('button',{name:'Nhận chỉ định'}));await screen.findByRole('button',{name:'Bắt đầu xử lý lab'});await user.click(screen.getByRole('button',{name:'Bắt đầu xử lý lab'}));await screen.findByLabelText('Nguồn kết quả');await user.type(screen.getByLabelText('Nguồn kết quả'),'SYN-001');await user.type(screen.getByLabelText('Nội dung kết quả'),'Synthetic authenticated result');await user.click(screen.getByRole('button',{name:'Ghi phiên bản kết quả'}));await screen.findByText(/Chờ bác sĩ duyệt/);expect(api.review).not.toHaveBeenCalled();expect(api.validate).not.toHaveBeenCalled();expect(api.result).toHaveBeenCalledWith(scope,expect.objectContaining({version:2}),expect.objectContaining({sourceRef:'SYN-001',content:'Synthetic authenticated result'}),expect.any(String));
});
it('freezes unknown lab mutation and retains its retry key',async()=>{
 vi.mocked(api.transition).mockRejectedValueOnce(new Error('Synthetic uncertain claim')).mockResolvedValueOnce({...order,state:'ACCEPTED',version:1});const user=await labDesk();await user.type(screen.getByLabelText('Lý do xử lý lab'),'Synthetic claim');await user.click(screen.getByRole('button',{name:'Nhận chỉ định'}));await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'Thử lại thao tác lab đang chờ'}));await screen.findByRole('button',{name:'Bắt đầu xử lý lab'});expect(vi.mocked(api.transition).mock.calls[0]).toEqual(vi.mocked(api.transition).mock.calls[1]);
});
