import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAppointment, completeAppointment, confirmAppointment, createAppointment, getMyMedicalRecords,
  getPatientInvoices, updateDoctorProfile, searchReceptionPatients, registerReceptionPatient,
  getReceptionAppointments, bookReceptionAppointment, rescheduleReceptionAppointment,
  cancelReceptionAppointment, checkInReceptionAppointment, getReceptionQueue, updateReceptionQueue,
  confirmCashPayment, getInvoiceTransactions, getNotifications, markNotificationRead,
  getNotificationPreferences, updateNotificationPreference, getAdminDoctors, getSpecialties,
  getCatalogServices, getCatalogMedicines, getServicePrice
} from './clinic';
import { apiEndpoints } from './endpoints';
import { logout } from './auth';
import { getAccessToken, getRefreshToken, setAccessToken, setRefreshToken } from './token';

function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', storage());
  vi.stubGlobal('sessionStorage', storage());
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { id: 'appointment' } }), { status: 200 })));
});

describe('verified business API routes', () => {
  it('posts booking payload to the actual appointment controller', async () => {
    const request = { doctorId: 'doctor-id', appointmentDate: '2026-09-30', startTime: '09:00', endTime: '09:30', reason: 'Consultation' };
    await createAppointment(request);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toMatch(/\/api\/appointments$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it('uses status transition endpoints rather than inventing check-in or reschedule', async () => {
    await cancelAppointment('a');
    await confirmAppointment('a');
    await completeAppointment('a');
    expect(vi.mocked(fetch).mock.calls.map(([url, init]) => [String(url).split('/api/')[1], init?.method]))
      .toEqual([['appointments/a/cancel', 'PATCH'], ['appointments/a/confirm', 'PATCH'], ['appointments/a/complete', 'PATCH']]);
  });

  it('separates a patient self-list from a staff patient-UUID invoice lookup', async () => {
    await getMyMedicalRecords();
    await getPatientInvoices('patient-id');
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/\/api\/medical-records\/my$/);
    expect(String(vi.mocked(fetch).mock.calls[1][0])).toMatch(/\/api\/invoices\/patients\/patient-id$/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('revokes refresh token via server on logout and always clears local credentials', async () => {
    setAccessToken('access'); setRefreshToken('refresh');
    await logout();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/logout$/);
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: 'refresh' });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it('sends doctor self-edit with biography only; specialty and fee never leave the form', async () => {
    await updateDoctorProfile({ biography: 'Cardiology' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/doctors\/profile$/);
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({ biography: 'Cardiology' });
  });

  it('matches Task 03 patient lookup and walk-in registration DTO', async () => {
    await searchReceptionPatients({ name: 'Nguyen An', phone: '0901234567' });
    await registerReceptionPatient({ fullName: 'Nguyen An', phone: '0901234567' });
    const calls = vi.mocked(fetch).mock.calls;
    expect(String(calls[0][0])).toMatch(/\/api\/patients\/reception\?name=Nguyen\+An&phone=0901234567$/);
    expect(calls[1][0]).toMatch(/\/api\/patients\/reception$/);
    expect(calls[1][1]?.method).toBe('POST');
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ fullName: 'Nguyen An', phone: '0901234567' });
  });

  it('uses only actual Task 03 reception booking/list/reschedule/cancel routes', async () => {
    const booking = { patientId: 'patient', doctorId: 'doctor', appointmentDate: '2026-10-01', startTime: '09:00', endTime: '09:30', reason: 'Consult' };
    await getReceptionAppointments({ date: booking.appointmentDate });
    await bookReceptionAppointment(booking);
    await rescheduleReceptionAppointment('appointment', { doctorId: 'doctor', appointmentDate: '2026-10-02', startTime: '09:00', endTime: '09:30' });
    await cancelReceptionAppointment('appointment');
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['appointments/reception/bookings?date=2026-10-01', 'GET'],
      ['appointments/reception/bookings', 'POST'],
      ['appointments/reception/appointment/reschedule', 'PATCH'],
      ['appointments/reception/appointment/cancel', 'PATCH']
    ]);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual(booking);
  });

  it('uses Task 03 real check-in and queue routes with the exact status DTO', async () => {
    await checkInReceptionAppointment('appointment');
    await getReceptionQueue({ date: '2026-10-01', doctorId: 'doctor' });
    await updateReceptionQueue('visit', 'CALLED');
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['appointments/reception/appointment/check-in', 'POST'],
      ['appointments/reception/queue?date=2026-10-01&doctorId=doctor', 'GET'],
      ['appointments/reception/queue/visit', 'PATCH']
    ]);
    expect(JSON.parse(String(calls[2][1]?.body))).toEqual({ status: 'CALLED' });
  });

  it('removes the old invoice pay endpoint and uses cashier-only cash receipt DTO', async () => {
    expect('pay' in apiEndpoints.invoices).toBe(false);
    await confirmCashPayment('invoice', 'RECEIPT-1');
    await getInvoiceTransactions('invoice');
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['invoices/invoice/cash-payment', 'POST'], ['invoices/invoice/transactions', 'GET']
    ]);
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ receiptReference: 'RECEIPT-1' });
    expect(calls.every(([url]) => !/\/api\/invoices\/[^/?]+\/pay(?:$|\?)/.test(String(url)))).toBe(true);
  });

  it('routes personal notifications exclusively through /my, read and preferences', async () => {
    expect('collection' in apiEndpoints.notifications).toBe(false);
    await getNotifications(); await markNotificationRead('notification');
    await getNotificationPreferences(); await updateNotificationPreference('IN_APP', false);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['notifications/my', 'GET'],
      ['notifications/notification/read', 'PATCH'],
      ['notifications/my/preferences', 'GET'],
      ['notifications/my/preferences/IN_APP', 'PUT']
    ]);
    expect(JSON.parse(String(calls[3][1]?.body))).toEqual({ enabled: false });
  });

  it('matches Task 02 administrator directory, specialty, catalog and dated price routes', async () => {
    await getAdminDoctors(0, 50); await getSpecialties(); await getCatalogServices();
    await getCatalogMedicines(); await getServicePrice('service', '2026-09-20');
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url).split('/api/')[1])).toEqual([
      'doctors/admin?page=0&size=50', 'specialties', 'catalog/services', 'catalog/medicines',
      'catalog/services/service/price?on=2026-09-20'
    ]);
  });
});
