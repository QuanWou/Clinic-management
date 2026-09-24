import { getReceptionAppointments, getReceptionQueue, getReceptionHistory } from './clinic';
import type { AppointmentResponse, ReceptionVisitResponse, ReceptionHistoryResponse } from '../types/domain';
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
  | { scope: 'RECEPTION'; date: string; appointments: AppointmentResponse[]; queue: ReceptionVisitResponse[];
      history?: ReceptionHistoryResponse; historyError?: string }
  | { scope: 'DOCTOR'; date: string; queue: ReceptionVisitResponse[];
      history?: ReceptionHistoryResponse; historyError?: string };

function minusDays(date: string, count: number): string {
  const shifted = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(shifted.getTime())) throw new Error('Invalid dashboard date');
  shifted.setUTCDate(shifted.getUTCDate() - count);
  return shifted.toISOString().slice(0, 10);
}

async function historyFor(scope: 'RECEPTION' | 'DOCTOR', date: string) {
  const from = minusDays(date, 29);
  try {
    const history = await getReceptionHistory(from, date);
    if (history?.scope !== scope || history.from !== from || history.to !== date ||
        !Array.isArray(history.days) || history.days.length !== 30 ||
        history.days.some((day, index) => day.date !== minusDays(from, -index))) {
      throw new Error('Unexpected history scope or date range');
    }
    return { history };
  } catch (cause) {
    return { historyError: cause instanceof Error ? cause.message : 'Unable to load 30-day history' };
  }
}

/** Never call the unscoped booking list for a doctor or any staff API for a patient. */
export async function loadStaffDashboard(role: ClinicRole, date = clinicToday()): Promise<StaffDashboard> {
  if (role === 'DOCTOR') {
    // ReceptionQueueService.list enforces the authenticated doctor's own doctor ID.
    const queue = await getReceptionQueue({ date });
    if (!Array.isArray(queue)) throw new Error('Invalid doctor queue response');
    return { scope: 'DOCTOR', date, queue, ...await historyFor('DOCTOR', date) };
  }
  if (role === 'ADMIN' || role === 'RECEPTIONIST') {
    const [appointments, queue] = await Promise.all([
      getReceptionAppointments({ date }), getReceptionQueue({ date })
    ]);
    if (!Array.isArray(appointments) || !Array.isArray(queue)) {
      throw new Error('Invalid staff dashboard response');
    }
    return { scope: 'RECEPTION', date, appointments, queue, ...await historyFor('RECEPTION', date) };
  }
  throw new Error('Staff dashboard is not available for this role');
}