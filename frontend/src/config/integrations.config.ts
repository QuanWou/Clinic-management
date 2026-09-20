/**
 * Tasks 02–06 currently live in separate, unmerged worktrees. Never activate
 * their UI against the baseline gateway based on source code presence alone.
 * The deployer must verify the matching backend is merged, started and routed
 * before explicitly enabling each capability.
 */
export const integrations = {
  adminCatalog: import.meta.env.VITE_TASK02_API_READY === 'true',
  reception: import.meta.env.VITE_TASK03_API_READY === 'true',
  laboratory: import.meta.env.VITE_TASK04_API_READY === 'true',
  billing: import.meta.env.VITE_TASK05_API_READY === 'true',
  notifications: import.meta.env.VITE_TASK06_API_READY === 'true',
  appointmentOwnership: import.meta.env.VITE_TASK01_SECURITY_READY === 'true'
} as const;