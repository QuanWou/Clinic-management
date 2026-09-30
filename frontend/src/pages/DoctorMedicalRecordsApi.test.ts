import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoctorPatientMedicalRecordsByCode, getMyDoctorMedicalRecords } from '../api/clinic';
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
  it('looks up the public BN code only on the doctor-scoped API with bearer authorization', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
    expect(await getDoctorPatientMedicalRecordsByCode('BN000005')).toEqual([]);
    const [[url, init]] = vi.mocked(fetch).mock.calls;
    expect(url).toBe('/api/medical-records/doctor/patients/code/BN000005');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer doctor-access');
  });
  it('loads a bounded doctor-owned page through its dedicated authenticated route', async () => {
    const page = { content: [], number: 0, size: 8, totalElements: 96, totalPages: 12 };
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: page }), { status: 200 }));
    expect(await getMyDoctorMedicalRecords(0, 8)).toEqual(page);
    const [[url, init]] = vi.mocked(fetch).mock.calls;
    expect(url).toBe('/api/medical-records/doctor/my?page=0&size=8');
    expect(init?.method ?? 'GET').toBe('GET');
    expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer doctor-access');
  });
});
