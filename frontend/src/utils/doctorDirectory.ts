import type { AdminDoctorResponse } from '../types/domain';

export type DoctorStatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

/** Filtering is strictly page-local; the backend owns global totals and pagination. */
export function filterAdminDoctorPage(
  rows: AdminDoctorResponse[], query: string, specialtyId: string, status: DoctorStatusFilter
): AdminDoctorResponse[] {
  const term = query.trim().toLocaleLowerCase('vi-VN');
  return rows.filter((doctor) => {
    if (specialtyId && doctor.specialtyId !== specialtyId) return false;
    if (status !== 'ALL' && doctor.active !== (status === 'ACTIVE')) return false;
    return !term || [doctor.id, doctor.userId, doctor.specialtyName ?? '']
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(term));
  });
}