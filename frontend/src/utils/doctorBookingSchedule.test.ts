import { describe, expect, it } from 'vitest';
import type { DoctorSchedule } from '../types/domain';
import {
  bookingWeekday, doctorEndOptions, doctorStartOptions, scheduleSlotError, shiftsOnDate,
  slotWithinShift, validateDoctorSchedules
} from './doctorBookingSchedule';

const shifts: DoctorSchedule[] = [
  { id: 'morning', dayOfWeek: 1, startTime: '08:00:00', endTime: '11:30:00' },
  { id: 'afternoon', dayOfWeek: 1, startTime: '13:00:00', endTime: '17:00:00' },
  { id: 'tuesday', dayOfWeek: 2, startTime: '08:15:00', endTime: '10:45:00' }
];
const day = '2026-09-28';
const fixedNow = new Date('2026-09-22T03:00:00Z');

describe('doctor schedule-constrained booking', () => {
  it('maps ISO dates to Java weekdays without browser timezone errors', () => {
    expect(bookingWeekday(day)).toBe(1);
    expect(bookingWeekday('2026-09-27')).toBe(7);
    expect(bookingWeekday('2026-02-30')).toBeNull();
    expect(bookingWeekday('2026-9-28')).toBeNull();
    expect(shiftsOnDate(shifts, day)).toHaveLength(2);
    expect(shiftsOnDate(shifts, '2026-09-29')).toHaveLength(1);
    expect(shiftsOnDate(shifts, '2026-09-30')).toEqual([]);
  });

  it('only offers starts in published shifts, never lunch or days off', () => {
    const starts = doctorStartOptions(shifts, day, fixedNow);
    expect(starts).toContain('08:00');
    expect(starts).toContain('11:15');
    expect(starts).toContain('13:00');
    expect(starts).not.toContain('11:30');
    expect(starts).not.toContain('12:00');
    expect(starts).not.toContain('17:00');
    expect(doctorStartOptions(shifts, '2026-09-30', fixedNow)).toEqual([]);
  });

  it('only offers ends in the same shift, including its exact final minute', () => {
    expect(doctorEndOptions(shifts, day, '11:15')).toEqual(['11:30']);
    expect(doctorEndOptions(shifts, day, '08:00')).not.toContain('13:00');
    expect(doctorEndOptions(shifts, day, '12:00')).toEqual([]);
    expect(doctorEndOptions(shifts, '2026-09-29', '08:15')).toContain('10:45');
    expect(slotWithinShift(shifts, day, '11:00', '13:30')).toBe(false);
    expect(slotWithinShift(shifts, day, '11:00', '11:30')).toBe(true);
  });

  it('rejects past starts, invalid schedules, missing schedules and off-shift submissions', () => {
    const todayShifts = [{ dayOfWeek: 2, startTime: '08:00', endTime: '17:00' }];
    expect(doctorStartOptions(todayShifts, '2026-09-22', fixedNow)).not.toContain('09:59');
    expect(doctorStartOptions(todayShifts, '2026-09-22', fixedNow)).not.toContain('10:00');
    expect(doctorStartOptions(todayShifts, '2026-09-22', fixedNow)).toContain('10:15');
    expect(scheduleSlotError(null, day, '08:00', '08:30')).toMatch(/Chưa tải/);
    expect(scheduleSlotError(shifts, '2026-09-30', '08:00', '08:30')).toMatch(/không có ca/);
    expect(scheduleSlotError(shifts, day, '11:00', '13:15')).toMatch(/một ca/);
    expect(scheduleSlotError(shifts, day, '13:00', '13:45')).toBeNull();
    expect(() => validateDoctorSchedules([{ dayOfWeek: 1, startTime: '10:00', endTime: '09:00' }], 'doc')).toThrow();
    expect(() => validateDoctorSchedules([{ dayOfWeek: 1, startTime: '08:00', endTime: '10:00', doctorId: 'other' }], 'doc')).toThrow();
    expect(validateDoctorSchedules(shifts, 'doc')).toEqual(shifts);
  });
});
