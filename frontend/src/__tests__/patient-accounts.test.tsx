// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,within,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ConfigurationPanel} from '../components/ConfigurationPanel';
import {canOpen} from '../auth/access';
import * as api from '../api/patientAccounts';
import * as configuration from '../api/configuration';
import {RequestError,signIn} from '../api/booking';
import {contexts} from '../api/reception';
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/configuration',()=>({mine:vi.fn(),current:vi.fn(),clinic:vi.fn()}));
vi.mock('../api/patientAccounts',()=>({list:vi.fn(),get:vi.fn(),create:vi.fn(),update:vi.fn(),setStatus:vi.fn(),resetPassword:vi.fn()}));
const account:api.PatientAccount={id:'patient-account',fullName:'Nguyễn An',email:'an@example.invalid',phone:'0901234567',accountCode:'TK000012',status:'ACTIVE',createdAt:'2026-10-01T08:00:00',updatedAt:'2026-10-01T08:00:00'};
const clinic={id:'clinic',ownerUserId:'admin',name:'Phòng khám',slug:'clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',evidenceVerified:true,version:1,branches:[{id:'branch',name:'Cơ sở',active:true,address:'',openingHours:''}]} as configuration.Clinic;
beforeEach(()=>{
 vi.resetAllMocks();sessionStorage.clear();
 vi.mocked(signIn).mockResolvedValue({data:{accessToken:'admin-token'}});
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}]);
 vi.mocked(configuration.current).mockResolvedValue({userId:'admin',legacyRoles:['ROLE_PATIENT'],platformOperator:false});
 vi.mocked(configuration.mine).mockResolvedValue([clinic]);vi.mocked(configuration.clinic).mockResolvedValue(clinic);
 vi.mocked(api.list).mockResolvedValue({content:[account],totalElements:1,totalPages:1,number:0,size:20});
 vi.mocked(api.update).mockResolvedValue(account);vi.mocked(api.create).mockResolvedValue(account);
 vi.mocked(api.get).mockResolvedValue(account);
 vi.mocked(api.setStatus).mockResolvedValue({...account,status:'LOCKED'});vi.mocked(api.resetPassword).mockResolvedValue(account);
});
afterEach(cleanup);
async function open(){const user=userEvent.setup();render(<ConfigurationPanel mode="customers"/>);await user.type(screen.getByLabelText('Email cấu hình'),'admin@example.invalid');await user.type(screen.getByLabelText('Mật khẩu cấu hình'),'Admin!123');await user.click(screen.getByRole('button',{name:'Đăng nhập cấu hình'}));await screen.findByRole('table',{name:'Tài khoản bệnh nhân'});return user;}
it('allows only clinic-wide admins to open patient account management',()=>{
 const context=(role:'ADMIN'|'STAFF'|'DOCTOR',allBranches=true)=>[{membershipId:'m',clinicId:'clinic',role,allBranches,branchIds:[],version:1}];
 expect(canOpen('customers',context('ADMIN'))).toBe(true);expect(canOpen('customers',context('ADMIN',false))).toBe(false);
 expect(canOpen('customers',context('STAFF'))).toBe(false);expect(canOpen('customers',context('DOCTOR'))).toBe(false);
});
it('loads accounts and sends search and status filtering to the source',async()=>{
 const user=await open();expect(screen.getByText('TK000012')).toBeTruthy();
 await user.type(screen.getByRole('searchbox'),'an@example.invalid');
 await waitFor(()=>expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({clinic:'clinic',token:'admin-token'}),'an@example.invalid','',0));
 await user.selectOptions(screen.getByLabelText('Lọc trạng thái tài khoản'),'LOCKED');
 await waitFor(()=>expect(api.list).toHaveBeenLastCalledWith(expect.anything(),'an@example.invalid','LOCKED',0));
});
it('creates a patient account and protects an unfinished draft',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Tạo tài khoản bệnh nhân'}));
 await user.type(screen.getByLabelText('Họ và tên'),'Bệnh nhân mới');expect(screen.getByRole('button',{name:'Về danh sách'})).toHaveProperty('disabled',true);
 await user.type(screen.getByLabelText('Email đăng nhập'),'new@example.invalid');await user.type(screen.getByLabelText('Mật khẩu ban đầu'),'Temporary!123');
 await user.click(screen.getByRole('button',{name:'Tạo tài khoản bệnh nhân'}));
 await screen.findByText('Đã lưu thay đổi.');expect(api.create).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),{fullName:'Bệnh nhân mới',email:'new@example.invalid',phone:'',password:'Temporary!123'});
});
it('updates the selected account and confirms before locking it',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Quản lý tài khoản Nguyễn An'}));
 await user.clear(screen.getByLabelText('Số điện thoại'));await user.type(screen.getByLabelText('Số điện thoại'),'0909999999');
 await user.click(screen.getByRole('button',{name:'Lưu thông tin tài khoản'}));await screen.findByText('Đã lưu thay đổi.');
 expect(api.update).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'patient-account',expect.objectContaining({phone:'0909999999'}));
 await user.click(screen.getByRole('button',{name:'Khóa tài khoản'}));expect(api.setStatus).not.toHaveBeenCalled();
 await user.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Khóa tài khoản'}));
 await waitFor(()=>expect(api.setStatus).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'patient-account','LOCKED'));
});
it('requires matching passwords and clears the password form after success',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Quản lý tài khoản Nguyễn An'}));
 await user.type(screen.getByLabelText('Mật khẩu tạm mới'),'Temporary!123');await user.type(screen.getByLabelText('Xác nhận mật khẩu'),'Different!123');await user.click(screen.getByRole('button',{name:'Đặt lại mật khẩu'}));
 await screen.findByText('Mật khẩu xác nhận chưa khớp.');expect(api.resetPassword).not.toHaveBeenCalled();
 await user.clear(screen.getByLabelText('Xác nhận mật khẩu'));await user.type(screen.getByLabelText('Xác nhận mật khẩu'),'Temporary!123');await user.click(screen.getByRole('button',{name:'Đặt lại mật khẩu'}));
 await waitFor(()=>expect(screen.getByLabelText('Mật khẩu tạm mới')).toHaveProperty('value',''));
 expect(api.resetPassword).toHaveBeenCalledWith(expect.objectContaining({clinic:'clinic'}),'patient-account','Temporary!123');
});
it('shows a source error and holds an uncertain creation for reconciliation',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Tạo tài khoản bệnh nhân'}));
 await user.type(screen.getByLabelText('Họ và tên'),'Bệnh nhân');await user.type(screen.getByLabelText('Email đăng nhập'),'p@example.invalid');await user.type(screen.getByLabelText('Mật khẩu ban đầu'),'Temporary!123');
 vi.mocked(api.create).mockRejectedValue(new RequestError('Mất kết nối',0));await user.click(screen.getByRole('button',{name:'Tạo tài khoản bệnh nhân'}));
 await screen.findByText(/Chưa xác định được kết quả lưu/);await user.click(screen.getByRole('button',{name:'Tạo tài khoản bệnh nhân'}));
 expect(api.create).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu nguồn'}));await screen.findByRole('table',{name:'Tài khoản bệnh nhân'});
 await screen.findByRole('button',{name:'Đã đối chiếu dữ liệu nguồn'});expect(api.create).toHaveBeenCalledTimes(1);
});
