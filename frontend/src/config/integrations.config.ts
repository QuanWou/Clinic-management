/** Safety default: deployment must explicitly opt in after its backend route and
 * end-to-end checks are verified. Missing or misspelled values remain disabled. */
const explicitlyEnabled = (value: string | undefined) => value === 'true';

export const integrations = {
  adminCatalog: explicitlyEnabled(import.meta.env.VITE_TASK02_API_READY),
  reception: explicitlyEnabled(import.meta.env.VITE_TASK03_API_READY),
  laboratory: explicitlyEnabled(import.meta.env.VITE_TASK04_API_READY),
  billing: explicitlyEnabled(import.meta.env.VITE_TASK05_API_READY),
  notifications: explicitlyEnabled(import.meta.env.VITE_TASK06_API_READY),
  appointmentOwnership: explicitlyEnabled(import.meta.env.VITE_TASK01_SECURITY_READY)
} as const;
