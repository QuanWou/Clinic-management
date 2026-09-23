import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { DoctorProfileResponse } from '../types/domain';
import DoctorPicker, { doctorSpecialty, filterBookingDoctors } from './DoctorPicker';

const doctors: DoctorProfileResponse[] = [
  { id: 'e1000000-0000-4000-8000-000000000001', userId: 'account-1', fullName: 'Nguyễn Minh Khôi', specialtyName: 'Cardiology' },
  { id: 'e1000000-0000-4000-8000-000000000002', userId: 'account-2', fullName: 'Đặng Ngọc Mai', specialtyName: 'Cardiology' },
  { id: 'f2000000-0000-4000-8000-000000000001', userId: 'account-3', fullName: 'Trần Thanh Tùng', specialtyName: 'General Medicine' }
];

const noop = () => undefined;

describe('doctor appointment picker', () => {
  it('searches verified names and both original and translated specialties without confusing repeated code prefixes', () => {
    expect(filterBookingDoctors(doctors, 'nguyễn minh').map((doctor) => doctor.id)).toEqual([doctors[0].id]);
    expect(filterBookingDoctors(doctors, 'TIM MẠCH')).toHaveLength(2);
    expect(filterBookingDoctors(doctors, 'cardiology')).toHaveLength(2);
    expect(filterBookingDoctors(doctors, 'nội tổng quát').map((doctor) => doctor.id)).toEqual([doctors[2].id]);
    expect(filterBookingDoctors(doctors, 'không có')).toEqual([]);
    expect(doctorSpecialty(doctors[0])).toBe('Tim mạch');
    expect(doctorSpecialty(doctors[2])).toBe('Nội tổng quát');
    expect(doctorSpecialty({ ...doctors[0], specialtyName: 'Unknown' })).toBe('Unknown');
  });

  it('renders the selected verified doctor and specialty instead of an ambiguous ID or a giant native select', () => {
    const html = renderToStaticMarkup(<DoctorPicker doctors={doctors} labelId="doctor-label" value={doctors[1].id} onChange={noop} />);
    expect(html).toContain('BS. Đặng Ngọc Mai');
    expect(html).toContain('Tim mạch');
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('<select');
    expect(html).not.toContain('#E1000000');
    expect(html).not.toContain('Nguyễn Minh Khôi');
  });

  it('gives an accurate loading state and disables selection when no doctors are available', () => {
    const html = renderToStaticMarkup(<DoctorPicker doctors={[]} labelId="doctor-label" value="" onChange={noop} disabled loading />);
    expect(html).toContain('Đang tải bác sĩ...');
    expect(html).toContain('disabled');
    expect(html).not.toContain('Bác sĩ #');
  });
});
