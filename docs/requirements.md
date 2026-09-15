# Product Requirements Document (PRD)

## 1. Overview
Hệ thống quản lý phòng khám đa khoa, hỗ trợ từ khâu đăng ký khám, khám bệnh, kê đơn đến thanh toán.

## 2. Actors & Use Cases
### 2.1. Patient (Bệnh nhân)
- Đăng ký/Đăng nhập.
- Quản lý hồ sơ cá nhân.
- Đặt lịch khám (theo chuyên khoa, bác sĩ, khung giờ).
- Xem lịch sử khám, đơn thuốc và kết quả xét nghiệm.
- Nhận thông báo (lịch hẹn, nhắc uống thuốc).

### 2.2. Doctor (Bác sĩ)
- Xem danh sách bệnh nhân chờ khám trong ngày.
- Quản lý ca làm việc.
- Thực hiện khám bệnh: Ghi nhận triệu chứng, chẩn đoán, kê đơn thuốc, chỉ định xét nghiệm.
- Xem bệnh án điện tử của bệnh nhân.

### 2.3. Receptionist (Lễ tân)
- Tiếp đón bệnh nhân, kiểm tra thông tin đăng ký.
- Sắp xếp số thứ tự khám.
- Hỗ trợ bệnh nhân đặt lịch trực tiếp.

### 2.4. Admin (Quản trị viên)
- Quản lý danh mục (Chuyên khoa, Dịch vụ, Thuốc).
- Quản lý tài khoản (Bác sĩ, Lễ tân, Bệnh nhân).
- Xem báo cáo thống kê doanh thu, lưu lượng bệnh nhân.

## 3. Non-Functional Requirements
- **Performance**: Phản hồi API < 200ms.
- **Security**: Mã hóa mật khẩu (BCrypt), Auth dùng JWT, phân quyền chi tiết.
- **Scalability**: Kiến trúc Microservices cho phép scale độc lập từng service.
- **Reliability**: Đảm bảo dữ liệu bệnh án không bị mất mát.
