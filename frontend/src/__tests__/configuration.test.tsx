// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { act,cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfigurationPanel,type ConfigurationMode } from '../components/ConfigurationPanel';
import { AccountSettingsPanel } from '../components/AccountSettingsPanel';
import { RequestError,signIn } from '../api/booking';
import { contexts } from '../api/reception';
import * as api from '../api/configuration';
import * as platform from '../api/platform';
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/configuration',()=>({current:vi.fn(),mine:vi.fn(),clinic:vi.fn(),createClinic:vi.fn(),saveClinic:vi.fn(),saveBranch:vi.fn(),submitClinic:vi.fn(),bootstrap:vi.fn(),staff:vi.fn(),lookupStaff:vi.fn(),createStaff:vi.fn(),updateStaff:vi.fn(),setStaffStatus:vi.fn(),resetStaffPassword:vi.fn(),updateStaffRole:vi.fn(),memberships:vi.fn(),invite:vi.fn(),grant:vi.fn(),revokeGrant:vi.fn(),revoke:vi.fn(),affiliations:vi.fn(),schedules:vi.fn(),saveAffiliation:vi.fn(),saveSchedule:vi.fn(),offerings:vi.fn(),assignments:vi.fn(),prices:vi.fn(),saveOffering:vi.fn(),saveAssignment:vi.fn(),addPrice:vi.fn(),ownInvitations:vi.fn(),acceptInvitation:vi.fn(),revokeSession:vi.fn()}));
vi.mock('../api/platform',()=>({history:vi.fn(async()=>[])}));
const clinic:api.Clinic={id:'clinic',ownerUserId:'owner',name:'Synthetic owned clinic',slug:'synthetic-owned',reviewStatus:'DRAFT',publicationStatus:'UNPUBLISHED',evidenceVerified:false,version:3,contactName:'',contactEmail:'',contactPhone:'',license:null,branches:[{id:'branch',name:'Synthetic local point',address:'Synthetic address',openingHours:'08-17',active:true}]};
const offering:api.Offering={id:'offering',code:'SYN',name:'Synthetic source offering',description:null,specialtyCode:null,active:true,version:4};
beforeEach(()=>{vi.resetAllMocks();sessionStorage.clear();vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-owner-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}]);vi.mocked(api.current).mockResolvedValue({userId:'owner',legacyRoles:['ROLE_USER'],platformOperator:false});vi.mocked(api.mine).mockResolvedValue([clinic]);vi.mocked(api.clinic).mockResolvedValue(clinic);vi.mocked(api.offerings).mockResolvedValue([offering]);vi.mocked(api.assignments).mockResolvedValue([{id:'assignment',offering,durationMinutes:30,active:true,publicVisible:false,version:2}]);vi.mocked(api.prices).mockResolvedValue([{id:'old-price',amountVnd:100000,currency:'VND',effectiveFrom:'2026-10-01T00:00:00Z',taxPolicyCode:null,discountPolicyCode:null}]);vi.mocked(api.memberships).mockResolvedValue([]);vi.mocked(api.staff).mockResolvedValue([]);vi.mocked(api.ownInvitations).mockResolvedValue([]);});
afterEach(cleanup);
async function login(mode:ConfigurationMode){const user=userEvent.setup();render(<ConfigurationPanel mode={mode}/>);await user.type(screen.getByLabelText('Email cấu hình'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu cấu hình'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập cấu hình'}));await screen.findByRole('button',{name:'Tải lại dữ liệu cấu hình'});return user;}
async function priceForm(){const user=await login('catalog');await user.click(await screen.findByRole('button',{name:'Bảng giá Synthetic source offering'}));await user.click(await screen.findByRole('button',{name:'Thêm giá mới'}));await user.type(screen.getByLabelText('Giá mới (VND)'),'120000');fireEvent.change(screen.getByLabelText('Áp dụng từ (giờ Việt Nam)'),{target:{value:'2026-10-03T08:00'}});return user;}
it('appends a price version in the granted scope and leaves the prior source history visible',async()=>{
 vi.mocked(api.addPrice).mockResolvedValue({id:'new-price',amountVnd:120000,currency:'VND',effectiveFrom:'2026-10-03T01:00:00Z',taxPolicyCode:null,discountPolicyCode:null});const user=await priceForm();await user.click(screen.getByRole('button',{name:'Lưu giá mới'}));await screen.findByText('Đã lưu thay đổi.');expect(api.addPrice).toHaveBeenCalledWith({token:'synthetic-owner-token',clinic:'clinic',branch:'branch'},{offeringId:'offering',amountVnd:120000,effectiveFrom:new Date('2026-10-03T08:00+07:00').toISOString()});expect(screen.getByText(/100.000/)).toBeTruthy();
});
it('freezes an unknown write across a remount until a source read and explicit reconciliation',async()=>{
 vi.mocked(api.addPrice).mockRejectedValue(new RequestError('Synthetic lost response',0));const user=await priceForm();await user.click(screen.getByRole('button',{name:'Lưu giá mới'}));await screen.findByText(/Chưa xác định được kết quả lưu/);await user.click(screen.getByRole('button',{name:'Lưu giá mới'}));expect(api.addPrice).toHaveBeenCalledTimes(1);cleanup();const next=await login('catalog');await screen.findByText(/Chưa xác định được kết quả lưu/);expect(screen.queryByRole('button',{name:'Đã đối chiếu dữ liệu nguồn'})).toBeNull();await next.click(screen.getByRole('button',{name:'Tải lại dữ liệu cấu hình'}));await screen.findByRole('button',{name:'Đã đối chiếu dữ liệu nguồn'});await next.click(screen.getByRole('button',{name:'Đã đối chiếu dữ liệu nguồn'}));expect(screen.queryByText(/Chưa xác định được kết quả lưu/)).toBeNull();expect(api.addPrice).toHaveBeenCalledTimes(1);expect(sessionStorage.length).toBe(0);
});
it('discards a late profile mutation after logout and sends the server version when saving',async()=>{
 let resolve!:(c:api.Clinic)=>void;vi.mocked(api.saveClinic).mockReturnValue(new Promise(r=>{resolve=r;}));const user=await login('profile');await user.click(screen.getByRole('button',{name:'Lưu hồ sơ phòng khám'}));expect(api.saveClinic).toHaveBeenCalledWith({token:'synthetic-owner-token',clinic:'clinic',branch:'branch'},expect.objectContaining({expectedVersion:3}));expect(screen.getByRole('button',{name:'Đăng xuất cấu hình'})).toHaveProperty('disabled',true);cleanup();await act(async()=>resolve({...clinic,name:'Late response'}));expect(screen.queryByText('Late response')).toBeNull();expect(screen.queryByRole('button',{name:'Đăng nhập cấu hình'})).toBeNull();
});
it('recovers an existing creator draft without creating another clinic before IAM bootstrap',async()=>{
 vi.mocked(contexts).mockResolvedValue([]);const user=await login('profile');await screen.findByText(/Quyền chủ cơ sở đang chờ liên kết/);expect(screen.queryByRole('button',{name:'Tạo hồ sơ phòng khám'})).toBeNull();await user.click(screen.getByRole('button',{name:'Lưu hồ sơ phòng khám'}));expect(api.saveClinic).not.toHaveBeenCalled();expect(api.createClinic).not.toHaveBeenCalled();
});
it('shows account permissions without an invitation workflow',async()=>{
 const user=userEvent.setup();render(<AccountSettingsPanel/>);await user.type(screen.getByLabelText('Email tài khoản'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu tài khoản'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tài khoản'}));await screen.findByRole('heading',{name:'Quyền làm việc'});expect(screen.queryByText('Lời mời của tôi')).toBeNull();expect(api.ownInvitations).not.toHaveBeenCalled();
});

