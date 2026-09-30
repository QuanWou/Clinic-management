import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type { DashboardResponse } from '../types/domain';

// The current aggregator calls patient-only endpoints. Do not request it for staff roles.
export async function getDashboard(): Promise<DashboardResponse> {
  const result = await apiRequest<DashboardResponse>(apiEndpoints.dashboard.me);
  if (!result || !Array.isArray(result.appointments) || !Array.isArray(result.medicalRecords) || !Array.isArray(result.invoices)) {
    throw new Error('Invalid dashboard data from API');
  }
  return result;
}
