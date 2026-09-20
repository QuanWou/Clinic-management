export const authConfig = {
  accessTokenKey: 'clinic.accessToken',
  login: {
    eyebrow: 'Clinic Management',
    title: 'Sign in to your workspace',
    subtitle: 'Use your clinic account to manage appointments, medical records, invoices, and notifications.',
    emailLabel: 'Email',
    emailPlaceholder: 'patient@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: '********',
    submitLabel: 'Sign in',
    loadingLabel: 'Signing in...'
  },
  register: {
    eyebrow: 'Create patient account',
    title: 'Start managing your care',
    subtitle: 'Create an account, then complete your patient profile to access the clinic workspace.',
    submitLabel: 'Create account',
    loadingLabel: 'Creating account...'
  }
} as const;
