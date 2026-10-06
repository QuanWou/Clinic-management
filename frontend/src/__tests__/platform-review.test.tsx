// @vitest-environment jsdom
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { cleanup,render,screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlatformReviewPanel } from '../components/PlatformReviewPanel';
import { signIn } from '../api/booking';
import { current,type Clinic } from '../api/configuration';
import * as api from '../api/platform';
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/configuration',()=>({current:vi.fn()}));
vi.mock('../api/platform',()=>({list:vi.fn(),capabilities:vi.fn(),detail:vi.fn(),history:vi.fn(),decide:vi.fn()}));
const clinic:Clinic={id:'clinic',ownerUserId:'owner',name:'Synthetic source clinic',slug:'synthetic',reviewStatus:'SUBMITTED',publicationStatus:'UNPUBLISHED',evidenceVerified:false,version:1,contactName:'Synthetic',contactEmail:'synthetic@example.invalid',contactPhone:'0000',license:null,branches:[]};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-platform-token'}});vi.mocked(current).mockResolvedValue({userId:'operator',legacyRoles:['ROLE_USER'],platformOperator:true});vi.mocked(api.capabilities).mockResolvedValue({publicationEnabled:false});vi.mocked(api.list).mockResolvedValue({content:[clinic],number:0,size:20,totalPages:1,totalElements:1});vi.mocked(api.detail).mockResolvedValue(clinic);vi.mocked(api.history).mockResolvedValue([]);});
afterEach(cleanup);
async function login(){const user=userEvent.setup();render(<PlatformReviewPanel/>);await user.type(screen.getByLabelText('Email kiểm duyệt'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu kiểm duyệt'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập kiểm duyệt'}));return user;}
it('requires evidence confirmation and retains the server publication gate after approval',async()=>{
 const user=await login();await screen.findByRole('button',{name:'Mở hồ sơ Synthetic source clinic'});await user.click(screen.getByRole('button',{name:'Mở hồ sơ Synthetic source clinic'}));await screen.findByLabelText('Lý do quyết định');await user.type(screen.getByLabelText('Lý do quyết định'),'Synthetic reviewed source evidence');expect((screen.getByRole('button',{name:'Duyệt hồ sơ'}) as HTMLButtonElement).disabled).toBe(true);await user.click(screen.getByLabelText('Đã xác minh minh chứng riêng và hiệu lực giấy phép'));vi.mocked(api.decide).mockResolvedValue({...clinic,reviewStatus:'APPROVED',evidenceVerified:true});await user.click(screen.getByRole('button',{name:'Duyệt hồ sơ'}));await screen.findByText('Quyết định đã được ghi nhận tại nguồn.');expect(api.decide).toHaveBeenCalledWith('synthetic-platform-token','clinic','approve','Synthetic reviewed source evidence',true);expect((screen.getByRole('button',{name:'Công bố hồ sơ đã duyệt'}) as HTMLButtonElement).disabled).toBe(true);
});
it('denies a legacy administrator before loading any private platform profile',async()=>{
 vi.mocked(current).mockResolvedValue({userId:'admin',legacyRoles:['ROLE_ADMIN'],platformOperator:false});await login();await screen.findByText('Tài khoản chưa được cấp quyền kiểm duyệt nền tảng.');expect(api.list).not.toHaveBeenCalled();expect(api.detail).not.toHaveBeenCalled();expect(api.capabilities).not.toHaveBeenCalled();
});

it('preserves decision text until explicit discard and locks the review chrome',async()=>{
 const user=await login();await user.click(await screen.findByRole('button',{name:'Mở hồ sơ Synthetic source clinic'}));
 await user.type(await screen.findByLabelText('Lý do quyết định'),'Cần bổ sung phạm vi giấy phép');
 expect(screen.getByLabelText('Trạng thái hồ sơ')).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Cập nhật danh sách'})).toHaveProperty('disabled',true);
 expect(screen.getByRole('button',{name:'Đăng xuất kiểm duyệt'})).toHaveProperty('disabled',true);
 expect(screen.getByLabelText('Lý do quyết định')).toHaveProperty('value','Cần bổ sung phạm vi giấy phép');
 await user.click(screen.getByRole('button',{name:'Bỏ nội dung quyết định chưa gửi'}));
 expect(screen.getByLabelText('Trạng thái hồ sơ')).toHaveProperty('disabled',false);expect(api.decide).not.toHaveBeenCalled();
});
