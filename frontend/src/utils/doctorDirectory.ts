import type { AdminDoctorResponse } from '../types/domain';

export type DoctorStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Filtering is strictly page-local; the backend owns global totals and pagination. */
export function filterAdminDoctorPage(
  rows: AdminDoctorResponse[], query: string, specialtyId: string, status: DoctorStatusFilter,
  namesByUserId: Readonly<Record<string, string>> = {},
  accountCodesByUserId: Readonly<Record<string, string>> = {}
): AdminDoctorResponse[] {
  const term = query.trim().toLocaleLowerCase('vi-VN');
  return rows.filter((doctor) => {
    if (specialtyId && doctor.specialtyId !== specialtyId) return false;
    if (status !== 'ALL' && doctor.active !== (status === 'ACTIVE')) return false;
    return !term || [doctor.id, doctor.userId, doctor.doctorCode ?? '',
      accountCodesByUserId[doctor.userId] ?? '', doctor.specialtyName ?? '', namesByUserId[doctor.userId] ?? '']
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(term));
  });
}

/** Names belong to Identity accounts, not doctor profile IDs. Do not synthesize a name from an ID. */
export function doctorDisplayName(doctor: AdminDoctorResponse, namesByUserId: Readonly<Record<string, string>>,
  loading = false): string {
  return namesByUserId[doctor.userId]?.trim() || (loading ? 'Đang tải tên bác sĩ...' : 'Chưa có tên bác sĩ');
}