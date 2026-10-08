// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ConfigurationPanel} from '../components/ConfigurationPanel';
import {canOpen} from '../auth/access';
import * as api from '../api/patientProfiles';
import * as configuration from '../api/configuration';
import {RequestError,signIn} from '../api/booking';
import {contexts} from '../api/reception';
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/configuration',()=>({mine:vi.fn(),current:vi.fn(),clinic:vi.fn()}));
vi.mock('../api/patientProfiles',()=>({list:vi.fn(),get:vi.fn(),create:vi.fn(),update:vi.fn()}));
const profile:api.PatientProfile={patientId:'p',patientCode:'PT-001',fullName:'Nguyễn An',dateOfBirth:null,sex:null,phone:'0901234567',email:null,status:'PROVISIONAL',hasAccount:false,createdAt:'2026-10-01T08:00:00Z',updatedAt:'2026-10-01T08:00:00Z',version:3};
const clinic={id:'clinic',ownerUserId:'admin',name:'Phòng khám',slug:'clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',evidenceVerified:true,version:1,branches:[{id:'branch',name:'Cơ sở',active:true,address:'',openingHours:''}]} as configuration.Clinic;
beforeEach(()=>{
 vi.resetAllMocks();sessionStorage.clear();
 vi.mocked(signIn).mockResolvedValue({data:{accessToken:'admin-token'}});
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}]);
 vi.mocked(configuration.current).mockResolvedValue({userId:'admin',legacyRoles:['ROLE_PATIENT'],platformOperator:false});
 vi.mocked(configuration.mine).mockResolvedValue([clinic]);vi.mocked(configuration.clinic).mockResolvedValue(clinic);
 vi.mocked(api.list).mockResolvedValue({content:[profile],totalElements:1,totalPages:1,number:0,size:20});
 vi.mocked(api.get).mockResolvedValue({profile,changes:[]});vi.mocked(api.create).mockResolvedValue(profile);vi.mocked(api.update).mockResolvedValue({...profile,version:4});
});
afterEach(cleanup);
async function open(){const user=userEvent.setup();render(<ConfigurationPanel mode="patients"/>);await user.type(screen.getByLabelText('Email cấu hình'),'admin@example.invalid');await user.type(screen.getByLabelText('Mật khẩu cấu hình'),'Fixture!123');await user.click(screen.getByRole('button',{name:'Đăng nhập cấu hình'}));await screen.findByRole('table',{name:'Hồ sơ bệnh nhân'});return user;}
it('restricts profiles to clinic-wide admins',()=>{
 const context=(role:'ADMIN'|'STAFF'|'DOCTOR',allBranches=true)=>[{membershipId:'m',clinicId:'clinic',role,allBranches,branchIds:[],version:1}];
 expect(canOpen('patients',context('ADMIN'))).toBe(true);expect(canOpen('patients',context('ADMIN',false))).toBe(false);expect(canOpen('patients',context('STAFF'))).toBe(false);expect(canOpen('patients',context('DOCTOR'))).toBe(false);
});
it('shows walk-ins without accounts and applies source filters',async()=>{
 const user=await open();expect(screen.getByRole('cell',{name:'Chưa có tài khoản'})).toBeTruthy();await user.type(screen.getByRole('searchbox'),'0901');await user.selectOptions(screen.getByLabelText('Lọc liên kết tài khoản'),'NONE');await user.selectOptions(screen.getByLabelText('Lọc xác minh hồ sơ'),'PROVISIONAL');
 await waitFor(()=>expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({clinic:'clinic'}),'0901','PROVISIONAL','NONE',0));
});
it('creates a walk-in profile without login fields and with an idempotency key',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Tạo hồ sơ bệnh nhân'}));await user.type(screen.getByLabelText('Họ và tên'),'Khách trực tiếp');expect(screen.getByRole('button',{name:'Về danh sách'})).toHaveProperty('disabled',true);
 expect(screen.queryByLabelText('Email đăng nhập')).toBeNull();await user.type(screen.getByLabelText('Lý do tạo / cập nhật hồ sơ'),'Khách đến khám lần đầu');await user.click(screen.getByRole('button',{name:'Tạo hồ sơ bệnh nhân'}));
 await screen.findByText('Đã lưu thay đổi.');expect(api.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({fullName:'Khách trực tiếp',dateOfBirth:null,reason:'Khách đến khám lần đầu'}),expect.any(String));
});
it('loads detail, sends the source version and shows change history',async()=>{
 vi.mocked(api.get).mockResolvedValue({profile,changes:[{id:'c',action:'UPDATE',reason:'Bổ sung liên hệ',changedFields:'phone',actorUserId:'admin',createdAt:'2026-10-01T08:00:00Z'}]});
 const user=await open();await user.click(screen.getByRole('button',{name:'Quản lý hồ sơ Nguyễn An'}));await screen.findByRole('table',{name:'Lịch sử thay đổi hồ sơ'});await user.clear(screen.getByLabelText('Số điện thoại'));await user.type(screen.getByLabelText('Số điện thoại'),'0909999999');await user.type(screen.getByLabelText('Lý do tạo / cập nhật hồ sơ'),'Sửa số liên hệ');await user.click(screen.getByRole('button',{name:'Lưu hồ sơ bệnh nhân'}));
 await screen.findByText('Đã lưu thay đổi.');expect(api.update).toHaveBeenCalledWith(expect.anything(),'p',expect.objectContaining({expectedVersion:3,phone:'0909999999',reason:'Sửa số liên hệ'}));
});
it('holds uncertain creation until source reconciliation without duplicate writes',async()=>{
 const user=await open();await user.click(screen.getByRole('button',{name:'Tạo hồ sơ bệnh nhân'}));await user.type(screen.getByLabelText('Họ và tên'),'Khách');await user.type(screen.getByLabelText('Lý do tạo / cập nhật hồ sơ'),'Tiếp nhận');vi.mocked(api.create).mockRejectedValue(new RequestError('Mất kết nối',0));await user.click(screen.getByRole('button',{name:'Tạo hồ sơ bệnh nhân'}));
 await screen.findByText(/Chưa xác định được kết quả lưu/);await user.click(screen.getByRole('button',{name:'Tạo hồ sơ bệnh nhân'}));expect(api.create).toHaveBeenCalledTimes(1);await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu nguồn'}));await screen.findByRole('table',{name:'Hồ sơ bệnh nhân'});expect(api.create).toHaveBeenCalledTimes(1);
});
