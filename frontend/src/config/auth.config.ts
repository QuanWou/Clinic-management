export const authConfig = {
  accessTokenKey: 'clinic.accessToken',
  login: {
    eyebrow: 'Quản lý phòng khám',
    title: 'Đăng nhập vào hệ thống',
    subtitle: 'Sử dụng tài khoản của bạn để xem lịch hẹn và các chức năng được cấp quyền.',
    emailLabel: 'Email',
    emailPlaceholder: 'patient@example.com',
    passwordLabel: 'Mật khẩu',
    passwordPlaceholder: '********',
    submitLabel: 'Đăng nhập',
    loadingLabel: 'Đang đăng nhập...'
  },
  register: {
    eyebrow: 'Create patient account',
    title: 'Start managing your care',
    subtitle: 'Create an account, then complete your patient profile to access the clinic workspace.',
    submitLabel: 'Create account',
    loadingLabel: 'Creating account...'
  }
} as const;
