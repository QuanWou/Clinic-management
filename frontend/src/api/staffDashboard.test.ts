import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clinicToday, loadStaffDashboard } from './staffDashboard';
import { getReceptionAppointments, getReceptionQueue, getReceptionHistory } from './clinic';

vi.mock('./clinic', () => ({
  getReceptionAppointments: vi.fn(),
  getReceptionQueue: vi.fn(),
  getReceptionHistory: vi.fn()
}));

const days = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 7, 22 + index)).toISOString().slice(0, 10),
  appointments: index === 27 ? 4 : 0, checkIns: index === 27 ? 3 : 0,
  completedVisits: index === 27 ? 3 : 0, cancelledAppointments: index === 27 ? 1 : 0
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getReceptionAppointments).mockResolvedValue([]);
  vi.mocked(getReceptionQueue).mockResolvedValue([]);
  vi.mocked(getReceptionHistory).mockResolvedValue({ from: '2026-08-22', to: '2026-09-20', scope: 'RECEPTION', days });
});

describe('staff dashboards use only authorized real API routes', () => {
  it('uses clinic local date, not the browser timezone', () => {
    expect(clinicToday(new Date('2026-09-19T18:30:00Z'))).toBe('2026-09-20');
  });

  it.each(['ADMIN', 'RECEPTIONIST'] as const)('%s uses the scoped reception booking and queue controllers', async (role) => {
    const result = await loadStaffDashboard(role, '2026-09-20');
    expect(result).toEqual({ scope: 'RECEPTION', date: '2026-09-20', appointments: [], queue: [],
      history: { from: '2026-08-22', to: '2026-09-20', scope: 'RECEPTION', days } });
    expect(getReceptionAppointments).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
    expect(getReceptionQueue).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
    expect(getReceptionHistory).toHaveBeenCalledExactlyOnceWith('2026-08-22', '2026-09-20');
  });

  it('doctor calls only the backend-enforced own queue, never the unscoped staff bookings list', async () => {
    vi.mocked(getReceptionHistory).mockResolvedValueOnce({ from: '2026-08-22', to: '2026-09-20', scope: 'DOCTOR', days });
    expect(await loadStaffDashboard('DOCTOR', '2026-09-20')).toEqual({ scope: 'DOCTOR', date: '2026-09-20', queue: [],
      history: { from: '2026-08-22', to: '2026-09-20', scope: 'DOCTOR', days } });
    expect(getReceptionAppointments).not.toHaveBeenCalled();
    expect(getReceptionQueue).toHaveBeenCalledExactlyOnceWith({ date: '2026-09-20' });
    expect(getReceptionHistory).toHaveBeenCalledExactlyOnceWith('2026-08-22', '2026-09-20');
  });

  it('patient cannot request any staff dashboard data', async () => {
    await expect(loadStaffDashboard('PATIENT', '2026-09-20')).rejects.toThrow('not available');
    expect(getReceptionAppointments).not.toHaveBeenCalled();
    expect(getReceptionQueue).not.toHaveBeenCalled();
    expect(getReceptionHistory).not.toHaveBeenCalled();
  });

  it('never interprets missing or malformed backend results as zero statistics', async () => {
    vi.mocked(getReceptionAppointments).mockResolvedValueOnce(null as never);
    await expect(loadStaffDashboard('ADMIN', '2026-09-20')).rejects.toThrow('Invalid staff dashboard response');
    vi.mocked(getReceptionQueue).mockRejectedValueOnce(new Error('Forbidden'));
    await expect(loadStaffDashboard('DOCTOR', '2026-09-20')).rejects.toThrow('Forbidden');
  });

  it('keeps day details but flags history errors rather than showing invented zeros', async () => {
    vi.mocked(getReceptionHistory).mockRejectedValueOnce(new Error('History temporarily unavailable'));
    const result = await loadStaffDashboard('ADMIN', '2026-09-20');
    expect(result.history).toBeUndefined();
    expect(result.historyError).toContain('temporarily unavailable');
    vi.mocked(getReceptionHistory).mockResolvedValueOnce({ from: '2026-08-22', to: '2026-09-20', scope: 'DOCTOR', days });
    const mismatch = await loadStaffDashboard('ADMIN', '2026-09-20');
    expect(mismatch.history).toBeUndefined();
    expect(mismatch.historyError).toContain('Unexpected history scope');
  });
});