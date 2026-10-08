// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {App} from '../App';
import {requestJson} from '../api/client';
const roles:Record<string,string>={owner:'ADMIN',reception:'STAFF',doctor:'DOCTOR',lab:'DOCTOR',cashier:'STAFF'};
let logins=0,activeRole='owner',revoked=false,invited=false;
const source={id:'clinic',ownerUserId:'owner',name:'Phòng khám kiểm thử',slug:'test-clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',version:1,branches:[{id:'branch',name:'Cơ sở kiểm thử',active:true,address:'Mẫu',openingHours:'08-17'}]};
beforeEach(()=>{
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
 logins=0;activeRole='owner';revoked=false;invited=false;roles.doctor='DOCTOR';window.history.replaceState(null,'','/workspace');
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  const path=new URL(url,'http://localhost').pathname;
  if(path.endsWith('/api/auth/login')){logins++;activeRole=JSON.parse(init!.body as string).email.split('@')[0];return Response.json({data:{accessToken:'token-'+activeRole}});}
  if(path.endsWith('/api/me/current'))return Response.json({userId:activeRole,legacyRoles:['ROLE_PATIENT'],platformOperator:activeRole==='platform'});
  if(path.endsWith('/api/me/contexts'))return Response.json(revoked||!roles[activeRole]?[]:[{membershipId:'membership',clinicId:'clinic',role:roles[activeRole],allBranches:roles[activeRole]==='ADMIN',branchIds:['branch'],version:1}]);
  if(path.endsWith('/api/sessions/revoke-current'))return Response.json({version:2,invalidBefore:new Date().toISOString()});
  if(path.endsWith('/api/me/invitations'))return Response.json(invited?[{id:'new-admin',userId:'doctor',clinicId:'clinic',role:'ADMIN',status:'INVITED',allBranches:true,branchIds:[],version:1}]:[]);
  if(path.endsWith('/memberships/new-admin/activate')){invited=false;roles.doctor='ADMIN';return Response.json({id:'new-admin',status:'ACTIVE'});}
  if(path.endsWith('/api/me/patient-profile'))return Response.json({patientId:'patient',fullName:'Người dùng kiểm thử',dateOfBirth:'1990-01-01',phone:'0000',email:'patient@test.invalid',version:1});
  if(path.endsWith('/reviews'))return Response.json([]);
  if(path.endsWith('/api/clinics/mine'))return Response.json([source]);
  if(path.endsWith('/api/clinics/clinic'))return Response.json(source);
  if(path.endsWith('-directory'))return Response.json(source);
  if(path.endsWith('/doctor/worklist')||path.endsWith('/doctor/service-points')||path.endsWith('/doctor-affiliations')||path.endsWith('/service-points')||path.endsWith('/reception/arrivals')||path.endsWith('/lab/orders')||path.endsWith('/billable-visits')||path.endsWith('/bills')||path.endsWith('/collection-shifts'))return Response.json([]);
  if(path.endsWith('/reception/workload'))return Response.json({items:[],nextAfter:null});
  if(path.endsWith('/reception/requests')||path.endsWith('/reception/exceptions')||path.endsWith('/reception/appointments'))return Response.json([]);
  if(path.endsWith('/operations-summary'))return Response.json({measuredAt:new Date().toISOString(),checkedIn:0,completed:0,openVisits:0,overnight:0,waitingTickets:0,servingTickets:0,awaitingResults:0,arrivalPending:0,collectedCashVnd:0,collectedBankVnd:0,collectedPosVnd:0,outstandingVnd:0,openShifts:0,submittedShifts:0});
  throw new Error('Unexpected test source: '+path);
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function login(role:string){const user=userEvent.setup();render(<App/>);await user.type(await screen.findByLabelText('Email',{exact:true}),role+'@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('button',{name:'Đăng xuất'});return user;}
it.each([['reception','Quầy tiếp nhận','reception'],['doctor','Hàng đợi khám của bác sĩ','doctor'],['lab','Kết quả xét nghiệm','lab'],['cashier','Thu phí & ca thu','billing']])('sends %s to its actual work, with no Overview or repeated login',async(role,title,view)=>{
 window.history.replaceState(null,'','/workspace?view='+view);await login(role);await screen.findByRole('heading',{name:title});expect(location.search).toContain('view='+view);expect(screen.queryByRole('button',{name:'Tổng quan'})).toBeNull();expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();expect(logins).toBe(1);
});
it('shows the approved Clinic Admin information architecture without front-desk or clinical work',async()=>{
 await login('owner');
 for(const label of ['Tổng quan vận hành','Hồ sơ phòng khám','Nhân sự','Bác sĩ & lịch làm việc','Chuyên khoa & dịch vụ','Bảng giá','Vận hành hôm nay','Tài chính & đối soát','Ngoại lệ cần xử lý','Phân quyền','Nhật ký hoạt động','Cài đặt'])expect(screen.getByRole('button',{name:label})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Tiếp nhận & hàng đợi'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Thu phí & ca thu'})).toBeNull();
 expect(screen.queryByRole('button',{name:'Danh sách khám'})).toBeNull();
});
it('keeps the owner session through configuration, settings and browser Back',async()=>{
 const user=await login('owner');await user.click(screen.getByRole('button',{name:'Hồ sơ phòng khám'}));await screen.findByRole('button',{name:'Lưu thay đổi'});expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();await user.click(screen.getByRole('button',{name:'Cài đặt'}));await screen.findByRole('heading',{name:'Cài đặt'});await act(async()=>{window.history.back();await new Promise(resolve=>setTimeout(resolve,30));});await screen.findByRole('heading',{name:'Hồ sơ phòng khám'});expect(logins).toBe(1);
});
it('refuses a billing account deep link to clinical work without loading clinical data',async()=>{
 window.history.replaceState(null,'','/workspace?view=doctor&clinicId=clinic');await login('cashier');await screen.findByRole('heading',{name:'Màn hình chưa được cấp quyền'});expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('/doctor/worklist'))).toBe(false);
});
it('does not substitute another clinic for a stale Workspace link',async()=>{
 window.history.replaceState(null,'','/workspace?clinicId=other-clinic');const user=userEvent.setup();render(<App/>);await user.type(await screen.findByLabelText('Email',{exact:true}),'doctor@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Danh sách khám của bác sĩ'})).toBeNull();expect(location.search).toContain('other-clinic');
});
it('ends the Workspace session when clinic access is revoked before navigation',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');revoked=true;await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));await screen.findByRole('heading',{name:'Đăng nhập'});expect(location.pathname).toBe('/workspace/login');expect(screen.queryByRole('button',{name:'Danh sách khám'})).toBeNull();
});
it('clears every panel on sign-out and ignores a late 401 from an older token',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');await user.click(screen.getByRole('button',{name:'Đăng xuất'}));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByLabelText('Địa điểm khám')).toBeNull();
 await user.type(screen.getByLabelText('Email',{exact:true}),'owner@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('button',{name:'Đăng xuất'});await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer token-doctor'}})));expect(screen.queryByRole('button',{name:'Đăng nhập'})).toBeNull();await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer token-owner'}})));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByRole('heading',{name:'Tổng quan vận hành'})).toBeNull();
});
it('uses account revocation to clear the common session across all screens',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));await user.click(await screen.findByRole('button',{name:'Thu hồi phiên hiện tại'}));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByRole('heading',{name:'Thông tin đăng nhập'})).toBeNull();
});
it('never invalidates the current session on a failed password login with no bearer',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({error:{code:'UNAUTHORIZED'}},{status:401}));const invalid=vi.fn();window.addEventListener('clinic:session-invalid',invalid);await requestJson('/api/auth/login',{method:'POST'});expect(invalid).not.toHaveBeenCalled();window.removeEventListener('clinic:session-invalid',invalid);
});


it('refreshes the shared menu after an administrator directly changes the role',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');
 expect(screen.queryByRole('button',{name:'Hồ sơ phòng khám'})).toBeNull();await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));
 await screen.findByRole('heading',{name:'Thông tin đăng nhập'});roles.doctor='ADMIN';await user.click(screen.getByRole('button',{name:'Tải lại quyền tài khoản'}));
 await screen.findByRole('button',{name:'Hồ sơ phòng khám'});expect(logins).toBe(1);
});
it('removes revoked rights on focus while the work page is still open',async()=>{
 await login('doctor');await screen.findByLabelText('Địa điểm khám');revoked=true;
 await act(async()=>window.dispatchEvent(new Event('focus')));await waitFor(()=>expect(screen.queryByRole('button',{name:'Danh sách khám'})).toBeNull());
 expect(logins).toBe(1);
});
