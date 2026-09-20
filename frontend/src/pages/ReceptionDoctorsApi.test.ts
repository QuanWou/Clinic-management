import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDoctorSchedules, getDoctors, getSpecialties } from '../api/clinic';

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })));
});

describe('reception doctor read-only API routes', () => {
  it('uses the active directory, public specialty list and encoded weekly schedule endpoint only', async () => {
    await getDoctors();
    await getSpecialties();
    await getDoctorSchedules('doctor/id');
    expect(vi.mocked(fetch).mock.calls.map(([url, options]) => [String(url), options?.method ?? 'GET'])).toEqual([
      ['/api/doctors', 'GET'], ['/api/specialties', 'GET'], ['/api/doctors/doctor%2Fid/schedules', 'GET']
    ]);
  });
});
