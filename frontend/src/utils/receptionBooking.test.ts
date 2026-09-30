import { describe, expect, it } from 'vitest';
import { clinicDateTime, receptionSlotError } from './receptionBooking';

const now = new Date('2026-09-21T16:17:30.000Z'); // 23:17:30 in Vietnam
const slot = { appointmentDate: '2026-09-21', startTime: '09:00', endTime: '10:00' };

describe('reception booking validates the same clinic clock as the backend', () => {
  it('converts UTC to the clinic date and 24-hour time even if the browser is in another zone', () => {
    expect(clinicDateTime(now)).toEqual({ date: '2026-09-21', time: '23:17' });
    expect(clinicDateTime(new Date('2026-09-21T17:30:00Z'))).toEqual({ date: '2026-09-22', time: '00:30' });
  });

  it('explains the screenshot case: a morning slot submitted late on the same date is expired', () => {
    expect(receptionSlotError(slot, now)).toContain('đã qua');
    expect(receptionSlotError({ ...slot, startTime: '23:17', endTime: '23:59' }, now)).toContain('đã qua');
    expect(receptionSlotError({ ...slot, startTime: '23:18', endTime: '23:59' }, now)).toBeNull();
  });

  it('accepts a future date and rejects reversed or incomplete ranges without inventing availability', () => {
    expect(receptionSlotError({ ...slot, appointmentDate: '2026-09-22' }, now)).toBeNull();
    expect(receptionSlotError({ ...slot, appointmentDate: '2026-09-20' }, now)).toContain('đã qua');
    expect(receptionSlotError({ ...slot, appointmentDate: '2026-09-22', startTime: '10:00', endTime: '09:00' }, now))
      .toContain('Giờ kết thúc');
    expect(receptionSlotError({ ...slot, endTime: '' }, now)).toContain('đầy đủ');
  });
});
