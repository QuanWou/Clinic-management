import type { DoctorSchedule } from '../types/domain';
import { clinicDateTime } from './receptionBooking';

/** Backend uses Java DayOfWeek: Monday=1, Sunday=7. Parse date-only without browser timezone shifts. */
export function bookingWeekday(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return null;
  return utc.getUTCDay() || 7;
}

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) !== 0) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function hhmm(value: number): string {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function validateDoctorSchedules(result: unknown, doctorId: string): DoctorSchedule[] {
  if (!Array.isArray(result) || result.some((schedule) => !schedule || !Number.isInteger(schedule.dayOfWeek)
    || schedule.dayOfWeek < 1 || schedule.dayOfWeek > 7 || typeof schedule.startTime !== 'string'
    || typeof schedule.endTime !== 'string' || minutes(schedule.startTime) === null || minutes(schedule.endTime) === null
    || schedule.startTime >= schedule.endTime
    || ('doctorId' in schedule && schedule.doctorId != null && schedule.doctorId !== doctorId))) {
    throw new Error('Lịch làm việc của bác sĩ không hợp lệ. Vui lòng tải lại.');
  }
  return result;
}

export function shiftsOnDate(schedules: DoctorSchedule[], date: string): DoctorSchedule[] {
  const day = bookingWeekday(date);
  return day === null ? [] : schedules.filter((shift) => shift.dayOfWeek === day)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

/** Start and end must belong to ONE shift; two disjoint shifts cannot be bridged. */
export function slotWithinShift(schedules: DoctorSchedule[], date: string, start: string, end: string): boolean {
  const first = minutes(start), last = minutes(end);
  return first !== null && last !== null && first < last && shiftsOnDate(schedules, date).some((shift) =>
    first >= minutes(shift.startTime)! && last <= minutes(shift.endTime)!);
}

export function scheduleSlotError(schedules: DoctorSchedule[] | null, date: string, start: string, end: string): string | null {
  if (!schedules) return 'Chưa tải được lịch làm việc của bác sĩ.';
  if (!bookingWeekday(date)) return 'Vui lòng chọn ngày khám hợp lệ.';
  if (!shiftsOnDate(schedules, date).length) return 'Bác sĩ không có ca làm việc trong ngày này. Vui lòng chọn ngày khác.';
  if (!start || !end) return 'Vui lòng chọn giờ bắt đầu và kết thúc theo ca làm việc.';
  if (!slotWithinShift(schedules, date, start, end)) return 'Khung giờ phải nằm trọn trong một ca làm việc của bác sĩ.';
  return null;
}

/** 15-minute choices, anchored to the published shift start, with the actual shift end included. */
export function doctorStartOptions(schedules: DoctorSchedule[], date: string, now: Date = new Date()): string[] {
  const current = clinicDateTime(now);
  const options = new Set<string>();
  for (const shift of shiftsOnDate(schedules, date)) {
    const begin = minutes(shift.startTime)!, finish = minutes(shift.endTime)!;
    for (let minute = begin; minute + 15 <= finish; minute += 15) {
      const text = hhmm(minute);
      if (date > current.date || date === current.date && text > current.time) options.add(text);
    }
  }
  return [...options].sort();
}

export function doctorEndOptions(schedules: DoctorSchedule[], date: string, start: string): string[] {
  const first = minutes(start);
  if (first === null) return [];
  const options = new Set<string>();
  for (const shift of shiftsOnDate(schedules, date)) {
    const begin = minutes(shift.startTime)!, finish = minutes(shift.endTime)!;
    if (first < begin || first >= finish) continue;
    for (let minute = first + 15; minute <= finish; minute += 15) options.add(hhmm(minute));
    options.add(hhmm(finish));
  }
  return [...options].sort();
}
