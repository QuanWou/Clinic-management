import { useEffect, useState } from 'react';
import { getDoctorSchedules } from '../api/clinic';
import type { DoctorSchedule } from '../types/domain';
import { validateDoctorSchedules } from '../utils/doctorBookingSchedule';

/** Stale requests are ignored and schedules are never reused for another doctor. */
export function useDoctorBookingSchedule(doctorId: string, enabled: boolean) {
  const [result, setResult] = useState<{ doctorId: string; schedules: DoctorSchedule[] } | null>(null);
  const [failure, setFailure] = useState<{ doctorId: string; message: string } | null>(null);
  useEffect(() => {
    if (!enabled || !doctorId) return;
    let active = true;
    void getDoctorSchedules(doctorId).then((schedules) => {
      if (!active) return;
      setResult({ doctorId, schedules: validateDoctorSchedules(schedules, doctorId) });
      setFailure(null);
    }).catch((cause: unknown) => {
      if (!active) return;
      setResult(null);
      setFailure({ doctorId, message: cause instanceof Error ? cause.message : 'Không tải được lịch làm việc.' });
    });
    return () => { active = false; };
  }, [doctorId, enabled]);
  return {
    schedules: enabled && result?.doctorId === doctorId ? result.schedules : null,
    loading: enabled && Boolean(doctorId) && result?.doctorId !== doctorId && failure?.doctorId !== doctorId,
    error: enabled && failure?.doctorId === doctorId ? failure.message : null
  };
}
