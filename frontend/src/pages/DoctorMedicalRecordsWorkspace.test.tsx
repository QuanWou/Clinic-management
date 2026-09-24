import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MedicalRecordResponse, ReceptionVisitResponse } from '../types/domain';
import { completedVisitsForRecord, filterDoctorMedicalRecords, medicalRecordsSummary, validClinicUuid } from '../utils/doctorMedicalRecords';

vi.mock('../config/integrations.config', () => ({ integrations: { laboratory: true } }));
import MedicalRecordsPage from './MedicalRecordsPage';
import DoctorMedicalRecordsWorkspace, { DoctorRecordIdentity } from './DoctorMedicalRecordsWorkspace';

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
  it('renders stored business identifiers and appointment time without exposing UUIDs', () => {
    const html = renderToStaticMarkup(<DoctorRecordIdentity record={{
      ...records[0], id: '10de38a1-3abf-82b6-d8f6-acbece5642c7',
      patientId: 'd3000000-0000-4000-8000-000000000003',
      doctorId: 'f2000000-0000-4000-8000-000000000002',
      appointmentId: '3c7e56fc-579a-c405-7034-a2858f661b59',
      recordCode: 'BA001672', patientCode: 'BN000005', patientName: 'Bệnh nhân thử 03',
      doctorCode: 'BS000001', doctorName: 'Demo Doctor', appointmentDate: '2026-09-18',
      startTime: '10:00:00', endTime: '10:45:00'
    }} />);
    expect(html).toContain('BA001672');
    expect(html).toContain('BN000005');
    expect(html).toContain('BS000001');
    expect(html).toContain('Demo Doctor');
    expect(html).toContain('18/09/2026');
    expect(html).toContain('10:00');
    for (const id of ['10de38a1', 'd3000000', 'f2000000', '3c7e56fc']) expect(html).not.toContain(id);
  });
  it('loads only the doctor-owned directory on mount without inventing clinical data', () => {
    const html = renderToStaticMarkup(<MedicalRecordsPage {...props} role="DOCTOR" />);
    expect(html).toContain('doctor-records');
    expect(html).toContain('Hồ sơ bệnh án');
    expect(html).toContain('Mã bệnh nhân');
    expect(html).toContain('Tạo bệnh án');
    expect(html).toContain('Danh sách bệnh án của bạn được tải tự động');
    expect(html).toContain('Đang tải các bệnh án được cấp quyền');
    expect(html).toContain('Chỉ hiển thị bệnh án của bệnh nhân do bạn điều trị.');
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

  it('direct workspace shows an assignment-only loading state and no all-clinic list or write by default', () => {
    const html = renderToStaticMarkup(<DoctorMedicalRecordsWorkspace />);
    expect(html).toContain('Chỉ hồ sơ được phân công');
    expect(html).toContain('doctor-records-privacy');
    expect(html).not.toContain('doctor-records-hero');
    expect(html).toContain('Nhập mã bệnh nhân, ví dụ BN000005');
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
    const withPublicCodes = [{ ...records[0], recordCode: 'BA000123', patientCode: 'BN000005', patientName: 'Nguyễn Văn An' }];
    expect(filterDoctorMedicalRecords(withPublicCodes, 'BA000123')).toHaveLength(1);
    expect(filterDoctorMedicalRecords(withPublicCodes, 'BN000005')).toHaveLength(1);
    expect(filterDoctorMedicalRecords(withPublicCodes, 'Nguyễn Văn An')).toHaveLength(1);
  });

  it('counts only loaded records and rejects malformed UUID before an API request', () => {
    expect(medicalRecordsSummary(records)).toEqual({ count: 2, appointmentCount: 2, prescriptionCount: 1,
      latestDate: '2026-09-20T10:00:00' });
    expect(medicalRecordsSummary([])).toEqual({ count: 0, appointmentCount: 0, prescriptionCount: 0, latestDate: '' });
    expect(validClinicUuid(` ${patientId.toUpperCase()} `)).toBe(true);
    expect(validClinicUuid('patient-id')).toBe(false);
    expect(validClinicUuid('../../api/users/me')).toBe(false);
  });

  it('suggests only completed, doctor-assigned visits on the selected day, never just confirmed or in-progress appointments', () => {
    const date = '2026-09-20';
    const queue = (status: ReceptionVisitResponse['status'], number: number): ReceptionVisitResponse => ({
      id: `visit-${number}`, appointmentId: `a000000${number}-0000-4000-8000-000000000000`,
      patientId: `patient-${number}`, doctorId: 'my-doctor', visitDate: date,
      queueNumber: number, status, checkedInAt: `${date}T09:00:00`,
      completedAt: status === 'COMPLETED' ? `${date}T11:0${number}:00` : null,
      startedAt: null
    });
    const rows = [queue('WAITING', 1), queue('COMPLETED', 2), queue('IN_PROGRESS', 3), queue('COMPLETED', 4)];
    expect(completedVisitsForRecord(rows, date).map((row) => row.queueNumber)).toEqual([4, 2]);
    expect(rows.map((row) => row.queueNumber)).toEqual([1, 2, 3, 4]);
    expect(() => completedVisitsForRecord([{ ...rows[0], visitDate: '2026-09-19' }], date)).toThrow('không hợp lệ');
    expect(() => completedVisitsForRecord([{ ...rows[0], doctorId: 'other-doctor' }, rows[1]], date)).toThrow('không hợp lệ');
    expect(() => completedVisitsForRecord([{ ...rows[1], appointmentId: '../../admin' }], date)).toThrow('không hợp lệ');
  });
});
