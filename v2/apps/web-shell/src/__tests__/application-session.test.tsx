// @vitest-environment jsdom
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {App} from '../App';
import {requestJson} from '../api/client';
const roles:Record<string,string>={owner:'CLINIC_OWNER',reception:'RECEPTIONIST',doctor:'DOCTOR',lab:'LAB',cashier:'CASHIER'};
let logins=0,activeRole='owner',revoked=false;
const source={id:'clinic',ownerUserId:'owner',name:'Phòng khám kiểm thử',slug:'test-clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',version:1,branches:[{id:'branch',name:'Cơ sở kiểm thử',active:true,address:'Mẫu',openingHours:'08-17'}]};
beforeEach(()=>{
 Object.defineProperty(HTMLElement.prototype,'scrollIntoView',{configurable:true,value:vi.fn()});
 logins=0;activeRole='owner';revoked=false;window.history.replaceState(null,'','/workspace');
 vi.stubGlobal('fetch',vi.fn(async(url:string,init?:RequestInit)=>{
  const path=new URL(url,'http://localhost').pathname;
  if(path.endsWith('/api/auth/login')){logins++;activeRole=JSON.parse(init!.body as string).email.split('@')[0];return Response.json({data:{accessToken:'token-'+activeRole}});}
  if(path.endsWith('/api/v2/me/current'))return Response.json({userId:activeRole,legacyRoles:['ROLE_PATIENT'],platformOperator:activeRole==='platform'});
  if(path.endsWith('/api/v2/me/contexts'))return Response.json(revoked||!roles[activeRole]?[]:[{membershipId:'membership',clinicId:'clinic',role:roles[activeRole],allBranches:activeRole==='owner',branchIds:['branch'],version:1}]);
  if(path.endsWith('/api/v2/sessions/revoke-current'))return Response.json({version:2,invalidBefore:new Date().toISOString()});
  if(path.endsWith('/api/v2/me/invitations'))return Response.json([]);
  if(path.endsWith('/api/v2/me/patient-profile'))return Response.json({patientId:'patient',fullName:'Người dùng kiểm thử',dateOfBirth:'1990-01-01',phone:'0000',email:'patient@test.invalid',version:1});
  if(path.endsWith('/api/v2/clinics/mine'))return Response.json([source]);
  if(path.endsWith('/api/v2/clinics/clinic'))return Response.json(source);
  if(path.endsWith('-directory'))return Response.json(source);
  if(path.endsWith('/doctor/worklist')||path.endsWith('/doctor/service-points')||path.endsWith('/doctor-affiliations')||path.endsWith('/service-points')||path.endsWith('/reception/arrivals')||path.endsWith('/lab/orders')||path.endsWith('/billable-visits')||path.endsWith('/bills')||path.endsWith('/collection-shifts'))return Response.json([]);
  if(path.endsWith('/operations-summary'))return Response.json({measuredAt:new Date().toISOString(),checkedIn:0,completed:0,openVisits:0,overnight:0,waitingTickets:0,servingTickets:0,awaitingResults:0,arrivalPending:0,collectedCashVnd:0,collectedBankVnd:0,collectedPosVnd:0,outstandingVnd:0,openShifts:0,submittedShifts:0});
  throw new Error('Unexpected test source: '+path);
 }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
async function login(role:string){const user=userEvent.setup();render(<App/>);await user.type(screen.getByLabelText('Email',{exact:true}),role+'@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('button',{name:'Đăng xuất'});return user;}
it.each([['reception','Tiếp nhận & hàng đợi','reception'],['doctor','Danh sách khám của bác sĩ','doctor'],['lab','Chỉ định và kết quả lab','lab'],['cashier','Thu phí tại quầy','billing']])('sends %s to its actual work, with no Overview or repeated login',async(role,title,view)=>{
 await login(role);await screen.findByRole('heading',{name:title});expect(location.search).toContain('view='+view);expect(screen.queryByRole('button',{name:'Tổng quan'})).toBeNull();expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();expect(logins).toBe(1);
});
it('keeps the owner session through configuration, settings and browser Back',async()=>{
 const user=await login('owner');await user.click(screen.getByRole('button',{name:'Hồ sơ phòng khám'}));await screen.findByRole('button',{name:'Lưu hồ sơ phòng khám'});expect(screen.queryByLabelText(/Mật khẩu/)).toBeNull();await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));await screen.findByRole('heading',{name:'Tài khoản của tôi'});await act(async()=>{window.history.back();await new Promise(resolve=>setTimeout(resolve,30));});await screen.findByRole('heading',{name:'Hồ sơ phòng khám'});expect(logins).toBe(1);
});
it('refuses a billing account deep link to clinical work without loading clinical data',async()=>{
 window.history.replaceState(null,'','/workspace?view=doctor&clinicId=clinic');await login('cashier');await screen.findByRole('heading',{name:'Màn hình chưa được cấp quyền'});expect(vi.mocked(fetch).mock.calls.some(([url])=>String(url).includes('/doctor/worklist'))).toBe(false);
});
it('does not substitute another clinic for a stale Workspace link',async()=>{
 window.history.replaceState(null,'','/workspace?clinicId=other-clinic');const user=userEvent.setup();render(<App/>);await user.type(screen.getByLabelText('Email',{exact:true}),'doctor@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('alert');expect(screen.queryByRole('heading',{name:'Danh sách khám của bác sĩ'})).toBeNull();expect(location.search).toContain('other-clinic');
});
it('drops revoked navigation rights and never opens the destination data',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');revoked=true;await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));await screen.findByRole('heading',{name:'Tài khoản của tôi'});expect(screen.queryByRole('button',{name:'Danh sách khám'})).toBeNull();
});
it('clears every panel on sign-out and ignores a late 401 from an older token',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');await user.click(screen.getByRole('button',{name:'Đăng xuất'}));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByLabelText('Địa điểm khám')).toBeNull();
 await user.type(screen.getByLabelText('Email',{exact:true}),'owner@test.invalid');await user.type(screen.getByLabelText('Mật khẩu',{exact:true}),'test-password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('button',{name:'Đăng xuất'});await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer token-doctor'}})));expect(screen.queryByRole('button',{name:'Đăng nhập'})).toBeNull();await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer token-owner'}})));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByRole('heading',{name:'Tổng quan vận hành'})).toBeNull();
});
it('uses account revocation to clear the common session across all screens',async()=>{
 const user=await login('doctor');await screen.findByLabelText('Địa điểm khám');await user.click(screen.getByRole('button',{name:'Cài đặt tài khoản'}));await user.click(await screen.findByRole('button',{name:'Thu hồi phiên hiện tại'}));await screen.findByRole('button',{name:'Đăng nhập'});expect(screen.queryByRole('heading',{name:'Tài khoản của tôi'})).toBeNull();
});
it('never invalidates the current session on a failed password login with no bearer',async()=>{
 vi.mocked(fetch).mockResolvedValueOnce(Response.json({error:{code:'UNAUTHORIZED'}},{status:401}));const invalid=vi.fn();window.addEventListener('clinic:session-invalid',invalid);await requestJson('/api/auth/login',{method:'POST'});expect(invalid).not.toHaveBeenCalled();window.removeEventListener('clinic:session-invalid',invalid);
});

