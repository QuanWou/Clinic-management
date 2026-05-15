# API Contract

## 1. Standards
- **Format**: JSON.
- **Current Root Path**: `/api`.
- **Target Versioned Root Path**: `/api/v1`.
- **Versioning Rule**: Không tự ý thêm `/api/v1` cho một service đơn lẻ. Nếu migrate API versioning, phải cập nhật đồng bộ Controller, API Gateway, tài liệu và test.
- **Response Wrapper**:
  ```json
  {
    "success": true,
    "message": "Success",
    "data": { ... },
    "timestamp": "2026-05-09T00:00:00Z"
  }
  ```

## 2. Key Endpoints

### Identity Service
- `POST /api/auth/login`: Trả về JWT & Refresh Token.
- `POST /api/auth/register`: Đăng ký tài khoản.
- `POST /api/auth/refresh`: Làm mới access token.
- `POST /api/auth/logout`: Thu hồi refresh token.
- `GET /api/users/me`: Thông tin người dùng hiện tại.

### Patient Service
- `GET /api/patients/profile`: Xem thông tin bệnh nhân.
- `PUT /api/patients/profile`: Cập nhật thông tin.

### Doctor Service
- `GET /api/doctors/profile`: Xem hồ sơ bác sĩ hiện tại.
- `PUT /api/doctors/profile`: Cập nhật hồ sơ bác sĩ hiện tại.

### Appointment Service
- `POST /api/appointments`: Đặt lịch khám.
- `GET /api/appointments/my`: Xem danh sách lịch hẹn của tôi.
- `GET /api/appointments/{id}`: Xem chi tiết lịch hẹn theo quyền truy cập.
- `PATCH /api/appointments/{id}/cancel`: Hủy lịch hẹn.
- `PATCH /api/appointments/{id}/confirm`: Xác nhận lịch hẹn.
- `PATCH /api/appointments/{id}/complete`: Hoàn tất lịch hẹn.

### Medical Record Service
- `POST /api/medical-records`: Tạo hồ sơ bệnh án cho appointment đã hoàn tất.
- `GET /api/medical-records/my`: Bệnh nhân xem hồ sơ bệnh án của mình.
- `GET /api/medical-records/patients/{patientId}`: Bác sĩ/lễ tân/admin xem hồ sơ theo bệnh nhân.
- `GET /api/medical-records/{id}`: Xem chi tiết hồ sơ bệnh án theo quyền truy cập.

### Billing Service
- `POST /api/invoices`: Tạo hóa đơn cho appointment đã hoàn tất.
- `GET /api/invoices/my`: Bệnh nhân xem hóa đơn của mình.
- `GET /api/invoices/patients/{patientId}`: Lễ tân/admin xem hóa đơn theo bệnh nhân.
- `GET /api/invoices/appointments/{appointmentId}`: Xem hóa đơn theo appointment.
- `GET /api/invoices/{id}`: Xem chi tiết hóa đơn theo quyền truy cập.
- `PATCH /api/invoices/{id}/pay`: Đánh dấu hóa đơn đã thanh toán.

### Notification Service
- `POST /api/notifications`: Tạo và gửi thông báo.
- `GET /api/notifications`: Xem danh sách thông báo.
- `GET /api/notifications/{id}`: Xem chi tiết thông báo.

## 3. Error Codes
- `VALIDATION_ERROR`: Lỗi dữ liệu đầu vào (400).
- `UNAUTHORIZED`: Token không hợp lệ/hết hạn (401).
- `FORBIDDEN`: Không có quyền truy cập (403).
- `RESOURCE_NOT_FOUND`: Không tìm thấy thực thể (404).
- `CONFLICT`: Trùng lặp hoặc xung đột trạng thái nghiệp vụ (409).
- `INTERNAL_SERVER_ERROR`: Lỗi hệ thống (500).
