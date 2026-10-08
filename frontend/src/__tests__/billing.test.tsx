// @vitest-environment jsdom
import { beforeEach,afterEach,it,expect,vi } from 'vitest';
import { render,screen,cleanup,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CashierPanel } from '../components/CashierPanel';
import * as api from '../api/billing';
import {staffIntents,staffMethods,launchDisplay} from '../api/payments';
vi.mock('../api/payments',()=>({staffIntents:vi.fn(),staffMethods:vi.fn(),launchDisplay:vi.fn()}));
import { contexts } from '../api/reception';
import { signIn,RequestError } from '../api/booking';
vi.mock('../api/billing',()=>({directory:vi.fn(),current:vi.fn(),visits:vi.fn(),bills:vi.fn(),shifts:vi.fn(),receipts:vi.fn(),notificationState:vi.fn().mockResolvedValue({pending:0,delivered:0,manualContact:0,failed:0}),chargeState:vi.fn().mockResolvedValue({events:[],chargeCount:0}),deliveryState:vi.fn().mockResolvedValue({events:[]}),issue:vi.fn(),open:vi.fn(),collect:vi.fn(),adjust:vi.fn(),submit:vi.fn(),approve:vi.fn()}));
vi.mock('../api/reception',()=>({contexts:vi.fn()}));
vi.mock('../api/booking',async original=>({...await original<typeof import('../api/booking')>(),signIn:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn(async()=>crypto.randomUUID())}));
const scope={token:'synthetic-token',clinic:'clinic',branch:'branch'};
const bill={id:'bill',encounterId:'visit',patientId:'patient',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:0,remainingVnd:100000,status:'ISSUED',version:0,lines:[{chargeId:'charge',sourceType:'MEDICAL_ORDER',sourceId:'order',name:'Synthetic performed service',amountVnd:100000}]};
const shift={id:'shift',collectorUserId:'cashier',state:'OPEN',version:0,expectedCashVnd:40000,expectedBankVnd:0,expectedPosVnd:0,declaredCashVnd:null,declaredBankVnd:null,declaredPosVnd:null,varianceVnd:null,approvedBy:null};
const receipt={id:'receipt',billId:'bill',shiftId:'shift',collectorUserId:'cashier',amountVnd:40000,currency:'VND',method:'CASH',externalRef:null,receiptCode:'RCT-SYN-001',createdAt:'2026-10-01T14:00:00Z',label:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'};
beforeEach(()=>{vi.resetAllMocks();vi.mocked(staffIntents).mockResolvedValue([]);vi.mocked(staffMethods).mockResolvedValue([{code:'BANK_TRANSFER',name:'Chuyển khoản QR',available:true,message:'QR tại quầy.'},{code:'PAYOS',name:'payOS',available:true,message:'QR payOS.'},{code:'VNPAY',name:'VNPAY',available:true,message:'VNPAY.'}]);vi.mocked(launchDisplay).mockResolvedValue({method:'PAYOS',displayUrl:'http://127.0.0.1:4176/payment-display/synthetic-token',checkoutUrl:null,expiresAt:new Date(Date.now()+900000).toISOString(),status:'PENDING'});vi.mocked(signIn).mockResolvedValue({data:{accessToken:'synthetic-token'}});vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1}]);vi.mocked(api.directory).mockResolvedValue({id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true},{id:'other',name:'Other granted branch',active:true}]});vi.mocked(api.current).mockResolvedValue({userId:'cashier'});vi.mocked(api.visits).mockResolvedValue([{id:'visit',patientId:'patient',appointmentId:null,status:'CLOSED',medicalCaseVersion:7,visitCode:'S2-20261001-0001'}]);vi.mocked(api.bills).mockResolvedValue([bill]);vi.mocked(api.shifts).mockResolvedValue([shift]);vi.mocked(api.receipts).mockResolvedValue([]);});
afterEach(cleanup);
it('rejects the requested clinic after losing its grant even when another clinic is allowed',async()=>{const previous=location.href;history.replaceState(null,'','/workspace?view=billing&clinicId=revoked-clinic');try{const user=userEvent.setup();render(<CashierPanel/>);await user.type(screen.getByLabelText('Email thu ngân'),'cashier@example.invalid');await user.type(screen.getByLabelText('Mật khẩu thu ngân'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập thu phí'}));await screen.findByRole('alert');expect(api.directory).not.toHaveBeenCalled();expect(api.current).not.toHaveBeenCalled();expect(screen.queryByLabelText('Địa điểm thu phí')).toBeNull();}finally{history.replaceState(null,'',previous);}});
async function desk(){const user=userEvent.setup();render(<CashierPanel/>);await user.type(screen.getByLabelText('Email thu ngân'),'cashier@example.invalid');await user.type(screen.getByLabelText('Mật khẩu thu ngân'),'synthetic-password');await user.click(screen.getByRole('button',{name:'Đăng nhập thu phí'}));await user.selectOptions(await screen.findByLabelText('Địa điểm thu phí'),'branch');await user.selectOptions(await screen.findByLabelText('Danh sách phiếu'),'all');await user.click(await screen.findByRole('button',{name:/Chọn phiếu/}));await user.click(screen.getByRole('button',{name:'Ca làm việc & đối chiếu'}));await user.selectOptions(screen.getByLabelText('Ca thu'),'shift');await user.click(screen.getByRole('button',{name:'Thu tiền bệnh nhân'}));await user.type(screen.getByLabelText('Lý do lập phiếu hoặc xử lý'),'Synthetic collection');if(screen.queryByLabelText('Số tiền VND'))await user.type(screen.getByLabelText('Số tiền VND'),'40000');return user;}
it('collects a partial onsite payment with server version and an accurately labeled internal receipt',async()=>{vi.mocked(api.collect).mockResolvedValue(receipt);const user=await desk();vi.mocked(api.bills).mockResolvedValue([{...bill,paidVnd:40000,remainingVnd:60000,version:1,status:'PARTIALLY_PAID'}]);await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));expect(api.collect).not.toHaveBeenCalled();await user.click(await screen.findByRole('button',{name:'Xác nhận ghi nhận tiền'}));await screen.findByRole('heading',{name:receipt.label});expect(api.collect).toHaveBeenCalledWith(scope,'bill',{expectedVersion:0,shiftId:'shift',amountVnd:40000,method:'CASH',externalRef:null,reason:'Synthetic collection'},expect.any(String));expect(api.adjust).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Duyệt giảm khoản phải thu'})).toBeNull();expect(screen.getByLabelText('Số tiền VND')).toHaveProperty('value','');});
it('retains the exact amount, version and key after an unknown collection response',async()=>{vi.mocked(api.collect).mockRejectedValueOnce(new Error('Synthetic response lost')).mockResolvedValueOnce(receipt);const user=await desk();await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));await user.click(await screen.findByRole('button',{name:'Xác nhận ghi nhận tiền'}));await screen.findByRole('alert');expect(screen.getByLabelText('Số tiền VND').closest('fieldset')?.disabled).toBe(true);await user.click(screen.getByRole('button',{name:'Thử lại thu phí đang chờ'}));await screen.findByRole('heading',{name:receipt.label});expect(vi.mocked(api.collect).mock.calls[0]).toEqual(vi.mocked(api.collect).mock.calls[1]);});
it('automatically reconciles an acknowledged collection after a transient balance refresh failure',async()=>{vi.mocked(api.collect).mockResolvedValue(receipt);const user=await desk();vi.mocked(api.bills).mockRejectedValueOnce(new Error('Synthetic balance refresh failed'));await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));expect(api.collect).not.toHaveBeenCalled();await user.click(await screen.findByRole('button',{name:'Xác nhận ghi nhận tiền'}));await screen.findByRole('heading',{name:receipt.label});await waitFor(()=>expect(screen.getByLabelText('Số tiền VND').closest('fieldset')?.disabled).toBe(false));expect(screen.queryByRole('alert')).toBeNull();expect(screen.queryByRole('button',{name:/Tải/i})).toBeNull();expect(api.collect).toHaveBeenCalledTimes(1);});
it('rejects a fractional VND amount or missing confirmed POS reference before sending money mutation',async()=>{const user=await desk();await user.clear(screen.getByLabelText('Số tiền VND'));await user.type(screen.getByLabelText('Số tiền VND'),'0.5');await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));await screen.findByRole('alert');expect(api.collect).not.toHaveBeenCalled();await user.clear(screen.getByLabelText('Số tiền VND'));await user.type(screen.getByLabelText('Số tiền VND'),'40000');await user.selectOptions(screen.getByLabelText('Hình thức nhận tiền'),'POS');expect(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'})).toHaveProperty('disabled',true);expect(api.collect).not.toHaveBeenCalled();});
it('submits counted shift totals and preserves the server variance for separate approval',async()=>{vi.mocked(api.submit).mockResolvedValue({...shift,state:'SUBMITTED',version:1,varianceVnd:-100,expectedCashVnd:40000,expectedBankVnd:0,expectedPosVnd:0});const user=await desk();vi.mocked(api.shifts).mockResolvedValueOnce([shift]).mockResolvedValue([{...shift,state:'SUBMITTED',version:1,varianceVnd:-100,expectedCashVnd:40000}]);await user.click(screen.getByRole('button',{name:'Ca làm việc & đối chiếu'}));await user.type(screen.getByLabelText('Lý do lập phiếu hoặc xử lý'),'Đối chiếu kết thúc ca');await user.clear(screen.getByLabelText('Tiền mặt kiểm đếm VND'));await user.type(screen.getByLabelText('Tiền mặt kiểm đếm VND'),'39900');await user.click(screen.getByRole('button',{name:'Gửi chốt ca'}));await screen.findByText(/Chênh lệch kiểm đếm/);expect(api.submit).not.toHaveBeenCalled();await user.click(screen.getByRole('button',{name:'Xác nhận gửi chốt ca'}));await screen.findByText('Đã gửi chốt ca. Chờ Quản trị đối chiếu và duyệt.');expect(api.submit).toHaveBeenCalledWith(scope,'shift',expect.objectContaining({expectedVersion:0,declaredCashVnd:39900,declaredBankVnd:0,declaredPosVnd:0}),expect.any(String));expect(screen.queryByRole('button',{name:'Duyệt chốt ca và chênh lệch'})).toBeNull();});
it('clears previous branch bills and receipts when the new branch is denied',async()=>{const user=await desk();vi.mocked(api.visits).mockRejectedValueOnce(new RequestError('Synthetic branch revoked',403));await user.selectOptions(screen.getByLabelText('Địa điểm thu phí'),'other');await screen.findByText('Synthetic branch revoked');expect(screen.queryByText('Khoản phải thu')).toBeNull();expect(screen.queryByRole('button',{name:'Ghi nhận tiền đã nhận'})).toBeNull();});

it('previews grouped Vietnamese money and sends one thousand dong for 1.000',async()=>{
 const user=await desk();await user.clear(screen.getByLabelText('Số tiền VND'));await user.type(screen.getByLabelText('Số tiền VND'),'1.000');
 expect(screen.getByText(/Số tiền: 1.000/)).toBeTruthy();vi.mocked(api.collect).mockResolvedValue({...receipt,amountVnd:1000});
 await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));expect(api.collect).not.toHaveBeenCalled();await user.click(await screen.findByRole('button',{name:'Xác nhận ghi nhận tiền'}));await screen.findByRole('heading',{name:receipt.label});
 expect(api.collect).toHaveBeenCalledWith(scope,'bill',expect.objectContaining({amountVnd:1000}),expect.any(String));
});
it('does not describe an empty legacy invoice as fully paid',async()=>{
 vi.mocked(api.bills).mockResolvedValue([{...bill,subtotalVnd:0,remainingVnd:0,lines:[],status:'PAID'}]);await desk();
 expect(screen.queryByRole('button',{name:'Ghi nhận tiền đã nhận'})).toBeNull();expect(screen.getByText('Chưa ghi nhận dịch vụ')).toBeTruthy();expect(screen.queryByText('Đã thu đủ')).toBeNull();
});

