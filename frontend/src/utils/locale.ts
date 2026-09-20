// Presentation-only labels. API role and status codes remain unchanged.
const statusLabels: Record<string, string> = {
  PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy', PAID: 'Đã thanh toán', UNPAID: 'Chưa thanh toán',
  WAITING: 'Đang chờ', CALLED: 'Đã gọi', IN_PROGRESS: 'Đang khám', SKIPPED: 'Đã bỏ qua',
  ACTIVE: 'Đang hoạt động', INACTIVE: 'Ngừng hoạt động'
};

export function statusLabel(status: string): string {
  return statusLabels[status.toUpperCase()] ?? status;
}

export function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'Quản trị viên', DOCTOR: 'Bác sĩ', PATIENT: 'Bệnh nhân',
    RECEPTIONIST: 'Lễ tân', USER: 'Người dùng'
  };
  return labels[role.replace(/^ROLE_/, '').toUpperCase()] ?? role;
}