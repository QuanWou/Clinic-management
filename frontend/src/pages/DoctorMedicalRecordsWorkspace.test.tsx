import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MedicalRecordResponse } from '../types/domain';
import { filterDoctorMedicalRecords, medicalRecordsSummary, validClinicUuid } from '../utils/doctorMedicalRecords';

vi.mock('../config/integrations.config', () => ({ integrations: { laboratory: true } }));
import MedicalRecordsPage from './MedicalRecordsPage';
import DoctorMedicalRecordsWorkspace from './DoctorMedicalRecordsWorkspace';

const patientId = '01234567-89ab-cdef-0123-456789abcdef';
const records: MedicalRecordResponse[] = [
  { id: 'rec-old', patientId, doctorId: 'own-doctor', appointmentId: 'booking-1',
    diagnosis: 'Khám định kỳ', symptoms: 'Đau đầu', notes: '', createdAt: '2026-09-19T09:00:00', prescriptions: [] },
  { id: 'rec-new', patientId, doctorId: 'own-doctor', appointmentId: 'booking-2',
    diagnosis: 'Viêm họng', symptoms: 'Đau họng', notes: 'Theo dõi', createdAt: '2026-09-20T10:00:00',
    prescriptions: [{ id: 'rx-1', items: [], createdAt: '2026-09-20T10:00:00' }] }
];
const props = { records: null, error: null, loading: false, onRefresh: () => undefined };

describe('treating-doctor medical records UI', () => {
  it('renders a separate private workspace without inventing data or exposing controls before search', () => {
    const html = renderToStaticMarkup(<MedicalRecordsPage {...props} role="DOCTOR" />);
    expect(html).toContain('doctor-records');
    expect(html).toContain('Hồ sơ bệnh án');
    expect(html).toContain('Patient UUID');
    expect(html).toContain('Tạo bệnh án');
    expect(html).toContain('Chưa có bệnh nhân được tra cứu');
    expect(html).toContain('không có API danh sách toàn phòng khám');
    expect(html).not.toContain('doctor-records-metrics');
    expect(html).not.toContain('Tạo chỉ định');
    expect(html).not.toContain('Đơn thuốc đã ghi nhận');
    expect(html).not.toContain('Chẩn đoán</');
    expect(html).not.toContain('Sarah Lee');
  });

  it('keeps the patient record portal separate and blocks admin and receptionist from doctor search/creation', () => {
    const patient = renderToStaticMarkup(<MedicalRecordsPage {...props} records={[]} role="PATIENT" />);
    expect(patient).toContain('Chưa có hồ sơ bệnh án.');
    expect(patient).toContain('patient-portal');
    expect(patient).not.toContain('doctor-records');
    expect(patient).not.toContain('Tạo bệnh án');
    for (const role of ['ADMIN', 'RECEPTIONIST'] as const) {
      const html = renderToStaticMarkup(<MedicalRecordsPage {...props} role={role} />);
      expect(html).not.toContain('doctor-records');
      expect(html).not.toContain('Patient UUID');
      expect(html).not.toContain('Tạo bệnh án');
    }
  });

  it('direct workspace shows only intentional lookup and no all-clinic list or write by default', () => {
    const html = renderToStaticMarkup(<DoctorMedicalRecordsWorkspace />);
    expect(html).toContain('Chỉ hồ sơ được backend cấp quyền');
    expect(html).toContain('Nhập mã UUID bệnh nhân');
    expect(html).not.toContain('doctor-records-create-fields');
    expect(html).not.toContain('Công bố kết quả cho bệnh nhân');
    expect(html).not.toContain('Search records');
  });

  it('filters only authorized returned records, sorts latest first and preserves input', () => {
    const original = records.map(({ id }) => id);
    expect(filterDoctorMedicalRecords(records, '').map(({ id }) => id)).toEqual(['rec-new', 'rec-old']);
    expect(filterDoctorMedicalRecords(records, 'VIÊM HỌNG').map(({ id }) => id)).toEqual(['rec-new']);
    expect(filterDoctorMedicalRecords(records, 'booking-1').map(({ id }) => id)).toEqual(['rec-old']);
    expect(filterDoctorMedicalRecords(records, 'unknown')).toEqual([]);
    expect(records.map(({ id }) => id)).toEqual(original);
  });

  it('counts only loaded records and rejects malformed UUID before an API request', () => {
    expect(medicalRecordsSummary(records)).toEqual({ count: 2, appointmentCount: 2, prescriptionCount: 1,
      latestDate: '2026-09-20T10:00:00' });
    expect(medicalRecordsSummary([])).toEqual({ count: 0, appointmentCount: 0, prescriptionCount: 0, latestDate: '' });
    expect(validClinicUuid(` ${patientId.toUpperCase()} `)).toBe(true);
    expect(validClinicUuid('patient-id')).toBe(false);
    expect(validClinicUuid('../../api/users/me')).toBe(false);
  });
});
