export const appConfig = {
  name: 'Clinic Management',
  shortName: 'Clinic',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090',
  dashboardLoadError: 'Unable to load dashboard'
} as const;
