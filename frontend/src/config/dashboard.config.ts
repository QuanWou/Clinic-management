export const dashboardSummaryCards = [
  {
    metric: 'appointments',
    label: 'Appointments',
    detail: 'Your current appointment workload',
    tone: 'green'
  },
  {
    metric: 'medicalRecords',
    label: 'Medical records',
    detail: 'Records available from backend',
    tone: 'blue'
  },
  {
    metric: 'invoices',
    label: 'Invoices',
    detail: 'Billing items linked to your account',
    tone: 'orange'
  }
] as const;
