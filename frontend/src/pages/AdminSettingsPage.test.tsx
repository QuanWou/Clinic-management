import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '../types/domain';

const flags = vi.hoisted(() => ({ adminCatalog: true, reception: true, laboratory: true, billing: true, notifications: true }));
vi.mock('../config/integrations.config', () => ({ integrations: flags }));

import SettingsPage from './SettingsPage';

const admin: CurrentUser = {
  id: 'identity-admin-uuid', accountCode: 'TK000059', fullName: 'Nguyễn Quản Trị', email: 'admin@clinic.test',
  phone: '0900000000', status: 'ACTIVE', roles: ['ROLE_ADMIN']
};
const patient: CurrentUser = { id: 'patient-id', fullName: 'Người bệnh', email: 'patient@clinic.test', roles: ['ROLE_PATIENT'] };

beforeEach(() => { flags.notifications = true; });

describe('administrator settings workspace', () => {
  it('shows real signed-in account information in read-only fields with distinct settings navigation', () => {
    const html = renderToStaticMarkup(<SettingsPage user={admin} role="ADMIN" />);
    expect(html).toContain('admin-settings-workspace');
    expect(html).toContain('Nguyễn Quản Trị');
    expect(html).toContain('admin@clinic.test');
    expect(html).toContain('TK000059');
    expect(html).not.toContain('identity-admin-uuid');
    expect(html).toContain('Đang hoạt động');
    expect(html).toContain('Thông báo');
    expect(html).toContain('Hệ thống');
    expect(html).toContain('Chỉ xem');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Lưu cấu hình');
    expect(html).not.toContain('Đổi mật khẩu ngay');
  });

  it('does not falsely claim an unknown account status is active', () => {
    const html = renderToStaticMarkup(<SettingsPage user={{ ...admin, status: undefined }} role="ADMIN" />);
    expect(html).toContain('Chưa có thông tin');
    expect(html).not.toContain('Đang hoạt động');
  });

  it('shows disabled notification integration without pretending API preferences were loaded', () => {
    flags.notifications = false;
    const html = renderToStaticMarkup(<SettingsPage user={admin} role="ADMIN" />);
    expect(html).toContain('Chưa bật');
    expect(html).not.toContain('Đã lưu tùy chọn');
  });

  it('keeps patient profile editing and hides the admin configuration UI from other roles', () => {
    const patientHtml = renderToStaticMarkup(<SettingsPage user={patient} role="PATIENT" />);
    expect(patientHtml).toContain('patient-settings');
    expect(patientHtml).toContain('Hồ sơ bệnh nhân');
    expect(patientHtml).not.toContain('admin-settings-workspace');
    expect(patientHtml).not.toContain('Cấu hình triển khai');
    for (const role of ['RECEPTIONIST', 'DOCTOR'] as const) {
      const html = renderToStaticMarkup(<SettingsPage user={{ ...patient, roles: [`ROLE_${role}`] }} role={role} />);
      expect(html).not.toContain('admin-settings-workspace');
      expect(html).not.toContain('patient-settings');
    }
  });
});
