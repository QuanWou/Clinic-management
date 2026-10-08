// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup,act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MedicalPanel } from '../components/MedicalPanel';
import { LabPanel } from '../components/LabPanel';
import * as api from '../api/medical';
import { contexts } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
vi.mock('../api/medical',()=>({draft:vi.fn(),orders:vi.fn(),offerings:vi.fn(),save:vi.fn(),order:vi.fn(),review:vi.fn(),validate:vi.fn(),labDirectory:vi.fn(),lab:vi.fn(),labHistory:vi.fn(),resultHistory:vi.fn(),transition:vi.fn(),result:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID())}));
const realtime=vi.hoisted(()=>({change:()=>{}}));
vi.mock('../api/realtime',()=>({doctorSubscription:(scope:unknown,source:string)=>({scope,source}),subscribeRealtime:(_scope:unknown,change:()=>void)=>{realtime.change=change;return()=>{};}}));
const scope={token:'synthetic-token',clinic:'clinic',branch:'branch'};
const note={reasonForVisit:'Synthetic reason',medicalHistory:'',allergies:'',vitals:'',examination:'',preliminaryDiagnosis:'',conclusion:'Synthetic conclusion',instructions:'Synthetic instructions',followUpDate:null};
const draft={encounterId:'visit',documentVersion:1,caseVersion:1,status:'DRAFT',content:note,authorUserId:'doctor',savedAt:null,contentHash:'synthetic'};
const order={id:'order',encounterId:'visit',offeringId:'offering',name:'Synthetic Lab',state:'ORDERED',version:0,resultVersion:0,acceptedBy:null,result:null,reviewedBy:null};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(api.draft).mockResolvedValue(draft);vi.mocked(api.orders).mockResolvedValue([]);vi.mocked(api.offerings).mockResolvedValue([{active:true,offering:{id:'offering',name:'Synthetic Lab',active:true}}]);vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}]);vi.mocked(api.labDirectory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]});vi.mocked(api.lab).mockResolvedValue([order]);});
afterEach(cleanup);
it('updates server-owned orders while preserving an unsaved note and exposes a newer server version',async()=>{
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.click(screen.getByLabelText('Tự động lưu bản nháp sau khi ngừng nhập'));await user.type(screen.getByLabelText('Kết luận'),' local edit');
 vi.mocked(api.draft).mockResolvedValue({...draft,documentVersion:2,content:{...note,conclusion:'Changed in another session'}});vi.mocked(api.orders).mockResolvedValue([{...order,state:'RESULTED',resultVersion:1}]);
 await act(async()=>{realtime.change();await new Promise(resolve=>setTimeout(resolve,150));});
 expect(screen.getByLabelText('Kết luận')).toHaveProperty('value','Synthetic conclusion local edit');expect(screen.getByText('ĐÃ CÓ KẾT QUẢ')).toBeTruthy();expect(screen.getByText(/Hồ sơ tại máy chủ vừa thay đổi/)).toBeTruthy();expect(api.save).not.toHaveBeenCalled();
});
it('saves a versioned draft and does not allow validation with an outstanding order',async()=>{
 vi.mocked(api.orders).mockResolvedValue([order]);vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:2,caseVersion:3});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Lý do khám');await user.type(screen.getByLabelText('Kết luận'),' additional');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByText('Đã lưu bản nháp phiên bản 2.');expect(api.save).toHaveBeenCalledWith(scope,'visit',expect.objectContaining({expectedDocumentVersion:1,content:expect.objectContaining({conclusion:'Synthetic conclusion additional'})}),expect.any(String));await user.type(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ'),'Synthetic confirmation');expect((screen.getByRole('button',{name:'Xác nhận nội dung chuyên môn'}) as HTMLButtonElement).disabled).toBe(true);
});
it('keeps uncertain draft text and retries original version, body and key',async()=>{
 vi.mocked(api.save).mockRejectedValueOnce(new Error('Synthetic response lost')).mockResolvedValueOnce({...draft,documentVersion:2});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.type(screen.getByLabelText('Kết luận'),' retained');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByRole('alert');expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).closest('fieldset')?.disabled).toBe(true);
 await user.click(screen.getByRole('button',{name:'Thử lại hồ sơ đang chờ'}));await screen.findByText('Đã lưu bản nháp phiên bản 2.');expect(vi.mocked(api.save).mock.calls[0]).toEqual(vi.mocked(api.save).mock.calls[1]);expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).value).toContain('retained');
});
it('autosaves by default with the current draft version after typing stops',async()=>{
 vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:2,caseVersion:2});const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');expect(screen.getByLabelText('Tự động lưu bản nháp sau khi ngừng nhập')).toHaveProperty('checked',true);await user.type(screen.getByLabelText('Kết luận'),' autosaved');await screen.findByText('Đã lưu bản nháp phiên bản 2.',{}, {timeout:3000});expect(api.save).toHaveBeenCalledTimes(1);expect(vi.mocked(api.save).mock.calls[0][2].expectedDocumentVersion).toBe(1);
});
it('saves dirty clinical notes before creating an order without requiring the bottom audit reason',async()=>{
 vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:2,caseVersion:2,content:{...note,preliminaryDiagnosis:'Viêm cơ'}});
 vi.mocked(api.order).mockResolvedValue(order);
 vi.mocked(api.draft).mockResolvedValueOnce(draft).mockResolvedValueOnce({...draft,documentVersion:2,caseVersion:3,content:{...note,preliminaryDiagnosis:'Viêm cơ'}});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Chẩn đoán sơ bộ');
 await user.click(screen.getByLabelText('Tự động lưu bản nháp sau khi ngừng nhập'));
 await user.type(screen.getByLabelText('Chẩn đoán sơ bộ'),'Viêm cơ');await user.selectOptions(screen.getByLabelText('Dịch vụ chỉ định'),'offering');
 const button=screen.getByRole('button',{name:'Tạo chỉ định'});expect(button).toHaveProperty('disabled',false);await user.click(button);await screen.findByText('Đã tạo chỉ định từ danh mục và giá hiện hành.');
 expect(api.save).toHaveBeenCalledWith(scope,'visit',expect.objectContaining({expectedDocumentVersion:1,content:expect.objectContaining({preliminaryDiagnosis:'Viêm cơ'})}),expect.any(String));
 expect(api.order).toHaveBeenCalledWith(scope,'visit',{expectedCaseVersion:2,offeringId:'offering',reason:'Bác sĩ chỉ định Synthetic Lab'},expect.any(String));
});
it('preserves a competing draft and requires explicit reconciliation before a new save',async()=>{
 vi.mocked(api.save).mockRejectedValueOnce(new RequestError('Synthetic conflict',409));const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Kết luận');await user.type(screen.getByLabelText('Kết luận'),' local');await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByRole('alert');
 vi.mocked(api.draft).mockResolvedValue({...draft,documentVersion:2,caseVersion:2,content:{...note,conclusion:'Other browser version'}});await user.click(screen.getByRole('button',{name:'Tải phiên bản mới'}));await screen.findByText(/Other browser version/);expect((screen.getByLabelText('Kết luận') as HTMLTextAreaElement).value).toContain('local');expect((screen.getByRole('button',{name:'Lưu bản nháp'}) as HTMLButtonElement).disabled).toBe(true);
 await user.click(screen.getByRole('button',{name:'Giữ nội dung đang sửa trên phiên bản mới'}));vi.mocked(api.save).mockResolvedValue({...draft,documentVersion:3});await user.click(screen.getByRole('button',{name:'Lưu bản nháp'}));await screen.findByText('Đã lưu bản nháp phiên bản 3.');expect(vi.mocked(api.save).mock.calls[1][2].expectedDocumentVersion).toBe(2);
});
async function labDesk(){const user=userEvent.setup();render(<LabPanel/>);await user.type(screen.getByLabelText('Email bác sĩ'),'lab@example.invalid');await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));await user.selectOptions(await screen.findByLabelText('Địa điểm xét nghiệm'),'branch');await user.click(await screen.findByRole('button',{name:'Chọn chỉ định Synthetic Lab'}));return user;}
it('keeps an acknowledged order when refreshing its case fails, then recovers without replaying it',async()=>{
 vi.mocked(api.order).mockResolvedValue(order);
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);await screen.findByLabelText('Dịch vụ chỉ định');
 await user.selectOptions(screen.getByLabelText('Dịch vụ chỉ định'),'offering');await user.type(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ'),'Synthetic order');
 vi.mocked(api.draft).mockRejectedValueOnce(new Error('Synthetic head refresh unavailable'));
 await user.click(screen.getByRole('button',{name:'Tạo chỉ định'}));await screen.findByText('Đã tạo chỉ định từ danh mục và giá hiện hành.');
 expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringContaining('Thao tác đã được ghi nhận'));
 expect(screen.queryByRole('button',{name:'Thử lại hồ sơ đang chờ'})).toBeNull();expect(screen.getByRole('button',{name:'Tạo chỉ định'}).closest('fieldset')?.disabled).toBe(true);
 vi.mocked(api.draft).mockResolvedValue({...draft,caseVersion:2});vi.mocked(api.orders).mockResolvedValue([order]);
 await user.click(screen.getByRole('button',{name:'Tải phiên bản mới'}));await screen.findByText('Đã chỉ định');
 expect(api.order).toHaveBeenCalledTimes(1);expect(screen.getByRole('button',{name:'Tạo chỉ định'}).closest('fieldset')?.disabled).toBe(false);
});
it('lets the doctor confirm a resulted order without typing the bottom audit reason',async()=>{
 const resulted={...order,state:'RESULTED',version:3,resultVersion:1,result:{id:'result',version:1,sourceRef:'LAB-001',content:'Kết quả cơ xương khớp',authorUserId:'lab',createdAt:'2026-10-07T02:48:01Z'}};
 vi.mocked(api.orders).mockResolvedValue([resulted]);vi.mocked(api.review).mockResolvedValue({...resulted,state:'REVIEWED',reviewedBy:'doctor'});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit"/>);const button=await screen.findByRole('button',{name:'Xem và xác nhận kết quả'});
 expect(button).toHaveProperty('disabled',false);await user.click(button);await screen.findByText('Đã ghi nhận bác sĩ xem và duyệt kết quả.');
 expect(api.review).toHaveBeenCalledWith(scope,resulted,'Bác sĩ xem và xác nhận kết quả Synthetic Lab',expect.any(String));
});
it('records a sourced lab result while keeping doctor review separate',async()=>{
 vi.mocked(api.transition).mockResolvedValueOnce({...order,state:'ACCEPTED',version:1}).mockResolvedValueOnce({...order,state:'PROCESSING',version:2});vi.mocked(api.result).mockResolvedValue({...order,state:'RESULTED',version:3,resultVersion:1});
 const user=await labDesk();await user.type(screen.getByLabelText('Lý do xử lý xét nghiệm'),'Synthetic work');await user.click(screen.getByRole('button',{name:'Nhận chỉ định'}));await screen.findByRole('button',{name:'Bắt đầu xử lý xét nghiệm'});await user.click(screen.getByRole('button',{name:'Bắt đầu xử lý xét nghiệm'}));await screen.findByLabelText('Nguồn kết quả');await user.type(screen.getByLabelText('Nguồn kết quả'),'SYN-001');await user.type(screen.getByLabelText('Nội dung kết quả'),'Synthetic authenticated result');await user.click(screen.getByRole('button',{name:'Ghi phiên bản kết quả'}));await screen.findByText('Đã ghi kết quả có tác giả và nguồn. Chờ bác sĩ duyệt.');expect(api.review).not.toHaveBeenCalled();expect(api.validate).not.toHaveBeenCalled();expect(api.result).toHaveBeenCalledWith(scope,expect.objectContaining({version:2}),expect.objectContaining({sourceRef:'SYN-001',content:'Synthetic authenticated result'}),expect.any(String));
});
it('freezes unknown lab mutation and retains its retry key',async()=>{
 vi.mocked(api.transition).mockRejectedValueOnce(new Error('Synthetic uncertain claim')).mockResolvedValueOnce({...order,state:'ACCEPTED',version:1});const user=await labDesk();await user.type(screen.getByLabelText('Lý do xử lý xét nghiệm'),'Synthetic claim');await user.click(screen.getByRole('button',{name:'Nhận chỉ định'}));await screen.findByRole('alert');await user.click(screen.getByRole('button',{name:'Thử lại thao tác kết quả đang chờ'}));await screen.findByRole('button',{name:'Bắt đầu xử lý xét nghiệm'});expect(vi.mocked(api.transition).mock.calls[0]).toEqual(vi.mocked(api.transition).mock.calls[1]);
});

