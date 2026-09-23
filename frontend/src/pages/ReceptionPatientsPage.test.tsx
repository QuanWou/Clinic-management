import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReceptionPatientResponse } from '../types/domain';
import { filterPatientResults } from '../utils/patientResults';

vi.mock('../config/integrations.config', () => ({
  integrations: { reception: true }
}));

import ReceptionPatientsPage, { PatientDetail, validateRegistrationField } from './ReceptionPatientsPage';

const rows: ReceptionPatientResponse[] = [
  { id: 'patient-1', userId: 'identity-1', fullName: 'Nguyễn An', phone: '0123456789', dob: '1990-01-01', gender: 'MALE', address: null, bloodType: null },
  { id: 'patient-2', userId: null, fullName: 'Trần Bình', phone: '0123456788', dob: null, gender: null, address: null, bloodType: null },
  { id: 'patient-3', userId: '', fullName: 'Lê Chi', phone: '0123456787', dob: null, gender: null, address: null, bloodType: null }
];

describe('staff patient screen and paged directory', () => {
  it('loads the staff-only patient list on entry rather than waiting for a search', () => {
    const html = renderToStaticMarkup(<ReceptionPatientsPage role="ADMIN" />);
    expect(html).toContain('patients-workspace');
    expect(html).toContain('Tìm kiếm bệnh nhân');
    expect(html).toContain('Thêm bệnh nhân');
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('Đang tải danh sách bệnh nhân');
    expect(html).toContain('Danh sách tất cả');
    expect(html).not.toContain('Bắt đầu bằng một lượt tìm kiếm');
    expect(html).not.toContain('patients-table');
    expect(html).not.toContain('patients-metrics');
    expect(html).not.toContain('Hồ sơ bệnh án');
    expect(html).not.toContain('Sara Lee');
  });

  it('keeps the staff screen accessible to receptionists but blocks patient and doctor roles', () => {
    expect(renderToStaticMarkup(<ReceptionPatientsPage role="RECEPTIONIST" />)).toContain('patients-workspace');
    for (const role of ['PATIENT', 'DOCTOR'] as const) {
      const html = renderToStaticMarkup(<ReceptionPatientsPage role={role} />);
      expect(html).not.toContain('patients-workspace');
      expect(html).toContain('không có quyền truy cập');
    }
  });

  it('filters only returned patient rows and does not infer status from demographics', () => {
    expect(filterPatientResults(rows, 'ALL')).toEqual(rows);
    expect(filterPatientResults(rows, 'LINKED').map((row) => row.id)).toEqual(['patient-1']);
    expect(filterPatientResults(rows, 'WALK_IN').map((row) => row.id)).toEqual(['patient-2', 'patient-3']);
    expect(filterPatientResults([], 'ALL')).toEqual([]);
  });

  it('shows patient details in an accessible modal with a compact close control', () => {
    const html = renderToStaticMarkup(<PatientDetail patient={rows[0]} detailRef={{ current: null }} onClose={() => undefined} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-labelledby="patient-detail-title"');
    expect(html).toContain('class="patients-detail-close"');
    expect(html).toContain('aria-label="Đóng chi tiết bệnh nhân"');
    expect(html).toContain('Nguyễn An');
  });

  it('validates registration fields independently and accepts corrected values', () => {
    expect(validateRegistrationField('fullName', '')).toBe('Vui lòng nhập họ và tên.');
    expect(validateRegistrationField('fullName', 'Nguyễn An')).toBeUndefined();
    expect(validateRegistrationField('phone', '12')).toContain('số điện thoại hợp lệ');
    expect(validateRegistrationField('phone', '0123456789')).toBeUndefined();
    expect(validateRegistrationField('dob', '2999-01-01')).toContain('Ngày sinh');
    expect(validateRegistrationField('dob', '')).toBeUndefined();
  });
});
