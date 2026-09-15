import { defaultRole, fallbackWorkspaceMessage, roleWorkspaceMessages } from '../config/role.config';
import type { CurrentUser } from '../types/domain';

export function normalizeRoles(roles: CurrentUser['roles']): string[] {
  if (!roles) {
    return [];
  }

  return roles.map((role) => typeof role === 'string' ? role : role.code ?? role.name ?? defaultRole);
}

export function getPrimaryRole(roles: string[]): string {
  return roles[0] ?? defaultRole;
}

export function getWorkspaceCopy(role: string): string {
  return roleWorkspaceMessages.find((entry) => role.includes(entry.match))?.message ?? fallbackWorkspaceMessage;
}
