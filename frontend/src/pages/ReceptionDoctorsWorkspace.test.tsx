import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DoctorProfileResponse } from '../types/domain';
import { filterReceptionDoctors } from '../utils/receptionDoctorDirectory';

vi.mock('../config/integrations.config', () => ({ integrations: { adminCatalog: true } }));
import DoctorsPage from './DoctorsPage';

const doctors: DoctorProfileResponse[] = [
  { id: 'doctor-alpha', userId: 'user-alpha', specialtyId: 'spec-internal', specialtyName: 'Nội khoa', consultationFee: '200000' },
  { id: 'doctor-beta', userId: 'user-beta', specialtyId: 'spec-kids', specialtyName: 'Nhi khoa', consultationFee: null },
  { id: 'doctor-gamma', userId: 'user-gamma', specialtyId: 'spec-internal', specialtyName: 'Nội khoa', consultationFee: '250000' }
];

describe('reception-only doctor directory', () => {
  it('has its own role-scoped layout and loading state without fictitious doctor names or admin controls', () => {
    const html = renderToStaticMarkup(<DoctorsPage role="RECEPTIONIST" onNavigate={() => {}} />);
    expect(html).toContain('reception-doctors');
    expect(html).toContain('KHÔNG GIAN LỄ TÂN');
    expect(html).toContain('Đang tải danh sách bác sĩ');
    expect(html).toContain('Đến trang Lịch hẹn');
    expect(html).not.toContain('Thêm bác sĩ');
    expect(html).not.toContain('Chỉnh sửa hồ sơ');
    expect(html).not.toContain('Ngừng hoạt động');
    expect(html).not.toContain('Bác sĩ An');
    expect(html).not.toContain('doctors-workspace');
  });

  it('retains independent patient and admin screens; doctor role cannot access this directory', () => {
    const admin = renderToStaticMarkup(<DoctorsPage role="ADMIN" />);
    const patient = renderToStaticMarkup(<DoctorsPage role="PATIENT" />);
    const doctor = renderToStaticMarkup(<DoctorsPage role="DOCTOR" />);
    expect(admin).toContain('doctors-workspace');
    expect(admin).not.toContain('reception-doctors');
    expect(patient).toContain('Bác sĩ phòng khám');
    expect(patient).toContain('patient-portal');
    expect(patient).not.toContain('reception-doctors');
    expect(doctor).toContain('not available for this role');
    expect(doctor).not.toContain('reception-doctors');
  });

  it('filters only real doctor codes and specialties, not Identity information or fabricated names', () => {
    expect(filterReceptionDoctors(doctors, '', '')).toEqual(doctors);
    expect(filterReceptionDoctors(doctors, 'NỘI', '').map(({ id }) => id)).toEqual(['doctor-alpha', 'doctor-gamma']);
    expect(filterReceptionDoctors(doctors, '', 'spec-kids').map(({ id }) => id)).toEqual(['doctor-beta']);
    expect(filterReceptionDoctors(doctors, 'doctor-alpha', 'spec-kids')).toEqual([]);
    expect(filterReceptionDoctors(doctors, 'user-alpha', '')).toEqual([]);
    expect(filterReceptionDoctors(doctors, 'không tồn tại', '')).toEqual([]);
  });
});
