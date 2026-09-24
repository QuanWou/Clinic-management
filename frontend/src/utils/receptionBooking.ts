import type { ReceptionBookingRequest, ReceptionRescheduleRequest } from '../types/domain';

type Slot = Pick<ReceptionBookingRequest | ReceptionRescheduleRequest, 'appointmentDate' | 'startTime' | 'endTime'>;

/** The backend checks appointments in Asia/Ho_Chi_Minh, independent of browser timezone. */
export function clinicDateTime(now: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

/** Prevalidate the date and start/end; the server remains authoritative and rechecks before writing. */
export function receptionSlotError(slot: Slot, now: Date = new Date()): string | null {
  const { date, time } = clinicDateTime(now);
  if (!slot.appointmentDate || !slot.startTime || !slot.endTime) {
    return 'Vui lòng nhập đầy đủ ngày khám, giờ bắt đầu và giờ kết thúc.';
  }
  if (slot.startTime >= slot.endTime) return 'Giờ kết thúc phải sau giờ bắt đầu.';
  if (`${slot.appointmentDate}T${slot.startTime}` <= `${date}T${time}`) {
    return 'Giờ bắt đầu đã qua hoặc không còn ở tương lai. Vui lòng chọn thời gian khám sau thời điểm hiện tại (giờ Việt Nam).';
  }
  return null;
}
