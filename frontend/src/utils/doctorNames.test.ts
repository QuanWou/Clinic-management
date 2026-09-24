import { describe, expect, it } from 'vitest';
import { doctorBookingLabel, doctorName } from './doctorNames';

describe('verified doctor labels', () => {
  it('shows the linked doctor name before specialty, retaining the code only for disambiguation', () => {
    const doctor = { id: 'e1000000-0000-4000-8000-000000000001', userId: 'account-1',
      fullName: ' Nguyễn Minh Khôi ', specialtyName: 'Tim mạch' };
    expect(doctorBookingLabel(doctor)).toContain('BS. Nguyễn Minh Khôi — Tim mạch');
    expect(doctorName(doctor)).toBe('BS. Nguyễn Minh Khôi');
    expect(doctorBookingLabel({ ...doctor, fullName: undefined })).toContain('Chưa xác minh tên bác sĩ');
  });
});