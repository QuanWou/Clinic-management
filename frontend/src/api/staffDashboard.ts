import { getReceptionAppointments, getReceptionQueue } from './clinic';
import type { AppointmentResponse, ReceptionVisitResponse } from '../types/domain';
import type { ClinicRole } from '../utils/roles';

/** Use the clinic's calendar day rather than the browser's potentially different zone. */
export function clinicToday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export type StaffDashboard =
  | { scope: 'RECEPTION'; date: string; appointments: AppointmentResponse[]; queue: ReceptionVisitResponse[] }
  | { scope: 'DOCTOR'; date: string; queue: ReceptionVisitResponse[] };

/** Never call the unscoped booking list for a doctor or any staff API for a patient. */
export async function loadStaffDashboard(role: ClinicRole, date = clinicToday()): Promise<StaffDashboard> {
  if (role === 'DOCTOR') {
    // ReceptionQueueService.list enforces the authenticated doctor's own doctor ID.
    const queue = await getReceptionQueue({ date });
    if (!Array.isArray(queue)) throw new Error('Invalid doctor queue response');
    return { scope: 'DOCTOR', date, queue };
  }
  if (role === 'ADMIN' || role === 'RECEPTIONIST') {
    const [appointments, queue] = await Promise.all([
      getReceptionAppointments({ date }), getReceptionQueue({ date })
    ]);
    if (!Array.isArray(appointments) || !Array.isArray(queue)) {
      throw new Error('Invalid staff dashboard response');
    }
    return { scope: 'RECEPTION', date, appointments, queue };
  }
  throw new Error('Staff dashboard is not available for this role');
}