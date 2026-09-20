/** Integrated capabilities default on. A deployer can explicitly disable one
 * with VITE_TASKxx_*_READY=false while rolling services independently. */
const enabledUnlessDisabled = (value: string | undefined) => value !== 'false';

export const integrations = {
  adminCatalog: enabledUnlessDisabled(import.meta.env.VITE_TASK02_API_READY),
  reception: enabledUnlessDisabled(import.meta.env.VITE_TASK03_API_READY),
  laboratory: enabledUnlessDisabled(import.meta.env.VITE_TASK04_API_READY),
  billing: enabledUnlessDisabled(import.meta.env.VITE_TASK05_API_READY),
  notifications: enabledUnlessDisabled(import.meta.env.VITE_TASK06_API_READY),
  appointmentOwnership: enabledUnlessDisabled(import.meta.env.VITE_TASK01_SECURITY_READY)
} as const;
