import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DoctorScheduleTimeFields from './DoctorScheduleTimeFields';

const noop = () => undefined;
const shifts = [
  { dayOfWeek: 1, startTime: '08:00:00', endTime: '11:30:00' },
  { dayOfWeek: 1, startTime: '13:00:00', endTime: '17:00:00' }
];
const props = { doctorId: 'doctor-1', date: '2026-09-28', schedules: shifts, loading: false,
  error: null, start: '', end: '', onStartChange: noop, onEndChange: noop };

describe('schedule-only time selection UI', () => {
  it('offers only published shifts with no free time input or lunchtime option', () => {
    const html = renderToStaticMarkup(<DoctorScheduleTimeFields {...props} />);
    expect(html).toContain('08:00–11:30 · 13:00–17:00');
    expect(html).toContain('value="08:00"');
    expect(html).toContain('value="13:00"');
    expect(html).not.toContain('value="12:00"');
    expect(html).not.toContain('type="time"');
    expect(html).toContain('Chọn giờ bắt đầu trước');
  });

  it('confines end choices to the selected shift', () => {
    const html = renderToStaticMarkup(<DoctorScheduleTimeFields {...props} start="11:15" end="11:30" />);
    expect(html).toContain('value="11:30" selected');
    expect(html).not.toContain('value="13:00" selected');
  });

  it('does not allow choosing hours if the doctor has no shift or loading fails', () => {
    const closed = renderToStaticMarkup(<DoctorScheduleTimeFields {...props} date="2026-09-30" />);
    expect(closed).toContain('không làm việc trong ngày này');
    expect(closed).toContain('disabled');
    const pending = renderToStaticMarkup(<DoctorScheduleTimeFields {...props} schedules={null} loading />);
    expect(pending).toContain('Đang tải lịch làm việc');
    const failed = renderToStaticMarkup(<DoctorScheduleTimeFields {...props} schedules={null} error="403" />);
    expect(failed).toContain('Không lấy được lịch làm việc');
  });
});
