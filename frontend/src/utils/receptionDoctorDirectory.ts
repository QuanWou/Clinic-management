import type { DoctorProfileResponse } from '../types/domain';

/** Filters only the active-doctor directory returned to this signed-in account. */
export function filterReceptionDoctors(
  doctors: DoctorProfileResponse[], query: string, specialtyId: string
): DoctorProfileResponse[] {
  const term = query.trim().toLocaleLowerCase('vi-VN');
  return doctors.filter((doctor) => {
    if (specialtyId && doctor.specialtyId !== specialtyId) return false;
    return !term || [doctor.id, doctor.fullName ?? '', doctor.specialtyName ?? '']
      .some((text) => text.toLocaleLowerCase('vi-VN').includes(term));
  });
}
