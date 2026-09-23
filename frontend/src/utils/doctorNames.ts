import type { DoctorProfileResponse } from '../types/domain';
import { shortId } from './format';

/** Verified Identity names take precedence; a code is never presented as a name. */
export function doctorName(doctor?: DoctorProfileResponse | null): string {
  return doctor?.fullName?.trim() ? `BS. ${doctor.fullName.trim()}` : 'Chưa xác minh tên bác sĩ';
}

export function doctorBookingLabel(doctor: DoctorProfileResponse): string {
  return `${doctorName(doctor)} — ${doctor.specialtyName?.trim() || 'Chưa có chuyên khoa'} · #${shortId(doctor.id)}`;
}