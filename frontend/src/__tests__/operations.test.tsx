// @vitest-environment jsdom
import {afterEach,beforeEach,it,expect,vi} from 'vitest';
import {render,screen,cleanup,act,within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {OperationsPanel} from '../components/OperationsPanel';
import {signIn} from '../api/booking';
import {contexts,directory} from '../api/reception';
import * as api from '../api/operations';
vi.mock('../api/booking',()=>({signIn:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn(),directory:vi.fn()}));
vi.mock('../api/configuration',()=>({staff:async()=>[],affiliations:async()=>[],assignments:async()=>[]}));
vi.mock('../api/operations',()=>({encounters:vi.fn(),billing:vi.fn(),exceptions:async()=>[]}));
vi.mock('../api/realtime',()=>({receptionSubscription:(scope:unknown,source:string)=>({scope,source}),subscribeRealtime:()=>()=>{}}));
const encounter={date:'2026-10-07',measuredAt:'2026-10-07T01:00:00Z',checkedIn:2,completed:1,openVisits:1,overnight:0,awaitingResults:0,arrivalPending:0,waitingTickets:0,servingTickets:0};
const billing={date:'2026-10-07',measuredAt:'2026-10-07T01:00:00Z',issuedVnd:100000,collectedCashVnd:40000,collectedBankVnd:0,collectedPosVnd:0,receiptCount:1,outstandingVnd:60000,openShifts:1,submittedShifts:0,approvedShifts:0};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(signIn).mockResolvedValue({data:{accessToken:'owner-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:false,branchIds:['branch'],version:1}]);vi.mocked(directory).mockResolvedValue({id:'clinic',name:'Granted clinic',branches:[{id:'branch',name:'Granted branch',active:true}]});vi.mocked(api.encounters).mockResolvedValue(encounter);vi.mocked(api.billing).mockResolvedValue(billing);});
afterEach(cleanup);
async function login(mode:'finance'|'overview'='finance'){const user=userEvent.setup();render(<OperationsPanel mode={mode}/>);await user.type(screen.getByLabelText('Email quản trị'),'owner@example.invalid');await user.type(screen.getByLabelText('Mật khẩu'),'password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByLabelText('Ngày vận hành');return user;}
it('does not present an unavailable branch source as zero in overview totals',async()=>{
 vi.mocked(api.encounters).mockRejectedValueOnce(new Error('Encounter outage'));vi.mocked(api.billing).mockRejectedValueOnce(new Error('Billing outage'));
 const user=await login('overview');await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu vận hành'}));await screen.findByText('Một phần dữ liệu giám sát chưa tải được');
 const snapshot=within(screen.getByLabelText('Vận hành hôm nay'));
 expect(snapshot.getByText('Đã tiếp nhận').nextElementSibling?.textContent).toBe('—');expect(screen.getByText('Đã thu').nextElementSibling?.textContent).toBe('—');
 await act(async()=>{window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,160));});
 expect(snapshot.getByText('Đã tiếp nhận').nextElementSibling?.textContent).toBe('2');expect(screen.getByText('Đã thu').nextElementSibling?.textContent).toContain('40.000');
});
it('reports a failed source and automatically recovers its authoritative finance values on focus',async()=>{
 vi.mocked(api.billing).mockRejectedValueOnce(new Error('Billing outage'));const user=await login();await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu vận hành'}));await screen.findByText('Granted branch');expect(screen.getByText('Phải thu').nextElementSibling?.textContent).toBe('—');
 await act(async()=>{window.dispatchEvent(new Event('focus'));await new Promise(r=>setTimeout(r,160));});expect(screen.getByText('Phải thu').nextElementSibling?.textContent).toContain('60.000');expect(api.billing).toHaveBeenCalledWith({token:'owner-token',clinic:'clinic',branch:'branch'},expect.any(String));
});
it('discards a late summary after logout and clears values when directory access is revoked',async()=>{
 let finish!:(value:typeof encounter)=>void;vi.mocked(api.encounters).mockReturnValueOnce(new Promise(r=>{finish=r;}));const user=await login();await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu vận hành'}));await user.click(screen.getByRole('button',{name:'Đăng xuất'}));await act(async()=>finish(encounter));expect(screen.queryByText('Granted branch')).toBeNull();
 await user.type(screen.getByLabelText('Mật khẩu'),'password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByLabelText('Ngày vận hành');await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu vận hành'}));await screen.findByText('Granted branch');vi.mocked(directory).mockRejectedValueOnce(new Error('Membership revoked'));await user.click(screen.getByRole('button',{name:'Cập nhật dữ liệu vận hành'}));await screen.findByRole('alert');expect(screen.queryByText('Granted branch')).toBeNull();
});
it('rejects a reception-only identity before loading an administrative report',async()=>{
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1}]);const user=userEvent.setup();render(<OperationsPanel/>);await user.type(screen.getByLabelText('Email quản trị'),'staff@example.invalid');await user.type(screen.getByLabelText('Mật khẩu'),'password');await user.click(screen.getByRole('button',{name:'Đăng nhập'}));await screen.findByRole('alert');expect(api.encounters).not.toHaveBeenCalled();expect(api.billing).not.toHaveBeenCalled();expect(directory).not.toHaveBeenCalled();
});
