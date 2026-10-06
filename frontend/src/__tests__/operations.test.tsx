// @vitest-environment jsdom
import { afterEach,beforeEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup,act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OperationsPanel } from '../components/OperationsPanel';
import { signIn } from '../api/booking';
import { contexts,directory } from '../api/reception';
import * as api from '../api/operations';
vi.mock('../api/booking',()=>({signIn:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn(),directory:vi.fn()}));
vi.mock('../api/operations',()=>({encounters:vi.fn(),billing:vi.fn()}));
const encounter:api.EncounterSummary={date:'2026-10-02',measuredAt:'2026-10-01T17:30:00Z',checkedIn:2,completed:1,openVisits:1,overnight:1,awaitingResults:1,arrivalPending:0,waitingTickets:0,servingTickets:0};
const billing:api.BillingSummary={date:'2026-10-02',measuredAt:'2026-10-01T17:30:00Z',issuedVnd:100000,collectedCashVnd:40000,collectedBankVnd:0,collectedPosVnd:0,receiptCount:1,outstandingVnd:60000,openShifts:1,submittedShifts:0,approvedShifts:0};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-owner-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:false,branchIds:['branch'],version:1}]);vi.mocked(directory).mockResolvedValue({id:'clinic',name:'Synthetic granted clinic',branches:[{id:'branch',name:'Synthetic granted branch',active:true}]});vi.mocked(api.encounters).mockResolvedValue(encounter);vi.mocked(api.billing).mockResolvedValue(billing);});
afterEach(cleanup);
async function login(){const user=userEvent.setup();render(<OperationsPanel/>);await user.type(screen.getByLabelText('Email tổng quan'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu tổng quan'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tổng quan'}));await screen.findByLabelText('Ngày vận hành');return user;}
it('withholds whole-scope totals when one source fails and recovers from a fresh read',async()=>{
 vi.mocked(api.billing).mockRejectedValueOnce(new Error('Synthetic billing outage'));const user=await login();await user.click(screen.getByRole('button',{name:'Cập nhật tổng quan'}));await screen.findByRole('alert');expect(screen.queryByText('Tiền đã nhận')).toBeNull();expect(screen.getByText('Nguồn thu phí chưa tải được.')).toBeTruthy();
 await user.click(screen.getByRole('button',{name:'Cập nhật tổng quan'}));await screen.findByText('Tiền đã nhận');expect(screen.getByText(/Khoản còn phải thu hiện tại/).parentElement!.textContent).toContain('60.000');expect(api.billing).toHaveBeenCalledWith({token:'synthetic-owner-token',clinic:'clinic',branch:'branch'},expect.any(String));
});
it('discards a late summary after logout and clears previous values on a revoked directory',async()=>{
 let resolve!:(r:api.EncounterSummary)=>void;vi.mocked(api.encounters).mockReturnValueOnce(new Promise(r=>{resolve=r;}));const user=await login();await user.click(screen.getByRole('button',{name:'Cập nhật tổng quan'}));await user.click(screen.getByRole('button',{name:'Đăng xuất tổng quan'}));await act(async()=>resolve(encounter));expect(screen.queryByText('Tiền đã nhận')).toBeNull();expect(screen.queryByText('Synthetic granted branch')).toBeNull();
 await user.type(screen.getByLabelText('Mật khẩu tổng quan'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tổng quan'}));await screen.findByLabelText('Ngày vận hành');await user.click(screen.getByRole('button',{name:'Cập nhật tổng quan'}));await screen.findByText('Tiền đã nhận');vi.mocked(directory).mockRejectedValueOnce(new Error('Synthetic membership revoked'));await user.click(screen.getByRole('button',{name:'Cập nhật tổng quan'}));await screen.findByRole('alert');expect(screen.queryByText('Tiền đã nhận')).toBeNull();
});
it('rejects a reception-only identity before loading a source report',async()=>{
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1}]);const user=userEvent.setup();render(<OperationsPanel/>);await user.type(screen.getByLabelText('Email tổng quan'),'synthetic@example.invalid');await user.type(screen.getByLabelText('Mật khẩu tổng quan'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập tổng quan'}));await screen.findByRole('alert');expect(api.encounters).not.toHaveBeenCalled();expect(api.billing).not.toHaveBeenCalled();expect(directory).not.toHaveBeenCalled();
});
