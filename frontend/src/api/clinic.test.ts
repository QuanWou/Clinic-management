import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAppointment, completeAppointment, confirmAppointment, createAppointment, getMyMedicalRecords,
  getPatientInvoices, updateDoctorProfile, searchReceptionPatients, registerReceptionPatient,
  getReceptionAppointments, bookReceptionAppointment, rescheduleReceptionAppointment,
  cancelReceptionAppointment, checkInReceptionAppointment, getReceptionQueue, updateReceptionQueue,
  confirmCashPayment, getInvoiceTransactions, getNotifications, markNotificationRead,
  getNotificationPreferences, updateNotificationPreference, getAdminDoctors, getAdminDoctor,
  getAdminDoctorSchedules, createAdminDoctor, updateAdminDoctor, deactivateAdminDoctor, getSpecialties,
  getCatalogServices, getCatalogMedicines, getAdminCatalogServices, getAdminCatalogMedicines,
  getServicePriceHistory, getServicePrice, getDoctors,
  getAppointmentAvailability, getPerformedServices, addPerformedService, finalizePerformedServices,
  getLabBillableItems, finalizeLabBillableItems, createInvoice, getLabOrders, changeLabOrder,
  createCatalogService, publishCatalogPrice, getEncounterContext, getMedicalRecordByAppointment,
  saveMedicalRecordDraft, finalizeMedicalRecord, getPrescriptions, savePrescriptionDraft,
  signPrescription, createLabOrder
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
  it('separates read-only catalog routes, admin-only all-item routes and price history', async () => {
    await getCatalogServices();
    await getCatalogMedicines();
    await getAdminCatalogServices();
    await getAdminCatalogMedicines();
    await getServicePriceHistory('service/id');
    await getServicePrice('service/id');
    expect(vi.mocked(fetch).mock.calls.map(([url, opts]) => [String(url).split('/api/')[1], opts?.method ?? 'GET'])).toEqual([
      ['catalog/services', 'GET'], ['catalog/medicines', 'GET'],
      ['catalog/admin/services', 'GET'], ['catalog/admin/medicines', 'GET'],
      ['catalog/services/service%2Fid/prices', 'GET'], ['catalog/services/service%2Fid/price', 'GET']
    ]);
  });
  it('uses administrator-only doctor routes with exact create/update/deactivate contracts', async () => {
    const create = { userId: 'identity-uuid', specialtyId: 'specialty-uuid', biography: 'Doctor profile', consultationFee: '125000.00' };
    const update = { specialtyId: 'specialty-uuid', biography: 'Updated', consultationFee: '140000.00', active: false };
    await getAdminDoctors(2, 20);
    await getAdminDoctor('doctor-id');
    await getAdminDoctorSchedules('doctor-id');
    await createAdminDoctor(create);
    await updateAdminDoctor('doctor-id', update);
    await deactivateAdminDoctor('doctor-id');
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['doctors/admin?page=2&size=20', 'GET'],
      ['doctors/admin/doctor-id', 'GET'],
      ['doctors/admin/doctor-id/schedules', 'GET'],
      ['doctors/admin', 'POST'],
      ['doctors/admin/doctor-id', 'PUT'],
      ['doctors/admin/doctor-id', 'DELETE']
    ]);
    expect(JSON.parse(String(calls[3][1]?.body))).toEqual(create);
    expect(JSON.parse(String(calls[4][1]?.body))).toEqual(update);
    expect(calls[5][1]?.body).toBeUndefined();
  });
  it('wires Task 01, 04, and 05 actions only to existing backend routes and request methods', async () => {
    await getAppointmentAvailability('doctor', '2026-09-21', '08:00', '08:30');
    await getPerformedServices('appointment');
    await addPerformedService('appointment', { serviceId: 'service', quantity: 2, serviceDate: '2026-09-20' });
    await finalizePerformedServices('appointment');
    await getLabBillableItems('appointment');
    await finalizeLabBillableItems('appointment');
    await createInvoice('appointment');
    await getLabOrders('record');
    await changeLabOrder('order', 'sample', { sampleIdentifier: 'S-001' });
    expect(vi.mocked(fetch).mock.calls.map(([url, init]) => [String(url).split('/api/')[1], init?.method ?? 'GET'])).toEqual([
      ['appointments/doctors/doctor/availability?date=2026-09-21&startTime=08%3A00&endTime=08%3A30', 'GET'],
      ['appointments/appointment/performed-services', 'GET'],
      ['appointments/appointment/performed-services', 'POST'],
      ['appointments/appointment/performed-services/finalize', 'POST'],
      ['medical-records/appointments/appointment/billable-items', 'GET'],
      ['medical-records/appointments/appointment/billable-items/finalize', 'POST'],
      ['invoices', 'POST'],
      ['medical-records/record/lab-orders', 'GET'],
      ['medical-records/lab-orders/order/sample', 'PATCH']
    ]);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[6][1]?.body))).toEqual({ appointmentId: 'appointment' });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[8][1]?.body))).toEqual({ sampleIdentifier: 'S-001' });
  });

  it('publishes Catalog changes only through its administrator routes', async () => {
    await createCatalogService({ code: 'CONSULT', name: 'Consultation', description: '', active: true });
    await publishCatalogPrice('service', { amount: '120000', currency: 'VND', effectiveFrom: '2026-09-20', effectiveUntil: null });
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, init]) => [String(url).split('/api/')[1], init?.method])).toEqual([
      ['catalog/admin/services', 'POST'], ['catalog/admin/services/service/prices', 'POST']
    ]);
    expect(JSON.parse(String(calls[1][1]?.body))).toEqual({ amount: '120000', currency: 'VND', effectiveFrom: '2026-09-20', effectiveUntil: null });
  });
  it('uses the authenticated public active-doctor list rather than the administrator endpoint for receptionist and patient directories', async () => {
    await getDoctors();
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toMatch(/\/api\/doctors$/);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain('/admin');
  });
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

  it('uses encounter-scoped clinical routes with optimistic versions and lab idempotency', async () => {
    await getEncounterContext('appointment/1');
    await getMedicalRecordByAppointment('appointment/1');
    await saveMedicalRecordDraft('appointment/1', { symptoms: 'Fever', diagnosis: '', notes: '', version: 2 });
    await finalizeMedicalRecord('record/1', 3);
    await getPrescriptions('record/1');
    await savePrescriptionDraft('record/1', {
      version: 1,
      items: [{ medicineId: 'medicine-1', dosage: '500 mg', frequency: '2/day', duration: '5 days' }]
    });
    await signPrescription('record/1', 'prescription/1', 2);
    await createLabOrder('record/1', {
      serviceId: 'service-1', testCode: 'CBC', testName: 'Blood count', performedOn: '2026-09-23',
      allowDuplicate: false, duplicateReason: null
    }, 'request-key-1');

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url), options?.method ?? 'GET'])).toEqual([
      ['/api/appointments/appointment%2F1/encounter', 'GET'],
      ['/api/medical-records/appointments/appointment%2F1', 'GET'],
      ['/api/medical-records/appointments/appointment%2F1/draft', 'PUT'],
      ['/api/medical-records/record%2F1/finalize', 'POST'],
      ['/api/medical-records/record%2F1/prescriptions', 'GET'],
      ['/api/medical-records/record%2F1/prescriptions/draft', 'PUT'],
      ['/api/medical-records/record%2F1/prescriptions/prescription%2F1/sign', 'POST'],
      ['/api/medical-records/record%2F1/lab-orders', 'POST']
    ]);
    expect(JSON.parse(String(calls[2][1]?.body))).toEqual({ symptoms: 'Fever', diagnosis: '', notes: '', version: 2 });
    expect(JSON.parse(String(calls[3][1]?.body))).toEqual({ version: 3 });
    expect(JSON.parse(String(calls[6][1]?.body))).toEqual({ version: 2 });
    expect(new Headers(calls[7][1]?.headers).get('Idempotency-Key')).toBe('request-key-1');
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
