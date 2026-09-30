export const appConfig = {
  name: 'Clinic Management',
  shortName: 'Clinic',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  dashboardLoadError: 'Unable to load dashboard'
} as const;