it('cancels collection review without writing a receipt or losing the amount',async()=>{
 const user=await desk();await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));
 await screen.findByRole('dialog');expect(api.collect).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:/Tải/i})).toBeNull();
 await waitFor(()=>expect(screen.getByRole('button',{name:'Quay lại kiểm tra'})).toHaveProperty('disabled',false));await user.keyboard('{Escape}');await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(screen.getByLabelText('Số tiền VND')).toHaveProperty('value','40000');expect(api.collect).not.toHaveBeenCalled();
});
it('fills the balance and calculates cash change without posting the tendered amount',async()=>{
 const user=await desk();await user.click(screen.getByRole('button',{name:'Điền đủ số dư'}));expect(screen.getByLabelText('Số tiền VND')).toHaveProperty('value','100000');
 await user.type(screen.getByLabelText('Tiền khách đưa (tùy chọn)'),'200000');expect(screen.getByText(/Tiền trả lại: 100.000/)).toBeTruthy();
 vi.mocked(api.collect).mockResolvedValue({...receipt,amountVnd:100000});
 await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));expect(api.collect).not.toHaveBeenCalled();
 await user.click(await screen.findByRole('button',{name:'Xác nhận ghi nhận tiền'}));await screen.findByRole('heading',{name:receipt.label});
 expect(api.collect).toHaveBeenCalledWith(scope,'bill',expect.objectContaining({amountVnd:100000,externalRef:null}),expect.any(String));
});
it('rejects insufficient cash and clears the cash helper when switching payment method',async()=>{
 const user=await desk();await user.type(screen.getByLabelText('Tiền khách đưa (tùy chọn)'),'10000');
 await user.click(screen.getByRole('button',{name:'Ghi nhận tiền đã nhận'}));await screen.findByText('Tiền khách đưa chưa đủ cho khoản thu này.');expect(api.collect).not.toHaveBeenCalled();
 await user.selectOptions(screen.getByLabelText('Hình thức nhận tiền'),'POS');expect(screen.queryByLabelText('Tiền khách đưa (tùy chọn)')).toBeNull();
});
it('shows an explicit fallback when the browser blocks the customer payment window',async()=>{
 const user=await desk();const open=vi.spyOn(window,'open').mockReturnValue(null);
 try{await user.selectOptions(screen.getByLabelText('Hình thức nhận tiền'),'PAYOS');await user.click(screen.getByRole('button',{name:'Tạo & hiển thị QR payOS'}));await screen.findByText('Trình duyệt đã chặn cửa sổ thanh toán.');expect(launchDisplay).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Mở màn hình thanh toán'})).toBeTruthy();}finally{open.mockRestore();}
});
it('never exposes manual collection for payOS and reuses the active customer display without a second intent request',async()=>{
 const user=await desk();const opened={closed:false,focus:vi.fn(),location:{href:''}} as unknown as Window;const open=vi.spyOn(window,'open').mockReturnValue(opened);
 try{await user.selectOptions(screen.getByLabelText('Hình thức nhận tiền'),'PAYOS');expect(screen.queryByRole('button',{name:'Ghi nhận tiền đã nhận'})).toBeNull();expect(screen.queryByLabelText('Lý do lập phiếu hoặc xử lý')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Tạo & hiển thị QR payOS'}));await waitFor(()=>expect(launchDisplay).toHaveBeenCalledTimes(1));expect(launchDisplay).toHaveBeenCalledWith(scope,'bill',{method:'PAYOS',expectedVersion:0},expect.any(String));expect(opened.location.href).toContain('/payment-display/synthetic-token');
  await user.click(screen.getByRole('button',{name:'Tạo & hiển thị QR payOS'}));await waitFor(()=>expect(open).toHaveBeenCalledTimes(2));expect(launchDisplay).toHaveBeenCalledTimes(1);expect(api.collect).not.toHaveBeenCalled();
 }finally{open.mockRestore();}
});
it('requires a separate confirmation for manager fee reduction',async()=>{
 vi.mocked(contexts).mockResolvedValue([{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}]);
 const user=await desk();vi.mocked(api.adjust).mockResolvedValue({...bill,adjustmentVnd:40000,remainingVnd:60000,version:1});
 await user.click(screen.getByRole('button',{name:'Duyệt giảm khoản phải thu'}));await screen.findByText('Xem lại khoản giảm phí');expect(api.adjust).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Xác nhận giảm phí'}));await waitFor(()=>expect(api.adjust).toHaveBeenCalledTimes(1));expect(api.collect).not.toHaveBeenCalled();
});
it('exposes unbilled visits as a table and issues only the selected visit without collecting money',async()=>{
 const user=await desk();vi.mocked(api.visits).mockResolvedValue([{id:'new-visit',patientId:'new-patient',appointmentId:null,status:'CLOSED',medicalCaseVersion:1,patient:{patientId:'new-patient',patientCode:'P2',fullName:'New Patient',dateOfBirth:null}}]);
 await user.selectOptions(screen.getByLabelText('Địa điểm thu phí'),'other');await user.click(screen.getByRole('button',{name:/^Chưa lập phiếu ·/}));
 await user.click(await screen.findByRole('button',{name:'Đối chiếu dịch vụ'}));vi.mocked(api.issue).mockResolvedValue({...bill,id:'new-bill',encounterId:'new-visit'});
 await user.click(screen.getByRole('button',{name:'Lập phiếu thu từ dịch vụ thực'}));await waitFor(()=>expect(api.issue).toHaveBeenCalledWith(expect.objectContaining({branch:'other'}),'new-visit','Lập phiếu thu dịch vụ đã thực hiện',expect.any(String)));
 expect(api.collect).not.toHaveBeenCalled();
});

