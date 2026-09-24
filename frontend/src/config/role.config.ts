export const defaultRole = 'USER';

export const roleWorkspaceMessages = [
  {
    match: 'ADMIN',
    message: 'Monitor clinic operations, users, billing, and notifications from one place.'
  },
  {
    match: 'DOCTOR',
    message: 'Review appointments and patient medical record activity for your schedule.'
  },
  {
    match: 'PATIENT',
    message: 'Track your appointments, medical records, and invoices in the patient portal.'
  }
] as const;

export const fallbackWorkspaceMessage = 'Use the dashboard summary to continue clinic workflows.';
