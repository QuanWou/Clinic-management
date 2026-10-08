// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {act,cleanup,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {SessionProvider,useSession} from '../auth/SessionProvider';
import {PatientLoginPage,WorkspaceLoginPage} from '../auth/LoginPage';
import {loginUrl,patientReturnTo,workspaceReturnTo} from '../auth/returnTo';
import * as booking from '../api/booking';
import {current} from '../api/configuration';
import {contexts} from '../api/reception';
import {requestJson} from '../api/client';

vi.mock('../api/booking',()=>({
 signIn:vi.fn(),refreshAuth:vi.fn(),logoutAuth:vi.fn(),
 refreshSession:vi.fn(),logoutSession:vi.fn()
}));
vi.mock('../api/configuration',()=>({current:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/client',()=>({requestJson:vi.fn()}));

const staffContext={membershipId:'membership',clinicId:'clinic-a',role:'DOCTOR',allBranches:true,branchIds:[],version:1};

beforeEach(()=>{
 window.history.replaceState(null,'','/public');
 vi.resetAllMocks();
 vi.mocked(booking.logoutAuth).mockResolvedValue({data:null} as never);
 vi.mocked(booking.logoutSession).mockResolvedValue({data:null} as never);
 vi.mocked(booking.refreshSession).mockRejectedValue(new Error('no persisted session'));
 vi.mocked(requestJson).mockResolvedValue({ok:true,status:200,data:{patientId:'patient-a'}} as never);
 vi.mocked(booking.signIn).mockImplementation(async(email:string)=>({data:{
  accessToken:email.startsWith('dual')?'dual-token':email.startsWith('staff')?'staff-token':'patient-token',
  refreshToken:email.startsWith('dual')?'dual-refresh':email.startsWith('staff')?'staff-refresh':'patient-refresh',
  email,
  fullName:email.startsWith('staff')||email.startsWith('dual')?'Bác sĩ Kiểm thử':'Bệnh nhân Kiểm thử'
 }}));
 vi.mocked(current).mockImplementation(async(token:string)=>({
  userId:token==='dual-token'?'dual-user':token==='staff-token'?'staff-user':'patient-user',
  legacyRoles:token==='staff-token'?['ROLE_DOCTOR']:['ROLE_PATIENT'],
  platformOperator:false
 }) as never);
 vi.mocked(contexts).mockImplementation(async(token:string)=>token==='staff-token'||token==='dual-token'?[staffContext] as never:[]);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});

it('keeps returnTo inside the correct product boundary',()=>{
 window.history.replaceState(null,'','/public');
 expect(patientReturnTo('/dat-lich?doctor=d1')).toBe('/dat-lich?doctor=d1');
 expect(patientReturnTo('/workspace?view=doctor')).toBeNull();
 expect(patientReturnTo('https://evil.example/steal')).toBeNull();
 expect(workspaceReturnTo('/workspace?view=doctor&clinicId=clinic-a')).toBe('/workspace?view=doctor&clinicId=clinic-a');
 expect(workspaceReturnTo('/tai-khoan/lich-kham')).toBeNull();
 expect(loginUrl('workspace','https://evil.example/steal')).toBe('/workspace/login');
});

it('renders separate Patient and Workspace login surfaces without a product selector',()=>{
 const {unmount}=render(<SessionProvider><PatientLoginPage brandName="Phòng khám kiểm thử"/></SessionProvider>);
 expect(screen.getByRole('heading',{name:'Đăng nhập'})).toBeTruthy();
 expect(screen.getByText(/^Tài khoản bệnh nhân$/i)).toBeTruthy();
 expect(screen.queryByText('Clinic Workspace')).toBeNull();
 expect(screen.getByRole('link',{name:'Tạo tài khoản'})).toBeTruthy();
 unmount();
 window.history.replaceState(null,'','/workspace/login');
 render(<SessionProvider><WorkspaceLoginPage brandName="Phòng khám kiểm thử"/></SessionProvider>);
 expect(screen.getByText('Clinic Workspace')).toBeTruthy();
 expect(screen.queryByRole('link',{name:'Tạo tài khoản'})).toBeNull();
 expect(screen.queryByText('Tài khoản bệnh nhân')).toBeNull();
});

it('rejects a pure patient account at Workspace login',async()=>{
 window.history.replaceState(null,'','/workspace/login');
 const user=userEvent.setup();
 render(<SessionProvider><WorkspaceLoginPage/></SessionProvider>);
 await user.type(screen.getByLabelText('Email'),'patient@test.invalid');
 await user.type(screen.getByLabelText('Mật khẩu'),'test-password');
 await user.click(screen.getByRole('button',{name:'Đăng nhập'}));
 expect((await screen.findByRole('alert')).textContent).toContain('không có quyền truy cập không gian làm việc');
 expect(location.pathname).toBe('/workspace/login');
});

it('rejects a staff identity at Patient login when it has no linked patient profile',async()=>{
 window.history.replaceState(null,'','/dang-nhap');
 vi.mocked(requestJson).mockResolvedValueOnce({ok:false,status:404,message:'Not found'} as never);
 const user=userEvent.setup();
 render(<SessionProvider><PatientLoginPage/></SessionProvider>);
 await user.type(screen.getByLabelText('Email'),'staff@test.invalid');
 await user.type(screen.getByLabelText('Mật khẩu'),'test-password');
 await user.click(screen.getByRole('button',{name:'Đăng nhập'}));
 expect((await screen.findByRole('alert')).textContent).toContain('chưa có hồ sơ bệnh nhân');
 expect(location.pathname).toBe('/dang-nhap');
 expect(booking.logoutSession).toHaveBeenCalledWith('patient');
});

function ChannelHarness(){
 const auth=useSession()!;
 return <div>
  <output aria-label="patient-session">{auth.patientSession?.email??'none'}</output>
  <output aria-label="workspace-session">{auth.workspaceSession?.email??'none'}</output>
  <button onClick={()=>void auth.authenticatePatient('patient@test.invalid','test-password')}>Patient in</button>
  <button onClick={()=>void auth.authenticateWorkspace('staff@test.invalid','test-password')}>Workspace in</button>
  <button onClick={()=>void auth.authenticatePatient('dual@test.invalid','test-password')}>Dual patient in</button>
  <button onClick={()=>void auth.authenticateWorkspace('dual@test.invalid','test-password')}>Dual workspace in</button>
  <button onClick={()=>auth.signOutPatient()}>Patient out</button>
  <button onClick={()=>auth.signOutWorkspace()}>Workspace out</button>
 </div>;
}

it('keeps Patient and Workspace sessions independent in the same SPA',async()=>{
 const user=userEvent.setup();
 render(<SessionProvider><ChannelHarness/></SessionProvider>);
 await user.click(screen.getByRole('button',{name:'Patient in'}));
 await waitFor(()=>expect(screen.getByLabelText('patient-session').textContent).toBe('patient@test.invalid'));
 await user.click(screen.getByRole('button',{name:'Workspace in'}));
 await waitFor(()=>expect(screen.getByLabelText('workspace-session').textContent).toBe('staff@test.invalid'));
 expect(screen.getByLabelText('patient-session').textContent).toBe('patient@test.invalid');

 await user.click(screen.getByRole('button',{name:'Patient out'}));
 await waitFor(()=>expect(screen.getByLabelText('patient-session').textContent).toBe('none'));
 expect(screen.getByLabelText('workspace-session').textContent).toBe('staff@test.invalid');
 expect(booking.logoutSession).toHaveBeenCalledWith('patient');

 await user.click(screen.getByRole('button',{name:'Workspace out'}));
 await waitFor(()=>expect(screen.getByLabelText('workspace-session').textContent).toBe('none'));
 expect(booking.logoutSession).toHaveBeenCalledWith('workspace');
});

it('restores the Workspace session from the persisted HttpOnly refresh channel',async()=>{
 window.history.replaceState(null,'','/workspace?view=doctor&clinicId=clinic-a');
 vi.mocked(booking.refreshSession).mockImplementation(async(channel)=>{
  if(channel==='workspace')return {data:{accessToken:'staff-token',email:'staff@test.invalid',fullName:'Bác sĩ Kiểm thử'}} as never;
  throw new Error('no patient session');
 });
 render(<SessionProvider><ChannelHarness/></SessionProvider>);
 await waitFor(()=>expect(screen.getByLabelText('workspace-session').textContent).toBe('staff@test.invalid'));
 expect(screen.getByLabelText('patient-session').textContent).toBe('none');
 expect(booking.refreshSession).toHaveBeenCalledWith('workspace');
 expect(booking.signIn).not.toHaveBeenCalled();
});

it('invalidates only the active channel when a dual identity receives identical access tokens',async()=>{
 const user=userEvent.setup();
 render(<SessionProvider><ChannelHarness/></SessionProvider>);
 await user.click(screen.getByRole('button',{name:'Dual patient in'}));
 await user.click(screen.getByRole('button',{name:'Dual workspace in'}));
 await waitFor(()=>expect(screen.getByLabelText('patient-session').textContent).toBe('dual@test.invalid'));
 await waitFor(()=>expect(screen.getByLabelText('workspace-session').textContent).toBe('dual@test.invalid'));

 window.history.replaceState(null,'','/public');
 await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer dual-token'}})));
 await waitFor(()=>expect(screen.getByLabelText('patient-session').textContent).toBe('none'));
 expect(screen.getByLabelText('workspace-session').textContent).toBe('dual@test.invalid');

 await user.click(screen.getByRole('button',{name:'Dual patient in'}));
 await waitFor(()=>expect(screen.getByLabelText('patient-session').textContent).toBe('dual@test.invalid'));
 window.history.replaceState(null,'','/workspace');
 await act(async()=>window.dispatchEvent(new CustomEvent('clinic:session-invalid',{detail:{authorization:'Bearer dual-token'}})));
 await waitFor(()=>expect(screen.getByLabelText('workspace-session').textContent).toBe('none'));
 expect(screen.getByLabelText('patient-session').textContent).toBe('dual@test.invalid');
});