it('filters lab orders by name and state, then prevents refresh or navigation with an unsaved result',async()=>{
 vi.mocked(api.lab).mockResolvedValue([{...order,state:'PROCESSING'},{...order,id:'other',name:'Synthetic ECG',state:'ORDERED'}]);
 const user=await labDesk();
 await user.selectOptions(screen.getByLabelText('Lọc trạng thái'),'PROCESSING');
 expect(screen.queryByRole('button',{name:'Chọn chỉ định Synthetic ECG'})).toBeNull();
 await user.type(screen.getByLabelText('Tìm trong danh sách hiện có'),'Lab');
 expect(screen.getByRole('button',{name:'Chọn chỉ định Synthetic Lab'})).toBeTruthy();
 await user.type(screen.getByLabelText('Nội dung kết quả'),'Unsaved result');
 expect(screen.getByLabelText('Tìm trong danh sách hiện có')).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Tải lại chỉ định xét nghiệm'})).toHaveProperty('disabled',true);
 expect(screen.getByLabelText('Địa điểm xét nghiệm').closest('fieldset')?.disabled).toBe(true);
 await user.click(screen.getByText('Hủy thay đổi kết quả chưa ghi',{selector:'summary'}));
 await user.click(screen.getByRole('button',{name:'Dùng lại kết quả đã ghi'}));
 expect(screen.getByLabelText('Nội dung kết quả')).toHaveProperty('value','');
 expect(screen.getByRole('button',{name:'Tải lại chỉ định xét nghiệm'})).toHaveProperty('disabled',false);
 await user.click(screen.getByRole('button',{name:'Xóa bộ lọc'}));
 expect(screen.getAllByRole('button',{name:/Chọn chỉ định/})).toHaveLength(2);
 expect(api.lab).toHaveBeenCalledTimes(1);
});

