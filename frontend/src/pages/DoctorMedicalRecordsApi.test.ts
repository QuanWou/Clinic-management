import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMedicalRecord, getAppointment, getPatientMedicalRecords } from '../api/clinic';
import { setAccessToken } from '../api/token';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } });
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: { id: 'verified' } }), { status: 200 })));
  setAccessToken('doctor-access');
});

describe('doctor medical-records backend contracts', () => {
  it('uses assignment-controlled appointment and treating-doctor patient routes, not clinic-wide directory', async () => {
    await getAppointment('appointment-1');
    await getPatientMedicalRecords('patient-1');
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, init]) => [url, init?.method ?? 'GET'])).toEqual([
      ['/api/appointments/appointment-1', 'GET'], ['/api/medical-records/patients/patient-1', 'GET']
    ]);
    expect(calls.every(([, init]) => new Headers(init?.headers).get('Authorization') === 'Bearer doctor-access')).toBe(true);
  });

  it('creates a record only with explicit diagnosis and no invented prescriptions', async () => {
    await createMedicalRecord({ appointmentId: 'appointment-1', diagnosis: 'Entered by treating doctor',
      symptoms: 'Recorded symptoms', notes: '', prescriptionItems: [] });
    const [[url, init]] = vi.mocked(fetch).mock.calls;
    expect(url).toBe('/api/medical-records');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ appointmentId: 'appointment-1', diagnosis: 'Entered by treating doctor',
      symptoms: 'Recorded symptoms', notes: '', prescriptionItems: [] });
  });
});
