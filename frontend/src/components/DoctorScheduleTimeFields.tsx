import type { Ref } from 'react';
import type { DoctorSchedule } from '../types/domain';
import { doctorEndOptions, doctorStartOptions, shiftsOnDate, type OccupiedAppointmentSlot } from '../utils/doctorBookingSchedule';
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
  occupied?: OccupiedAppointmentSlot[];
  occupiedLoading?: boolean;
  occupiedError?: string | null;
  variant?: 'select' | 'slots';
};

/** Published schedule plus known occupied slots. The submit-time availability API remains the final race-safe check. */
export default function DoctorScheduleTimeFields({ doctorId, date, schedules, loading, error,
  start, end, onStartChange, onEndChange, disabled = false, startRef, endRef, startId, endId,
  startError, endError, occupied, occupiedLoading = false, occupiedError = null, variant = 'select' }: Props) {
  const shifts = schedules && date ? shiftsOnDate(schedules, date) : [];
  const rawStarts = schedules && date ? doctorStartOptions(schedules, date) : [];
  const starts = schedules && date ? doctorStartOptions(schedules, date, new Date(), occupied ?? []) : [];
  const ends = schedules && date && starts.includes(start) ? doctorEndOptions(schedules, date, start, occupied ?? []) : [];
  const hiddenCount = Math.max(0, rawStarts.length - starts.length);
  const ready = !!doctorId && !!date && schedules !== null && shifts.length > 0 && starts.length > 0
    && !error && !occupiedLoading && !occupiedError;
  const message = !doctorId ? 'Chọn bác sĩ để xem giờ làm việc.'
    : !date ? 'Chọn ngày khám để xem các ca làm việc.'
      : loading ? 'Đang tải lịch làm việc của bác sĩ...'
        : error ? `Không lấy được lịch làm việc: ${error}. Vui lòng tải lại.`
          : occupiedLoading ? 'Đang kiểm tra các khung giờ đã có lịch hẹn...'
            : occupiedError ? `Không kiểm tra được khung giờ đã đặt: ${occupiedError}. Vui lòng tải lại.`
          : !shifts.length ? 'Bác sĩ không làm việc trong ngày này. Hãy chọn ngày khác.'
            : !starts.length ? 'Không còn giờ bắt đầu hợp lệ trong ngày này. Hãy chọn ngày khác.'
              : `Ca làm việc: ${shifts.map((shift) => `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`).join(' · ')}. ${hiddenCount ? `Đã ẩn ${hiddenCount} mốc giờ đang bận. ` : ''}Giờ hiển thị theo giờ Việt Nam.`;
  if (variant === 'slots') return <>
    <p className="doctor-schedule-help" role="status">{message}</p>
    <fieldset className="doctor-schedule-slot-field doctor-schedule-start-slots" disabled={disabled || !ready}>
      <legend>Giờ bắt đầu</legend>
      <span className="doctor-schedule-slot-hint">Chọn một khung giờ còn trống.</span>
      <div className="doctor-schedule-slot-grid" role="group" aria-label="Các giờ bắt đầu khả dụng">
        {starts.map((time) => <button type="button" key={time} className={start === time ? 'is-selected' : undefined}
          aria-pressed={start === time} onClick={() => onStartChange(time)}>{time}</button>)}
      </div>
      {startError && <span className="appointment-field-error">{startError}</span>}
    </fieldset>
    <fieldset className="doctor-schedule-slot-field doctor-schedule-end-slots" disabled={disabled || !ready || !starts.includes(start)}>
      <legend>Giờ kết thúc</legend>
      <span className="doctor-schedule-slot-hint">{starts.includes(start) ? 'Chỉ hiển thị các mốc hợp lệ trong cùng ca làm việc.' : 'Chọn giờ bắt đầu trước.'}</span>
      {starts.includes(start) && <div className="doctor-schedule-slot-grid doctor-schedule-end-grid" role="group" aria-label="Các giờ kết thúc khả dụng">
        {ends.map((time) => <button type="button" key={time} className={end === time ? 'is-selected' : undefined}
          aria-pressed={end === time} onClick={() => onEndChange(time)}>{time}</button>)}
      </div>}
      {endError && <span className="appointment-field-error">{endError}</span>}
    </fieldset>
  </>;

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
