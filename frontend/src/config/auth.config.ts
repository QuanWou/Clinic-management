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
    eyebrow: 'Đăng ký tài khoản',
    title: 'Bắt đầu quản lý lịch khám',
    subtitle: 'Tạo tài khoản rồi hoàn thiện hồ sơ bệnh nhân để sử dụng không gian phòng khám.',
    submitLabel: 'Tạo tài khoản',
    loadingLabel: 'Đang tạo tài khoản...'
  }
} as const;
