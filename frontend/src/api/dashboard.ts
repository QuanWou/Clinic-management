import { apiRequest } from './client';
import { apiEndpoints } from './endpoints';
import type { DashboardResponse } from '../types/domain';

export function getDashboard(): Promise<DashboardResponse> {
  return apiRequest<DashboardResponse>(apiEndpoints.dashboard.me);
}
