import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CurrentUser } from '../types/domain';

const flags = vi.hoisted(() => ({ notifications: true, reception: true, adminCatalog: true }));
vi.mock('../config/integrations.config', () => ({ integrations: flags }));
import SettingsPage from './SettingsPage';

const receptionist: CurrentUser = {
  id: 'receptionist-identity', email: 'receptionist@clinic.test', fullName: 'Nhân viên lễ tân',
  phone: '0900000000', status: 'ACTIVE', roles: ['ROLE_RECEPTIONIST']
};

beforeEach(() => { flags.notifications = true; flags.reception = true; });

describe('receptionist settings workspace', () => {
  it('renders separate role settings and actual Identity information in read-only content', () => {
    const html = renderToStaticMarkup(<SettingsPage user={receptionist} role="RECEPTIONIST" />);
    expect(html).toContain('reception-settings');
    expect(html).toContain('Cài đặt lễ tân');
    expect(html).toContain('KHÔNG GIAN LỄ TÂN');
    expect(html).toContain('Nhân viên lễ tân');
    expect(html).toContain('receptionist@clinic.test');
    expect(html).toContain('receptionist-identity');
    expect(html).toContain('0900000000');
    expect(html).toContain('Đang hoạt động');
    expect(html).toContain('Chỉ xem');
    expect(html).toContain('Quyền &amp; quy trình');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Lưu cấu hình');
    expect(html).not.toContain('Đổi mật khẩu ngay');
    expect(html).not.toContain('admin-settings-workspace');
    expect(html).not.toContain('doctor-settings-hero');
  });

  it('does not invent an active account or enable disabled notification integration', () => {
    flags.notifications = false;
    const html = renderToStaticMarkup(<SettingsPage user={{ ...receptionist, status: undefined, fullName: undefined }} role="RECEPTIONIST" />);
    expect(html).toContain('Chưa có thông tin');
    expect(html).toContain('Chưa bật tích hợp');
    expect(html).not.toContain('Đang hoạt động');
    expect(html).not.toContain('Đã lưu');
  });

  it('keeps admin, doctor, patient and receptionist settings isolated', () => {
    const admin = renderToStaticMarkup(<SettingsPage user={{ ...receptionist, roles: ['ROLE_ADMIN'] }} role="ADMIN" />);
    const doctor = renderToStaticMarkup(<SettingsPage user={{ ...receptionist, roles: ['ROLE_DOCTOR'] }} role="DOCTOR" />);
    const patient = renderToStaticMarkup(<SettingsPage user={{ ...receptionist, roles: ['ROLE_PATIENT'] }} role="PATIENT" />);
    expect(admin).toContain('admin-settings-workspace');
    expect(doctor).toContain('doctor-settings');
    expect(patient).toContain('patient-settings');
    for (const html of [admin, doctor, patient]) expect(html).not.toContain('reception-settings-hero');
  });
});