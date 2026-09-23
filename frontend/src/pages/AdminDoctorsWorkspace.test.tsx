import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AdminDoctorResponse, AdminDoctorSchedule } from '../types/domain';
import { doctorDisplayName, filterAdminDoctorPage } from '../utils/doctorDirectory';

vi.mock('../config/integrations.config', () => ({ integrations: { adminCatalog: true } }));
import { groupDoctorSchedules } from './AdminDoctorsWorkspace';
import DoctorsPage from './DoctorsPage';

const doctors: AdminDoctorResponse[] = [
  { id: 'doctor-001', userId: 'user-001', specialtyId: 'spec-a', specialtyName: 'Nội khoa', active: true, consultationFee: '120000' },
  { id: 'doctor-002', userId: 'user-002', specialtyId: 'spec-b', specialtyName: 'Nhi khoa', active: false, consultationFee: '100000' },
  { id: 'doctor-003', userId: 'user-003', specialtyId: 'spec-a', specialtyName: 'Nội khoa', active: true, consultationFee: '150000' }
];

describe('doctor admin page', () => {
  it('groups all morning and afternoon shifts under their weekday without losing schedule entries', () => {
    const schedules: AdminDoctorSchedule[] = [
      { id: 'tue-afternoon', doctorId: 'doctor-001', dayOfWeek: 2, startTime: '13:00', endTime: '17:00' },
      { id: 'mon-afternoon', doctorId: 'doctor-001', dayOfWeek: 1, startTime: '13:00', endTime: '17:00' },
      { id: 'mon-morning', doctorId: 'doctor-001', dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }
    ];
    const result = groupDoctorSchedules(schedules);
    expect(result.map((day) => day.dayOfWeek)).toEqual([1, 2]);
    expect(result[0].slots.map((slot) => slot.id)).toEqual(['mon-morning', 'mon-afternoon']);
    expect(result.flatMap((day) => day.slots)).toHaveLength(schedules.length);
    expect(groupDoctorSchedules([])).toEqual([]);
    expect(schedules[0].id).toBe('tue-afternoon');
  });

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

  it('shows a verified Identity name through userId, searches names, and never invents names from doctor IDs', () => {
    const names = { 'user-001': 'Nguyễn Văn Minh', 'doctor-002': 'Tên không thuộc tài khoản này' };
    expect(doctorDisplayName(doctors[0], names)).toBe('Nguyễn Văn Minh');
    expect(doctorDisplayName(doctors[1], names)).toBe('Chưa có tên bác sĩ');
    expect(doctorDisplayName(doctors[1], names, true)).toBe('Đang tải tên bác sĩ...');
    expect(filterAdminDoctorPage(doctors, 'nguyễn văn', '', 'ALL', names)).toEqual([doctors[0]]);
    expect(filterAdminDoctorPage(doctors, 'bác sĩ #', '', 'ALL', names)).toEqual([]);
  });
});