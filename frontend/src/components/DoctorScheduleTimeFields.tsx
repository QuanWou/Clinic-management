import type { Ref } from 'react';
import type { DoctorSchedule } from '../types/domain';
import { doctorEndOptions, doctorStartOptions, shiftsOnDate } from '../utils/doctorBookingSchedule';
import './doctorScheduleTimeFields.css';

type Props = {
  doctorId: string;
  date: string;
  schedules: DoctorSchedule[] | null;
  loading: boolean;
  error: string | null;
  start: string;
  end: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  disabled?: boolean;
  startRef?: Ref<HTMLSelectElement>;
  endRef?: Ref<HTMLSelectElement>;
  startId?: string;
  endId?: string;
  startError?: string;
  endError?: string;
};

/** Schedule-only time controls. The appointment availability API checks overlaps at submit time. */
export default function DoctorScheduleTimeFields({ doctorId, date, schedules, loading, error,
  start, end, onStartChange, onEndChange, disabled = false, startRef, endRef, startId, endId,
  startError, endError }: Props) {
  const shifts = schedules && date ? shiftsOnDate(schedules, date) : [];
  const starts = schedules && date ? doctorStartOptions(schedules, date) : [];
  const ends = schedules && date && starts.includes(start) ? doctorEndOptions(schedules, date, start) : [];
  const ready = !!doctorId && !!date && schedules !== null && shifts.length > 0 && starts.length > 0 && !error;
  const message = !doctorId ? 'Chọn bác sĩ để xem giờ làm việc.'
    : !date ? 'Chọn ngày khám để xem các ca làm việc.'
      : loading ? 'Đang tải lịch làm việc của bác sĩ...'
        : error ? `Không lấy được lịch làm việc: ${error}. Vui lòng tải lại.`
          : !shifts.length ? 'Bác sĩ không làm việc trong ngày này. Hãy chọn ngày khác.'
            : !starts.length ? 'Không còn giờ bắt đầu hợp lệ trong ngày này. Hãy chọn ngày khác.'
              : `Ca làm việc: ${shifts.map((shift) => `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`).join(' · ')}. Giờ hiển thị theo giờ Việt Nam.`;
  return <>
    <p className="doctor-schedule-help" role="status">{message}</p>
    <label className="doctor-schedule-field">Giờ bắt đầu
      <select ref={startRef} id={startId} required disabled={disabled || !ready}
        value={starts.includes(start) ? start : ''} aria-invalid={Boolean(startError)}
        onChange={(event) => onStartChange(event.target.value)}>
        <option value="">{ready ? 'Chọn giờ bắt đầu' : 'Chưa có giờ khả dụng'}</option>
        {starts.map((time) => <option key={time} value={time}>{time}</option>)}
      </select>
      {startError && <span className="appointment-field-error">{startError}</span>}
    </label>
    <label className="doctor-schedule-field">Giờ kết thúc
      <select ref={endRef} id={endId} required disabled={disabled || !ready || !starts.includes(start)}
        value={ends.includes(end) ? end : ''} aria-invalid={Boolean(endError)}
        onChange={(event) => onEndChange(event.target.value)}>
        <option value="">{ends.length ? 'Chọn giờ kết thúc' : 'Chọn giờ bắt đầu trước'}</option>
        {ends.map((time) => <option key={time} value={time}>{time}</option>)}
      </select>
      {endError && <span className="appointment-field-error">{endError}</span>}
    </label>
  </>;
}
