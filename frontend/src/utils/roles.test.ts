import { describe, expect, it } from 'vitest';
import { canAccess, getPrimaryRole, normalizeRoles } from './roles';

describe('role isolation', () => {
  it('normalizes backend ROLE_ codes without granting privileges to unknown roles', () => {
    expect(normalizeRoles(['ROLE_PATIENT', 'ROLE_DOCTOR'])).toEqual(['PATIENT', 'DOCTOR']);
    expect(normalizeRoles([{ code: 'ROLE_ADMIN' }, { name: 'Administrator' }])).toEqual(['ADMIN']);
    expect(normalizeRoles(['ROLE_SUPERUSER'])).toEqual([]);
    expect(normalizeRoles(undefined)).toEqual([]);
  });

  it('chooses a deterministic primary role for accounts with multiple roles', () => {
    expect(getPrimaryRole(['PATIENT', 'RECEPTIONIST'])).toBe('RECEPTIONIST');
    expect(getPrimaryRole([])).toBeNull();
  });

  it('blocks staff-only pages for patient accounts and patient-only profile for staff', () => {
    expect(canAccess('doctor-profile', ['PATIENT'])).toBe(false);
    expect(canAccess('invoices', ['DOCTOR'])).toBe(false);
    expect(canAccess('doctor-profile', ['DOCTOR'])).toBe(true);
    expect(canAccess('invoices', ['RECEPTIONIST'])).toBe(true);
    expect(canAccess('dashboard', [])).toBe(false);
    expect(canAccess('medical-records', ['ADMIN'])).toBe(false);
    expect(canAccess('medical-records', ['RECEPTIONIST'])).toBe(false);
    expect(canAccess('medical-records', ['DOCTOR'])).toBe(true);
    expect(canAccess('medical-records', ['PATIENT'])).toBe(true);
    expect(canAccess('patients', ['DOCTOR'])).toBe(false);
  });

  it('does not mix permissions of multiple roles when using the selected primary role', () => {
    const role = getPrimaryRole(normalizeRoles(['ROLE_PATIENT', 'ROLE_ADMIN']));
    expect(role).toBe('ADMIN');
    expect(canAccess('medical-records', role ? [role] : [])).toBe(false);
    expect(canAccess('invoices', role ? [role] : [])).toBe(true);
  });
});
