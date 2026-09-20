import type { MedicalRecordResponse } from '../types/domain';

/** Filter only records returned by the authenticated, treating-doctor API. */
export function filterDoctorMedicalRecords(records: MedicalRecordResponse[], text: string): MedicalRecordResponse[] {
  const query = text.trim().toLocaleLowerCase('vi-VN');
  return [...records].filter((record) => !query || [record.id, record.appointmentId, record.patientId,
    record.diagnosis, record.createdAt ?? ''].some((part) => part.toLocaleLowerCase('vi-VN').includes(query)))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.id.localeCompare(b.id));
}

export function medicalRecordsSummary(records: MedicalRecordResponse[]) {
  return {
    count: records.length,
    appointmentCount: new Set(records.map((record) => record.appointmentId)).size,
    prescriptionCount: records.reduce((total, record) => total + (record.prescriptions?.length ?? 0), 0),
    latestDate: records.reduce((latest, record) => (record.createdAt ?? '') > latest ? (record.createdAt ?? '') : latest, '')
  };
}

export const validClinicUuid = (value: string) => /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value.trim());
