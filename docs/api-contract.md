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
- `GET /api/doctors`: Danh sách hồ sơ bác sĩ; hỗ trợ lọc bằng query `specialtyId`.
- `GET /api/doctors/{doctorId}`: Xem hồ sơ bác sĩ theo ID.
- `GET /api/doctors/profile`: Xem hồ sơ bác sĩ hiện tại.
- `PUT /api/doctors/profile`: Cập nhật hồ sơ bác sĩ hiện tại.
- `GET /api/doctors/{doctorId}/schedules`: Xem lịch làm việc tuần của bác sĩ.
- `GET /api/doctors/profile/schedules`: Bác sĩ xem lịch làm việc của chính mình.
- `PUT /api/doctors/profile/schedules`: Bác sĩ thay thế toàn bộ lịch làm việc tuần của chính mình; ngày dùng chuẩn ISO từ `1` (thứ Hai) đến `7` (Chủ nhật), các khoảng giờ cùng ngày không được chồng nhau.
- `GET /api/doctors/{doctorId}/availability`: Kiểm tra một khoảng giờ có nằm trong lịch làm việc của bác sĩ.
- `GET /api/specialties`: Danh sách chuyên khoa.

### Appointment Service
- `POST /api/appointments`: Đặt lịch khám.
- `GET /api/appointments/my`: Xem danh sách lịch hẹn của tôi.
- `GET /api/appointments/{id}`: Xem chi tiết lịch hẹn theo quyền truy cập.
- `PATCH /api/appointments/{id}/cancel`: Hủy lịch hẹn.
- `PATCH /api/appointments/{id}/confirm`: Xác nhận lịch hẹn.
- `PATCH /api/appointments/{id}/complete`: Hoàn tất lịch hẹn.

#### Appointment authorization and booking integrity (Security & Booking Integrity P0)

All appointment endpoints require an access JWT with a `token_type=access` claim and canonical roles (`ROLE_PATIENT`, `ROLE_DOCTOR`, `ROLE_RECEPTIONIST`, `ROLE_ADMIN`). A refresh JWT (`token_type=refresh`) cannot authenticate these APIs. The appointment service checks object ownership even when the user is authenticated.

| Endpoint | Allowed caller | Object-level rule |
| --- | --- | --- |
| `POST /api/appointments` | Patient | Patient profile `userId` must equal JWT subject; doctor must have a matching work schedule; database rejects all overlapping non-cancelled bookings. |
| `GET /api/appointments/my` | Patient (profile endpoint authorization) | Only records for the authenticated patient's profile. |
| `GET /api/appointments/{id}` | Patient / Doctor / Receptionist / Admin | Patient owns booking; doctor must be the assigned doctor (`doctor.id = appointment.doctorId` and `doctor.userId = JWT subject`); receptionist/admin may view. |
| `PATCH /api/appointments/{id}/cancel` | Patient / Receptionist / Admin | Patient owns booking; receptionist/admin may cancel bookings. Only PENDING/CONFIRMED may be cancelled. |
| `PATCH /api/appointments/{id}/confirm` | Assigned doctor / Receptionist / Admin | Only PENDING can become CONFIRMED. |
| `PATCH /api/appointments/{id}/complete` | Assigned doctor / Admin | Only CONFIRMED can become COMPLETED; receptionist cannot complete. |
| `GET /api/appointments/doctors/{doctorId}/availability?date=YYYY-MM-DD&startTime=HH:mm&endTime=HH:mm` | Authenticated | Returns `data: { doctorId, date, startTime, endTime, available }`. Checks weekly doctor schedule **and** existing non-cancelled appointments. This is a read-time snapshot, not a reservation; `POST` remains authoritative. |

Invalid date/time values yield HTTP 400 `VALIDATION_ERROR`; forbidden access yields 403 `FORBIDDEN`; overlapping slots or invalid state transitions yield 409 `CONFLICT`. Adjacent slots are valid. CANCELLED bookings release their slot; COMPLETED bookings retain their historical interval. A booking must start in the future according to the appointment service's local clock.

PostgreSQL migration `appointment/V2__prevent_overlapping_appointments.sql` requires the `btree_gist` extension and adds a partial GiST exclusion constraint; a pre-existing invalid or overlapping active booking must be resolved before applying the migration. Do not attempt to work around conflicts by disabling the constraint. `GET /api/doctors/{doctorId}/availability` remains **weekly working-schedule availability only** and must not be interpreted as a free booking slot.

Identity issues access JWTs with `token_type=access`, refresh JWTs with `token_type=refresh` and distinct JWT IDs. Refresh rotation locks the stored token row before revocation; an already revoked, mismatched-user, expired or wrong-purpose token is rejected. Existing tokens without a `token_type` claim will need to be reissued on deployment.

`POST /api/auth/logout` also requires a valid refresh-purpose JWT matching the stored token's user; an access JWT cannot be substituted even if a row for it exists. Logout revokes the refresh token, **not** already issued access tokens. The identity `/api/users/me` endpoint is the authoritative source of current account status and roles: its own filter reads both from the database and rejects locked/inactive accounts.

**Immediate account/role changes in appointment-service:** each authenticated appointment request now calls identity's `GET /api/users/me` with the user's bearer access token, verifies the returned subject is identical, account is `ACTIVE`, and returned roles exactly match the signed token roles. Mismatch, HTTP 401/403, invalid response or identity outage fail closed (no authentication, HTTP 401 on protected endpoints). This deliberately requires a new login after role changes and adds a synchronous identity dependency (~1.5-second connect/read timeouts). Configure `SERVICES_IDENTITY_URL=http://identity-service:8083` (default) in Docker, or `SERVICES_IDENTITY_URL=http://localhost:8083` when running appointment-service on the host. Do not enable a cache for positive authorization results without explicit revocation invalidation.

**Unresolved cross-service security:** patient, medical-record and billing bearer filters still accept any signature-valid JWT and use potentially stale role claims; notification also requires a separate review. They may continue to authorize an old access token until its current 60-minute expiration, and some may accept a refresh JWT as a bearer token. Gateway routing does not currently impose central authorization and container services may be accessed directly. Roll out the same fail-closed identity validation or a shared token-introspection/revocation facility to each service with its task owner; test all service-to-service calls and failure behavior before changing the global token contract, shortening expiry or claiming immediate system-wide revocation.

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
