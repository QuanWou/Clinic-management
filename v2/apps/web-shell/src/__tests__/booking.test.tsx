// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicShell } from '../shells/PublicShell';
import * as api from '../api/booking';
import { requestJson } from '../api/client';

vi.mock('../api/booking', () => ({ getSiteClinic: vi.fn(), getClinic: vi.fn(), getDoctors: vi.fn(), getOfferings: vi.fn(), signIn: vi.fn(), saveProfile: vi.fn(), getSlots: vi.fn(), holdSlot: vi.fn(), confirmHold: vi.fn(), myAppointments: vi.fn(), cancelAppointment: vi.fn(), rescheduleAppointment: vi.fn() }));
vi.mock('../api/client', () => ({ requestJson: vi.fn() }));
vi.mock('../api/idempotency', () => ({ stableOperationKey: vi.fn(async () => crypto.randomUUID()), forgetOperationKey: vi.fn() }));
const clinic = { clinicId: 'clinic-a', name: 'Synthetic Clinic', branches: [{ branchId: 'branch-a', name: 'Synthetic Branch', address: 'Synthetic address', openingHours: '08-17' }] };
const profile = { patientId: 'patient-a', fullName: 'Synthetic Patient', dateOfBirth: '1990-01-01', sex: '', phone: '', email: '', version: 0 };
const price = { amountVnd: 100000, currency: 'VND', priceVersionId: 'price-a', effectiveFrom: '2026-01-01T00:00:00Z' };
beforeEach(() => {
 window.history.replaceState(null,'','/public/booking');
 vi.resetAllMocks();
 vi.mocked(api.getSiteClinic).mockResolvedValue(clinic);
 vi.mocked(api.getClinic).mockResolvedValue(clinic);
 vi.mocked(api.getDoctors).mockResolvedValue([{ doctorId: 'doctor-a', clinicId: 'clinic-a', branchId: 'branch-a', displayName: 'Synthetic Doctor' }]);
 vi.mocked(api.getOfferings).mockResolvedValue([{ offeringId: 'offering-a', clinicId: 'clinic-a', branchId: 'branch-a', name: 'Synthetic Offering', amountVnd: 100000, priceVersionId: 'price-a' }]);
 vi.mocked(api.signIn).mockResolvedValue({ data: { accessToken: 'synthetic-token' } });
 vi.mocked(requestJson).mockResolvedValue({ ok: true, status: 200, data: profile });
 vi.mocked(api.getSlots).mockResolvedValue([{ slotId: 'slot-a', startsAt: '2026-12-01T01:00:00Z', endsAt: '2026-12-01T01:30:00Z', remaining: 1, price }]);
 vi.mocked(api.holdSlot).mockResolvedValue({ holdId: 'hold-a', state: 'ACTIVE', expiresAt: new Date(Date.now() + 600000).toISOString(), price });
 vi.mocked(api.confirmHold).mockResolvedValue({ id: 'appointment-a', appointmentCode: 'AP-SYN', clinicId: 'clinic-a', status: 'CONFIRMED', startsAt: '2026-12-01T01:00:00Z', endsAt: '2026-12-01T01:30:00Z', price });
 vi.mocked(api.myAppointments).mockResolvedValue([]);
});
afterEach(cleanup);
async function reachSlot() {
 const user=userEvent.setup();render(<PublicShell state="ready" />);
 await screen.findByRole('heading',{name:'Chọn lịch khám'});
 expect(screen.queryByRole('searchbox')).toBeNull();
 expect(screen.queryByRole('combobox',{name:'Địa điểm khám'})).toBeNull();
 await user.type(screen.getByLabelText('Email'),'synthetic@example.invalid');
 await user.type(screen.getByLabelText('Mật khẩu'),'synthetic-password');
 await user.click(screen.getByRole('button',{name:'Đăng nhập'}));
 await screen.findByRole('button',{name:'Lưu hồ sơ'});
 await waitFor(()=>expect(screen.getByRole('option',{name:'Synthetic Doctor'})).toBeTruthy());
 await user.selectOptions(screen.getByLabelText('Bác sĩ'),'doctor-a');
 await user.selectOptions(screen.getByLabelText('Dịch vụ'),'offering-a');
 await user.click(screen.getByRole('button',{name:'Xem giờ còn trống'}));
 const slot=await screen.findByRole('button',{name:/100.000/});
 return {user,slot};
}
describe('S1 booking workflow',()=>{
 it('confirms using the owned profile, stable hold and frozen displayed price',async()=>{
  const {user,slot}=await reachSlot();await user.click(slot);
  await user.click(await screen.findByRole('button',{name:'Xác nhận đặt lịch'}));
  await screen.findByText(/Đã xác nhận: AP-SYN/);
  expect(api.holdSlot).toHaveBeenCalledWith('synthetic-token',expect.objectContaining({patientId:'patient-a',clinicId:'clinic-a',branchId:'branch-a',slotId:'slot-a'}),expect.any(String));
  expect(api.confirmHold).toHaveBeenCalledWith('synthetic-token','clinic-a','patient-a','hold-a',expect.any(String));
 });
 it('retries an uncertain confirmation with the same idempotency key',async()=>{
  vi.mocked(api.confirmHold).mockRejectedValueOnce(new Error('Chưa xác định được kết quả.'));
  const {user,slot}=await reachSlot();await user.click(slot);
  await user.click(await screen.findByRole('button',{name:'Xác nhận đặt lịch'}));
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button',{name:'Xác nhận đặt lịch'}));
  await screen.findByText(/Đã xác nhận: AP-SYN/);
  const calls=vi.mocked(api.confirmHold).mock.calls;expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);
 });
 it('blocks confirmation after TTL and displays a recoverable slot conflict',async()=>{
  vi.mocked(api.holdSlot).mockRejectedValueOnce(new Error('Giờ khám vừa được chọn.'));
  const {user,slot}=await reachSlot();await user.click(slot);
  expect((await screen.findByRole('alert')).textContent).toContain('Giờ khám vừa được chọn');
  vi.mocked(api.holdSlot).mockResolvedValueOnce({holdId:'hold-a',state:'ACTIVE',expiresAt:new Date(Date.now()-1000).toISOString(),price});
  await user.click(slot);const confirm=await screen.findByRole('button',{name:'Xác nhận đặt lịch'});
  expect((confirm as HTMLButtonElement).disabled).toBe(true);expect(api.confirmHold).not.toHaveBeenCalled();
 });
});

