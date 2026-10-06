# Clinic frontend

React, TypeScript và Vite. Giao diện tiếng Việt cho bệnh nhân và workspace của quản trị, bác sĩ, lễ tân kiêm thu ngân.

- `/public`: thông tin phòng khám và đặt lịch.
- `/public/account`: hồ sơ, lịch hẹn và lịch sử bệnh nhân.
- `/login`: đăng nhập chung, điều hướng theo quyền.
- `/workspace`: không gian làm việc theo vai trò.

Khởi động toàn bộ ứng dụng bằng `scripts/start.ps1` từ thư mục gốc. Script cấp Vite proxy và mã phòng khám từ cấu hình riêng. Xem [vận hành](../docs/OPERATIONS.md).

```powershell
npm ci
npm run build
npm test
```

API gọi qua proxy `/s1/<service>/api/...`. Backend kiểm tra lại quyền và phạm vi dữ liệu. JWT được giữ trong bộ nhớ, không lưu mật khẩu hoặc token vào browser storage. Khóa retry cũ được giữ tương thích để tránh lặp giao dịch chưa xác định kết quả.