it('retains a conflicted lab result through a source read and discards it only after explicit comparison',async()=>{
 vi.mocked(api.lab).mockResolvedValueOnce([{...order,state:'PROCESSING',version:2}]);
 vi.mocked(api.result).mockRejectedValueOnce(new RequestError('Competing result version',409));
 const user=await labDesk();
 await user.type(screen.getByLabelText('Lý do xử lý xét nghiệm'),'Result entry');
 await user.type(screen.getByLabelText('Nguồn kết quả'),'LOCAL-001');
 await user.type(screen.getByLabelText('Nội dung kết quả'),'Local result retained');
 await user.click(screen.getByRole('button',{name:'Ghi phiên bản kết quả'}));
 await screen.findByRole('alert');
 expect(screen.getByRole('button',{name:'Tải lại chỉ định xét nghiệm'})).toHaveProperty('disabled',false);
 await user.click(screen.getByText('Hủy thay đổi kết quả chưa ghi',{selector:'summary'}));
 expect(screen.getByRole('button',{name:'Dùng lại kết quả đã ghi'})).toHaveProperty('disabled',true);
 vi.mocked(api.lab).mockResolvedValue([{...order,state:'RESULTED',version:3,resultVersion:1,result:{id:'result',version:1,sourceRef:'SERVER-001',content:'Other recorded result',authorUserId:'other-lab',createdAt:'2026-10-02T08:00:00Z'}}]);
 await user.click(screen.getByRole('button',{name:'Tải lại chỉ định xét nghiệm'}));
 expect(await screen.findByLabelText('Nội dung kết quả')).toHaveProperty('value','Local result retained');
 expect(screen.getByText('Kết quả đã ghi: Other recorded result')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Dùng lại kết quả đã ghi'}));
 expect(screen.getByLabelText('Nội dung kết quả')).toHaveProperty('value','Other recorded result');
 expect(api.result).toHaveBeenCalledTimes(1);
});

it('keeps the medical record read-only while awaiting results and requires returning to active care before review or validation',async()=>{
 render(<MedicalPanel scope={scope} id="visit" status="AWAITING_RESULTS"/>);await screen.findByLabelText('Kết luận');
 expect(screen.getByLabelText('Kết luận').closest('fieldset')).toHaveProperty('disabled',true);
 expect(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ').closest('fieldset')).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Xác nhận nội dung chuyên môn'})).toHaveProperty('disabled',true);
 expect(screen.getByText(/chờ kết quả và chỉ đọc/)).toBeTruthy();expect(api.validate).not.toHaveBeenCalled();expect(api.review).not.toHaveBeenCalled();
});

