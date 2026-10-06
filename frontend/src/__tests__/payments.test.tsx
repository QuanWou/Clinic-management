// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {PatientPaymentPanel} from '../components/PatientPaymentPanel';
import * as api from '../api/payments';
import {RequestError} from '../api/booking';
import type {PatientBill} from '../api/portal';
vi.mock('../api/payments',()=>({methods:vi.fn(),create:vi.fn(),read:vi.fn(),cancel:vi.fn(),bank:vi.fn()}));
vi.mock('../api/idempotency',()=>({stableOperationKey:vi.fn().mockResolvedValue('synthetic-payment-key')}));
const scope={token:'synthetic-patient',clinic:'clinic',branch:'branch'};
const bill:PatientBill={id:'bill',version:3,currency:'VND',subtotalVnd:180000,adjustmentVnd:0,paidVnd:0,remainingVnd:180000,status:'ISSUED',issuedAt:'2026-10-03T00:00:00Z',lines:[],receipts:[]};
const pending:api.PaymentIntent={id:'intent',billId:'bill',provider:'VNPAY',status:'PENDING',amountVnd:180000,currency:'VND',checkoutUrl:'https://sandbox.vnpayment.vn/pay',qrCode:null,expiresAt:new Date(Date.now()+900000).toISOString(),receiptId:null,message:'Đang chờ cổng xác nhận.'};
const choices:api.PaymentMethod[]=[{code:'PAYOS',name:'payOS · QR ngân hàng',available:false,message:'QR'},{code:'VNPAY',name:'VNPAY · Thẻ và ngân hàng',available:true,message:'Môi trường thử nghiệm VNPAY.'},{code:'BANK_TRANSFER',name:'Chuyển khoản QR',available:true,message:'Lễ tân đối chiếu.'},{code:'ONSITE',name:'Thanh toán tại phòng khám',available:true,message:'Thu tại quầy.'}];
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.methods).mockResolvedValue(choices);vi.mocked(api.create).mockResolvedValue(pending);vi.mocked(api.read).mockResolvedValue(pending);});afterEach(cleanup);
async function choose(){const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Chọn cách trả phí'}));await screen.findByRole('radio',{name:/VNPAY/});return user;}
it('requires explicit method choice and uses the displayed source version without a client amount',async()=>{
 const onPaid=vi.fn();render(<PatientPaymentPanel scope={scope} bill={bill} onPaid={onPaid}/>);const user=await choose();expect((screen.getByRole('radio',{name:/payOS/}) as HTMLInputElement).disabled).toBe(true);
 await user.click(screen.getByRole('radio',{name:/VNPAY/}));await user.click(screen.getByRole('button',{name:'Tạo liên kết thanh toán'}));await screen.findByText(/Chờ xác nhận thanh toán/);
 expect(api.create).toHaveBeenCalledWith(scope,'bill',{provider:'VNPAY',expectedVersion:3},'synthetic-payment-key');expect(onPaid).not.toHaveBeenCalled();expect(screen.getByRole('link',{name:'Mở VNPAY để thanh toán'}).getAttribute('target')).toBe('_blank');
});
it('refreshes the bill only after the authorized server reports paid',async()=>{
 const onPaid=vi.fn();render(<PatientPaymentPanel scope={scope} bill={{...bill,paymentIntents:[pending]}} onPaid={onPaid}/>);await screen.findByText(/Chờ xác nhận thanh toán/);
 vi.mocked(api.read).mockResolvedValue({...pending,status:'PAID',receiptId:'receipt',message:'Phòng khám đã nhận tiền.'});const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Kiểm tra trạng thái giao dịch'}));await screen.findByText(/Đã thanh toán/);expect(onPaid).toHaveBeenCalledTimes(1);expect(api.create).not.toHaveBeenCalled();
});
it('retains the exact body and key when a create response is lost',async()=>{
 vi.mocked(api.create).mockRejectedValueOnce(new RequestError('Mất kết nối',0)).mockResolvedValueOnce(pending);render(<PatientPaymentPanel scope={scope} bill={bill} onPaid={vi.fn()}/>);const user=await choose();await user.click(screen.getByRole('radio',{name:/VNPAY/}));await user.click(screen.getByRole('button',{name:'Tạo liên kết thanh toán'}));
 await screen.findByRole('button',{name:'Kiểm tra lại yêu cầu hiện tại'});expect(screen.queryByRole('radio')).toBeNull();await user.click(screen.getByRole('button',{name:'Kiểm tra lại yêu cầu hiện tại'}));await screen.findByText(/Chờ xác nhận thanh toán/);expect(api.create).toHaveBeenCalledTimes(2);expect(vi.mocked(api.create).mock.calls[0]).toEqual(vi.mocked(api.create).mock.calls[1]);
});
it('manual QR shows the named recipient and never claims money was received',async()=>{
 vi.mocked(api.bank).mockResolvedValue({bankName:'VCB',accountName:'NGUYEN VAN A',accountNumber:'1234567890',content:'PKABC',amountVnd:180000,qrUrl:'https://img.vietqr.io/image/synthetic.png'});const onPaid=vi.fn();render(<PatientPaymentPanel scope={scope} bill={bill} onPaid={onPaid}/>);const user=await choose();await user.click(screen.getByRole('radio',{name:/Chuyển khoản QR/}));await user.click(screen.getByRole('button',{name:'Xem QR và tài khoản nhận tiền'}));await screen.findByText('NGUYEN VAN A');expect(screen.getByText(/Lễ tân đối chiếu tiền vào trước/)).toBeTruthy();expect(api.create).not.toHaveBeenCalled();expect(onPaid).not.toHaveBeenCalled();
});
it('a review blocks another payment and directs the patient to the clinic',async()=>{
 render(<PatientPaymentPanel scope={scope} bill={{...bill,paymentIntents:[{...pending,status:'REVIEW_REQUIRED',message:'Không thanh toán thêm; liên hệ phòng khám.'}]}} onPaid={vi.fn()}/>);await screen.findByText(/Không thanh toán thêm/);expect(screen.queryByRole('radio')).toBeNull();expect(screen.queryByRole('link')).toBeNull();
});

it('releases method choice only after payOS confirms link cancellation',async()=>{
 const onPaid=vi.fn();render(<PatientPaymentPanel scope={scope} bill={{...bill,paymentIntents:[{...pending,provider:'PAYOS'}]}} onPaid={onPaid}/>);await screen.findByText(/Chờ xác nhận thanh toán/);vi.mocked(api.cancel).mockResolvedValue({...pending,provider:'PAYOS',status:'CANCELLED',message:'Liên kết đã hủy.'});const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'Hủy liên kết để chọn cách khác'}));await screen.findByRole('radio',{name:/VNPAY/});expect(onPaid).not.toHaveBeenCalled();expect(api.create).not.toHaveBeenCalled();
});
