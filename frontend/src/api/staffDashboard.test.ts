import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clinicToday, loadStaffDashboard } from './staffDashboard';
import { getReceptionAppointments, getReceptionQueue } from './clinic';

vi.mock('./clinic', () => ({
  getReceptionAppointments: vi.fn(),
  getReceptionQueue: vi.fn()
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReceptionAppointments).mockResolvedValue([]);
  vi.mocked(getReceptionQueue).mockResolvedValue([]);
});

describe('staff dashboards use only authorized real API routes', () => {
  it('uses clinic local date, not the browser timezone', () => {
    expect(clinicToday(new Date('2026-09-19T18:30:00Z'))).toBe('2026-09-20');
  });

  it.each(['ADMIN', 'RECEPTIONIST'] as const)('%s uses the scoped reception booking and queue controllers', async (role) => {
    const result = await loadStaffDashboard(role, '2026-09-20');
    expect(result).toEqual({ scope: 'RECEPTION', date: '2026-09-20', appointments: [], queue: [] });
    expect(getReceptionAppointments).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
    expect(getReceptionQueue).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
  });

  it('doctor calls only the backend-enforced own queue, never the unscoped staff bookings list', async () => {
    expect(await loadStaffDashboard('DOCTOR', '2026-09-20')).toEqual({ scope: 'DOCTOR', date: '2026-09-20', queue: [] });
    expect(getReceptionAppointments).not.toHaveBeenCalled();
    expect(getReceptionQueue).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
  });

  it('patient cannot request any staff dashboard data', async () => {
    await expect(loadStaffDashboard('PATIENT', '2026-09-20')).rejects.toThrow('not available');
    expect(getReceptionAppointments).not.toHaveBeenCalled();
    expect(getReceptionQueue).not.toHaveBeenCalled();
  });

  it('never interprets missing or malformed backend results as zero statistics', async () => {
    vi.mocked(getReceptionAppointments).mockResolvedValueOnce(null as never);
    await expect(loadStaffDashboard('ADMIN', '2026-09-20')).rejects.toThrow('Invalid staff dashboard response');
    vi.mocked(getReceptionQueue).mockRejectedValueOnce(new Error('Forbidden'));
    await expect(loadStaffDashboard('DOCTOR', '2026-09-20')).rejects.toThrow('Forbidden');
  });
});