it('keeps an unsaved configuration, locks other forms and reload, and discards only on request',async()=>{
 const user=await login('catalog');await user.click(await screen.findByRole('button',{name:'Sửa dịch vụ Synthetic source offering'}));
 await screen.findByRole('button',{name:'Lưu dịch vụ'});await user.type(screen.getAllByLabelText('Tên dịch vụ',{selector:'input',exact:true}).at(-1)!, ' changed');
 expect(screen.getByRole('button',{name:'Tải lại dữ liệu cấu hình'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Về danh sách'})).toHaveProperty('disabled',true);
 await user.click(screen.getByRole('button',{name:'Bỏ thay đổi chưa lưu'}));
 expect(screen.getByRole('button',{name:'Tải lại dữ liệu cấu hình'})).toHaveProperty('disabled',false);
 expect(api.saveOffering).not.toHaveBeenCalled();
});

it('shows the latest request for changes and authorized review history to the owner',async()=>{
 vi.mocked(api.clinic).mockResolvedValue({...clinic,reviewStatus:'NEEDS_CHANGES'});
 vi.mocked(platform.history).mockResolvedValue([{id:'decision',action:'REQUEST_CHANGES',reason:'Bổ sung phạm vi giấy phép',occurredAt:'2026-10-02T01:00:00Z',actorUserId:'reviewer'}]);
 await login('profile');await screen.findAllByText('Bổ sung phạm vi giấy phép');expect(platform.history).toHaveBeenCalledWith('synthetic-owner-token','clinic');
});

it('protects an unsaved new staff form until explicit discard',async()=>{
 const user=await login('members');await user.click(await screen.findByRole('button',{name:'Cấp tài khoản'}));await user.type(screen.getByLabelText('Họ và tên'),'Nhân viên mới');
 expect(screen.getByRole('button',{name:'Tải lại dữ liệu cấu hình'})).toHaveProperty('disabled',true);
 await user.click(screen.getByRole('button',{name:'Bỏ thay đổi chưa lưu'}));
 expect(screen.getByLabelText('Họ và tên')).toHaveProperty('value','');expect(api.createStaff).not.toHaveBeenCalled();
});

const staffRow:api.StaffRow={membership:{id:'staff-member',userId:'staff-user',clinicId:'clinic',role:'STAFF',status:'ACTIVE',allBranches:true,version:2,branchIds:[]},account:{userId:'staff-user',fullName:'Nguyễn An',email:'an@example.invalid',phone:'0901234567',accountCode:'NV01',status:'ACTIVE'}};
it('shows named staff in a table and confirms removing exactly the selected member',async()=>{
 vi.mocked(api.staff).mockResolvedValue([staffRow]);vi.mocked(api.revoke).mockResolvedValue({...staffRow.membership,status:'REVOKED'});
 const user=await login('members');await screen.findByRole('table',{name:'Nhân sự phòng khám'});expect(screen.getByText('Nguyễn An')).toBeTruthy();expect(screen.queryByRole('heading',{name:'Mời nhân sự'})).toBeNull();
 await user.click(screen.getByRole('button',{name:'Xóa nhân sự Nguyễn An'}));expect(api.revoke).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Quay lại kiểm tra'}));expect(api.revoke).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Xóa nhân sự Nguyễn An'}));await user.click(screen.getByRole('button',{name:'Xóa khỏi nhân sự'}));expect(api.revoke).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),staffRow.membership,expect.any(String));
});
it('creates staff directly after checking email and does not send an invitation',async()=>{
 vi.mocked(api.lookupStaff).mockResolvedValue({account:null});vi.mocked(api.createStaff).mockResolvedValue(staffRow);
 const user=await login('members');await user.click(await screen.findByRole('button',{name:'Cấp tài khoản'}));await user.type(screen.getByLabelText('Email đăng nhập'),'new@example.invalid');await user.click(screen.getByRole('button',{name:'Kiểm tra email'}));await screen.findByText(/Email chưa đăng ký/);
 await user.type(screen.getByLabelText('Họ và tên'),'Nhân sự mới');await user.type(screen.getByLabelText(/Mật khẩu ban đầu/),'Initial!123');await user.selectOptions(screen.getByLabelText('Vai trò'),'DOCTOR');await user.click(screen.getByRole('button',{name:'Cấp tài khoản'}));
 expect(api.createStaff).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),expect.objectContaining({email:'new@example.invalid',fullName:'Nhân sự mới',role:'DOCTOR',useExistingAccount:false}));expect(api.invite).not.toHaveBeenCalled();
});
it('lets an admin lock a receptionist account and reset its password',async()=>{
 vi.mocked(api.staff).mockResolvedValue([staffRow]);vi.mocked(api.setStaffStatus).mockResolvedValue({...staffRow,account:{...staffRow.account!,status:'LOCKED'}});vi.mocked(api.resetStaffPassword).mockResolvedValue(staffRow);
 const user=await login('members');await user.click(await screen.findByRole('button',{name:'Quản lý tài khoản Nguyễn An'}));
 await user.click(screen.getByRole('button',{name:'Khóa tài khoản'}));await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Khóa tài khoản'}));expect(api.setStaffStatus).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'staff-member','LOCKED');
 await user.type(screen.getByLabelText('Mật khẩu tạm mới'),'Temporary!123');await user.type(screen.getByLabelText('Xác nhận mật khẩu'),'Temporary!123');await user.click(screen.getByRole('button',{name:'Đặt lại mật khẩu'}));expect(api.resetStaffPassword).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'staff-member','Temporary!123');
});
it('opens only the chosen doctor schedule and rejects an inverted time range',async()=>{
 const doctor:api.Affiliation={id:'affiliation',practitionerId:'doctor',userId:'doctor-user',displayName:'Bác sĩ An',registrationCode:null,specialtyCode:'NOI',specialtyName:'Nội tổng quát',professionalTitle:'Bác sĩ',effectiveFrom:'2026-01-01',effectiveUntil:null,active:true,publicVisible:true,version:1};
 vi.mocked(api.affiliations).mockResolvedValue([doctor]);vi.mocked(api.schedules).mockResolvedValue({affiliation:doctor,schedules:[]});
 const user=await login('schedules');await screen.findByRole('table',{name:'Danh sách bác sĩ'});expect(api.schedules).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Lịch làm việc của Bác sĩ An'}));await screen.findByRole('table',{name:'Lịch làm việc của Bác sĩ An'});expect(api.schedules).toHaveBeenCalledWith(expect.objectContaining({branch:'branch'}),'affiliation');await user.click(screen.getByRole('button',{name:'Thêm khung lịch'}));fireEvent.change(screen.getByLabelText('Giờ kết thúc'),{target:{value:'07:00'}});await user.click(screen.getByRole('button',{name:'Lưu khung lịch'}));await screen.findByText('Giờ kết thúc phải sau giờ bắt đầu.');expect(api.saveSchedule).not.toHaveBeenCalled();
});
