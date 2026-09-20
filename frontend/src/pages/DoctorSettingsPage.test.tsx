import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '../types/domain';

vi.mock('../config/integrations.config', () => ({ integrations: { notifications: true, adminCatalog: true } }));
import SettingsPage from './SettingsPage';

const doctor: CurrentUser = {
  id: 'identity-doctor-id', email: 'doctor@clinic.test', fullName: 'Bác sĩ An',
  phone: '0900000000', roles: ['ROLE_DOCTOR'], status: 'ACTIVE'
};

describe('doctor personal settings workspace', () => {
  it('uses doctor-only settings with actual identity data and loading placeholders for server data', () => {
    const html = renderToStaticMarkup(<SettingsPage user={doctor} role="DOCTOR" />);
    expect(html).toContain('doctor-settings');
    expect(html).toContain('Cài đặt bác sĩ');
    expect(html).toContain('Bác sĩ An');
    expect(html).toContain('doctor@clinic.test');
    expect(html).toContain('identity-doctor-id');
    expect(html).toContain('0900000000');
    expect(html).toContain('Đang tải...');
    expect(html).toContain('Chỉ xem');
    expect(html).not.toContain('admin-settings-workspace');
    expect(html).not.toContain('Cấu hình triển khai');
  });

  it('does not invent identity status, specialty, schedule, or expose administrator write controls', () => {
    const html = renderToStaticMarkup(<SettingsPage user={{ ...doctor, status: undefined, fullName: undefined }} role="DOCTOR" />);
    expect(html).toContain('Chưa có thông tin');
    expect(html).not.toContain('Đang hoạt động');
    expect(html).not.toContain('1 ngày/tuần');
    expect(html).not.toContain('Công bố đơn giá');
    expect(html).not.toContain('Lưu cấu hình');
    expect(html).not.toContain('Đổi mật khẩu ngay');
    expect(html).not.toContain('<form');
  });

  it('keeps role isolation: admin and patient do not receive doctor settings', () => {
    const admin = renderToStaticMarkup(<SettingsPage user={{ ...doctor, roles: ['ROLE_ADMIN'] }} role="ADMIN" />);
    const patient = renderToStaticMarkup(<SettingsPage user={{ ...doctor, roles: ['ROLE_PATIENT'] }} role="PATIENT" />);
    expect(admin).toContain('admin-settings-workspace');
    expect(admin).not.toContain('doctor-settings-hero');
    expect(patient).toContain('patient-settings');
    expect(patient).not.toContain('doctor-settings-hero');
  });
});