it('validates the record and completes professional care from one primary action',async()=>{
 const completed=vi.fn(async(_version:number)=>{});vi.mocked(api.validate).mockResolvedValue({...draft,status:'VALIDATED',caseVersion:4,documentVersion:2});
 const user=userEvent.setup();render(<MedicalPanel scope={scope} id="visit" onComplete={completed}/>);
 await screen.findByLabelText('Lý do lưu hoặc duyệt hồ sơ');await user.type(screen.getByLabelText('Lý do lưu hoặc duyệt hồ sơ'),'Hoàn tất hồ sơ khám');
 const button=screen.getByRole('button',{name:'Hoàn tất chuyên môn'});expect(button).toHaveProperty('disabled',false);await user.click(button);
 await screen.findByText('Đã khóa nội dung chuyên môn để hoàn tất lượt khám.');
 expect(api.validate).toHaveBeenCalledWith(scope,'visit',1,'Hoàn tất hồ sơ khám',expect.any(String));expect(completed).toHaveBeenCalledWith(4);
});

it('renders the selected-date preview only for the follow-up date field',async()=>{
 vi.mocked(api.draft).mockResolvedValue({...draft,content:{...note,followUpDate:'2026-10-08'}});
 render(<MedicalPanel scope={scope} id="visit"/>);
 expect((await screen.findAllByText(/Ngày đã chọn:/)).length).toBe(1);
});

