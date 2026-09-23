import type { MedicalRecordResponse, ReceptionVisitResponse } from '../types/domain';

/** Filter only records returned by the authenticated, treating-doctor API. */
export function filterDoctorMedicalRecords(records: MedicalRecordResponse[], text: string): MedicalRecordResponse[] {
  const query = text.trim().toLocaleLowerCase('vi-VN');
  return [...records].filter((record) => !query || [record.recordCode ?? '', record.patientCode ?? '',
    record.patientName ?? '', record.id, record.appointmentId, record.patientId,
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

/** Suggestions are based exclusively on the doctor's server-scoped queue, never a clinic-wide directory. */
export function completedVisitsForRecord(visits: ReceptionVisitResponse[], date: string): ReceptionVisitResponse[] {
  if (!Array.isArray(visits) || visits.some((visit) => !visit || visit.visitDate !== date ||
    !visit.id || !validClinicUuid(visit.appointmentId) || !visit.patientId || !visit.doctorId ||
    !Number.isInteger(visit.queueNumber) || visit.queueNumber < 1) ||
    new Set(visits.map((visit) => visit.doctorId)).size > 1) {
    throw new Error('Danh sách lượt khám được phân công không hợp lệ.');
  }
  return visits.filter((visit) => visit.status === 'COMPLETED')
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || b.queueNumber - a.queueNumber);
}
