import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminDoctorResponse } from '../types/domain';
import { filterAdminDoctorPage } from '../utils/doctorDirectory';

vi.mock('../config/integrations.config', () => ({ integrations: { adminCatalog: true } }));
import DoctorsPage from './DoctorsPage';

const doctors: AdminDoctorResponse[] = [
  { id: 'doctor-001', userId: 'user-001', specialtyId: 'spec-a', specialtyName: 'Nội khoa', active: true, consultationFee: '120000' },
  { id: 'doctor-002', userId: 'user-002', specialtyId: 'spec-b', specialtyName: 'Nhi khoa', active: false, consultationFee: '100000' },
  { id: 'doctor-003', userId: 'user-003', specialtyId: 'spec-a', specialtyName: 'Nội khoa', active: true, consultationFee: '150000' }
];

describe('doctor admin page', () => {
  it('offers real admin directory and explicit create control without fictional staff names', () => {
    const html = renderToStaticMarkup(<DoctorsPage role="ADMIN" />);
    expect(html).toContain('doctors-workspace');
    expect(html).toContain('Thêm bác sĩ');
    expect(html).toContain('Đang tải danh sách bác sĩ');
    expect(html).not.toContain('Jane Cooper');
    expect(html).not.toContain('Đã tạo hồ sơ bác sĩ');
  });

  it('does not expose administrator screen or mutations to other roles', () => {
    for (const role of ['RECEPTIONIST', 'PATIENT', 'DOCTOR'] as const) {
      const html = renderToStaticMarkup(<DoctorsPage role={role} />);
      expect(html).not.toContain('doctors-workspace');
      expect(html).not.toContain('Thêm bác sĩ');
      expect(html).not.toContain('Ngừng hoạt động');
    }
  });

  it('filters only the loaded page by specialty, status and genuine ID', () => {
    expect(filterAdminDoctorPage(doctors, '', '', 'ALL')).toEqual(doctors);
    expect(filterAdminDoctorPage(doctors, '', 'spec-a', 'ACTIVE').map(({ id }) => id)).toEqual(['doctor-001', 'doctor-003']);
    expect(filterAdminDoctorPage(doctors, '', '', 'INACTIVE').map(({ id }) => id)).toEqual(['doctor-002']);
    expect(filterAdminDoctorPage(doctors, 'user-003', '', 'ALL').map(({ id }) => id)).toEqual(['doctor-003']);
    expect(filterAdminDoctorPage(doctors, 'không có', '', 'ALL')).toEqual([]);
  });
});