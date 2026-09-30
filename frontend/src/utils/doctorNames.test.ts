import { describe, expect, it } from 'vitest';
import { doctorBookingLabel, doctorName } from './doctorNames';

describe('verified doctor labels', () => {
  it('shows the linked doctor name before specialty, retaining the code only for disambiguation', () => {
    const doctor = { id: 'e1000000-0000-4000-8000-000000000001', doctorCode: 'BS000005', userId: 'account-1',
      fullName: ' Nguyễn Minh Khôi ', specialtyName: 'Tim mạch' };
    expect(doctorBookingLabel(doctor)).toBe('BS. Nguyễn Minh Khôi — Tim mạch · BS000005');
    expect(doctorName(doctor)).toBe('BS. Nguyễn Minh Khôi');
    expect(doctorBookingLabel({ ...doctor, fullName: undefined })).toContain('Chưa xác minh tên bác sĩ');
    expect(doctorBookingLabel(doctor)).not.toContain('e1000000');
  });
});