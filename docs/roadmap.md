# Project Roadmap

## Phase 1: Foundation (Done)
- [x] Multi-module Maven setup.
- [x] Common Lib (Exception handling, DTO wrapper).
- [x] Identity Service: Auth flow, JWT, Refresh Token.
- [x] Database Migration (Flyway).

## Phase 2: Core Services (Done)
- [x] **Patient Service**: Quản lý thông tin chi tiết bệnh nhân.
- [x] **Doctor Service**: Quản lý hồ sơ bác sĩ, chuyên khoa và nền tảng lịch làm việc.
- [x] **Appointment Service**: Quy trình đặt lịch, xác nhận, hủy, hoàn tất và kiểm tra lịch bác sĩ.

## Phase 3: Operations & Medical (Current)
- [x] **Medical Record Service**: Hồ sơ bệnh án, đơn thuốc và kiểm tra appointment đã hoàn tất.
- [x] **Billing Service**: Hóa đơn, kiểm tra appointment đã hoàn tất và trạng thái thanh toán nền tảng.
- [x] **Notification Service**: Nền tảng lưu thông báo và trạng thái gửi.
- [ ] **Notification Provider Integration**: Tích hợp RabbitMQ và provider mail/SMS thật.

## Phase 4: Infra & Frontend
- [ ] **API Gateway**: Routing và Aggregation.
- [x] **Dockerization**: Docker Compose nền tảng cho backend và PostgreSQL.
- [ ] **Frontend (React)**: Xây dựng Dashboard cho Admin/Doctor và Portal cho Patient.
- [x] **Monitoring**: Tích hợp Actuator, Prometheus và Grafana cho môi trường Docker Compose local.
