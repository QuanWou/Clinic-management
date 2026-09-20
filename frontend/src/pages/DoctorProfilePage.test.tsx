import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '../types/domain';
import { getDoctorProfile, getMyDoctorSchedules, updateDoctorProfile } from '../api/clinic';
import DoctorProfilePage from './DoctorProfilePage';

const user: CurrentUser = { id: 'doctor-user', fullName: 'Bác sĩ thử nghiệm', email: 'doctor@clinic.test', roles: ['ROLE_DOCTOR'] };

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({
    success: true, data: []
  }), { status: 200 })));
  vi.stubGlobal('localStorage', { getItem: () => null });
  vi.stubGlobal('sessionStorage', { getItem: () => null });
});

describe('doctor self-service profile', () => {
  it('renders a doctor-only personal workspace and loading state without fictional data', () => {
    const html = renderToStaticMarkup(<DoctorProfilePage user={user} />);
    expect(html).toContain('doctor-profile-workspace');
    expect(html).toContain('Hồ sơ bác sĩ');
    expect(html).toContain('Đang tải hồ sơ bác sĩ');
    expect(html).not.toContain('Bác sĩ Nguyễn Văn A');
    expect(html).not.toContain('Thành công');
    expect(html).not.toContain('Thay đổi giá khám');
  });

  it('reads only the authenticated doctor profile and schedule endpoints', async () => {
    await getDoctorProfile();
    await getMyDoctorSchedules();
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls.map(([url, options]) => [String(url).split('/api/')[1], options?.method ?? 'GET'])).toEqual([
      ['doctors/profile', 'GET'], ['doctors/profile/schedules', 'GET']
    ]);
    expect(calls.every(([url]) => !String(url).includes('/admin'))).toBe(true);
  });

  it('updates biography only, without administrative fields', async () => {
    await updateDoctorProfile({ biography: 'Kinh nghiệm khám bệnh được phép công bố.' });
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toMatch(/\/api\/doctors\/profile$/);
    expect(options?.method).toBe('PUT');
    expect(JSON.parse(String(options?.body))).toEqual({ biography: 'Kinh nghiệm khám bệnh được phép công bố.' });
    expect(String(options?.body)).not.toMatch(/specialtyId|consultationFee|userId/);
  });
});
