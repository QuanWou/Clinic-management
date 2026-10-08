// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup,act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientFeesPanel } from '../components/PatientFeesPanel';
import { ownBills, type PatientBill } from '../api/portal';
import {methods} from '../api/payments';
vi.mock('../api/portal',()=>({ownBills:vi.fn()}));
vi.mock('../api/payments',()=>({methods:vi.fn()}));
const props={token:'synthetic-patient-token',clinic:'clinic',branch:'branch',branchName:'Synthetic Branch'};
const bill: PatientBill={id:'bill',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:40000,remainingVnd:60000,status:'PARTIALLY_PAID',issuedAt:'2026-10-01T14:00:00Z',lines:[{name:'Synthetic performed service',amountVnd:100000}],receipts:[{id:'receipt',amountVnd:40000,currency:'VND',method:'CASH',receiptCode:'RCT-SYN-001',createdAt:'2026-10-01T14:00:00Z',label:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'}]};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(methods).mockResolvedValue([]);});afterEach(cleanup);
it('shows source balances and receipts and opens payment choices for a single unpaid invoice',async()=>{
 vi.mocked(ownBills).mockResolvedValue([bill]);const user=userEvent.setup();render(<PatientFeesPanel {...props}/>);
 await screen.findByText('Đã thu một phần');
 expect(ownBills).toHaveBeenCalledWith(props.token,'clinic','branch');expect(screen.getByText(/Còn phải thu/).textContent).toContain('60.000');
 await user.click(screen.getByText('RCT-SYN-001',{selector:'span'}));expect(screen.getByText(bill.receipts[0].label)).toBeTruthy();
 expect(methods).toHaveBeenCalledWith({token:props.token,clinic:'clinic',branch:'branch'},'bill');
 expect(screen.getByRole('button',{name:'Tạo liên kết thanh toán'})).toHaveProperty('disabled',true);
});
it('ignores a late previous-account response after session changes',async()=>{
 let resolve!: (rows:PatientBill[])=>void;vi.mocked(ownBills).mockReturnValueOnce(new Promise(r=>{resolve=r;})).mockResolvedValue([]);
 const user=userEvent.setup();const view=render(<PatientFeesPanel {...props}/>);await user.click(screen.getByRole('button',{name:'Tải khoản phải thu của tôi'}));
 view.rerender(<PatientFeesPanel {...props} token="synthetic-other-patient-token"/>);await act(async()=>resolve([bill]));
 expect(screen.queryByText('Synthetic performed service')).toBeNull();expect(screen.queryByText(/RCT-SYN-001/)).toBeNull();
});
it('clears prior balances on a denied reload and permits a read-only retry',async()=>{
 vi.mocked(ownBills).mockResolvedValueOnce([bill]).mockRejectedValueOnce(new Error('Synthetic patient link revoked')).mockResolvedValueOnce([]);
 const user=userEvent.setup();render(<PatientFeesPanel {...props}/>);await screen.findByText('Đã thu một phần');
 await user.click(screen.getByRole('button',{name:'Tải khoản phải thu của tôi'}));await screen.findByRole('alert');expect(screen.queryByText('Synthetic performed service')).toBeNull();
 await user.click(screen.getByRole('button',{name:'Tải khoản phải thu của tôi'}));await screen.findByText('Bạn chưa có hóa đơn.');
});
