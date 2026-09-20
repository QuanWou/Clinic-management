import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReceptionPatientResponse } from '../types/domain';
import { filterPatientResults } from '../utils/patientResults';

vi.mock('../config/integrations.config', () => ({
  integrations: { reception: true }
}));

import ReceptionPatientsPage from './ReceptionPatientsPage';

const rows: ReceptionPatientResponse[] = [
  { id: 'patient-1', userId: 'identity-1', fullName: 'Nguyễn An', phone: '0123456789', dob: '1990-01-01', gender: 'MALE', address: null, bloodType: null },
  { id: 'patient-2', userId: null, fullName: 'Trần Bình', phone: '0123456788', dob: null, gender: null, address: null, bloodType: null },
  { id: 'patient-3', userId: '', fullName: 'Lê Chi', phone: '0123456787', dob: null, gender: null, address: null, bloodType: null }
];

describe('staff patient screen and search-bound rows', () => {
  it('offers a search-first screen with no fabricated directory or totals', () => {
    const html = renderToStaticMarkup(<ReceptionPatientsPage role="ADMIN" />);
    expect(html).toContain('patients-workspace');
    expect(html).toContain('Tìm kiếm bệnh nhân');
    expect(html).toContain('Thêm bệnh nhân');
    expect(html).toContain('Bắt đầu bằng một lượt tìm kiếm');
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
      expect(html).toContain('cannot access');
    }
  });

  it('filters only returned patient rows and does not infer status from demographics', () => {
    expect(filterPatientResults(rows, 'ALL')).toEqual(rows);
    expect(filterPatientResults(rows, 'LINKED').map((row) => row.id)).toEqual(['patient-1']);
    expect(filterPatientResults(rows, 'WALK_IN').map((row) => row.id)).toEqual(['patient-2', 'patient-3']);
    expect(filterPatientResults([], 'ALL')).toEqual([]);
  });
});