it('looks up reviewed and rejected results in dated history and loads immutable result versions',async()=>{
 const reviewed={...order,state:'REVIEWED',resultVersion:2,result:{id:'r2',version:2,content:'Kết quả lần hai',sourceRef:'LAB-2',authorUserId:'doctor',createdAt:'2026-10-02T01:00:00Z'}};
 vi.mocked(api.labHistory).mockResolvedValueOnce({items:[reviewed],nextAfter:'order'}).mockResolvedValueOnce({items:[{...order,id:'rejected',name:'Đã từ chối',state:'REJECTED'}],nextAfter:null});
 vi.mocked(api.resultHistory).mockResolvedValue([{id:'r1',version:1,content:'Kết quả đầu',sourceRef:'LAB-1',authorUserId:'doctor',createdAt:'2026-10-01T01:00:00Z'},reviewed.result]);
 const user=userEvent.setup();render(<LabPanel/>);await user.type(screen.getByLabelText('Email bác sĩ'),'doctor@example.invalid');await user.type(screen.getByLabelText('Mật khẩu bác sĩ'),'password');await user.click(screen.getByRole('button',{name:'Đăng nhập bác sĩ'}));
 await user.selectOptions(await screen.findByLabelText('Địa điểm xét nghiệm'),'branch');await user.click(screen.getByRole('button',{name:'Lịch sử kết quả'}));
 await user.click(await screen.findByRole('button',{name:'Chọn chỉ định Synthetic Lab'}));await screen.findByText('Kết quả lần hai');
 await user.click(screen.getByText('Các phiên bản kết quả đã ghi',{selector:'summary'}));await user.click(screen.getByRole('button',{name:'Tải các phiên bản kết quả'}));await screen.findByText('Kết quả đầu');
 expect(api.resultHistory).toHaveBeenCalledWith(scope,'order');await user.click(screen.getByRole('button',{name:'Tải thêm lịch sử kết quả'}));await screen.findByRole('button',{name:'Chọn chỉ định Đã từ chối'});
 expect(vi.mocked(api.labHistory).mock.calls[1][3]).toBe('order');expect(screen.queryByRole('button',{name:'Tải thêm lịch sử kết quả'})).toBeNull();
});
