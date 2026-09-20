import { fallbackWorkspaceMessage, roleWorkspaceMessages } from '../config/role.config';
import type { CurrentUser } from '../types/domain';
import type { AppView } from '../types/view';

export type ClinicRole = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR' | 'PATIENT';
const rolePriority: ClinicRole[] = ['ADMIN', 'RECEPTIONIST', 'DOCTOR', 'PATIENT'];
const access: Record<AppView, ClinicRole[]> = {
  dashboard: rolePriority,
  appointments: rolePriority,
  patients: ['ADMIN', 'RECEPTIONIST', 'PATIENT'],
  doctors: ['ADMIN', 'RECEPTIONIST', 'PATIENT'],
  'doctor-profile': ['DOCTOR'],
  'medical-records': ['DOCTOR', 'PATIENT'],
  invoices: ['ADMIN', 'RECEPTIONIST', 'PATIENT'],
  catalog: ['ADMIN', 'DOCTOR'],
  notifications: rolePriority,
  settings: rolePriority
};

export function normalizeRoles(roles: CurrentUser['roles']): ClinicRole[] {
  if (!Array.isArray(roles)) return [];
  return roles.flatMap((entry) => {
    const value = (typeof entry === 'string' ? entry : entry.code ?? '').replace(/^ROLE_/, '').toUpperCase();
    return rolePriority.includes(value as ClinicRole) ? [value as ClinicRole] : [];
  });
}

export function getPrimaryRole(roles: ClinicRole[]): ClinicRole | null {
  return rolePriority.find((role) => roles.includes(role)) ?? null;
}

export function canAccess(view: AppView, roles: ClinicRole[]): boolean {
  return access[view].some((role) => roles.includes(role));
}

export function getWorkspaceCopy(role: string): string {
  return roleWorkspaceMessages.find((entry) => role.includes(entry.match))?.message ?? fallbackWorkspaceMessage;
}
