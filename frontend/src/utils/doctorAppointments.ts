import type { QueueStatus, ReceptionVisitResponse } from '../types/domain';

export type DoctorQueueFilter = 'ALL' | QueueStatus;

/** These counts describe only the authenticated doctor's checked-in visits for one day. */
export function doctorQueueCounts(visits: ReceptionVisitResponse[]) {
  return {
    checkedIn: visits.length,
    waiting: visits.filter((item) => item.status === 'WAITING' || item.status === 'CALLED').length,
    inProgress: visits.filter((item) => item.status === 'IN_PROGRESS').length,
    completed: visits.filter((item) => item.status === 'COMPLETED').length
  };
}

export function filterDoctorVisits(visits: ReceptionVisitResponse[], search: string, status: DoctorQueueFilter) {
  const term = search.trim().toLocaleLowerCase('vi-VN');
  return visits.filter((visit) =>
    (status === 'ALL' || visit.status === status) &&
    (!term || [visit.id, visit.appointmentId, visit.patientId, String(visit.queueNumber)]
      .some((value) => value.toLocaleLowerCase('vi-VN').includes(term))))
    .sort((a, b) => a.queueNumber - b.queueNumber || a.id.localeCompare(b.id));
}

export function shiftClinicDay(date: string, offset: number): string {
  const day = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(day.getTime())) return date;
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}
