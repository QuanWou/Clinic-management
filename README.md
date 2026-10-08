# Clinic Management

Hệ thống quản lý một phòng khám, gồm **5 service core + API Gateway riêng**: Identity, Doctor, Patient (kèm Medical Record), Appointment và Billing (kèm Notification). Java 21 / Spring Boot, React / TypeScript và PostgreSQL.

## Cấu trúc

```text
backend/       Các microservice độc lập và Maven reactor
frontend/      Giao diện bệnh nhân và workspace nhân viên
scripts/       Build, khởi động, dừng và kiểm tra hệ thống
infra/         Công cụ hạ tầng và phục hồi
docs/          Hướng dẫn và hợp đồng API
.runtime/      Cấu hình riêng, trạng thái tiến trình, log (không commit)
.archive/      Bản lưu mã cũ trước khi sắp xếp (không commit)
```

## Chạy ứng dụng hiện tại

Trong IntelliJ, chọn **Clinic - Run All** rồi bấm Run (`Shift+F10`). Xem
[hướng dẫn IntelliJ](docs/INTELLIJ.md) để dừng, build lại và cấu hình SDK.

Yêu cầu: Java 21, Maven, Node.js, PowerShell 7 và PostgreSQL đang chạy.
Cấu hình kết nối và bí mật nằm tại `.runtime/main/config.json`. Không commit hoặc chia sẻ file này.

```powershell
pwsh -NoProfile -File scripts/build-main.ps1
pwsh -NoProfile -File scripts/start.ps1
# Dừng các tiến trình do ứng dụng quản lý, không dừng/xóa database:
pwsh -NoProfile -File scripts/stop.ps1
```

- [Bệnh nhân](http://127.0.0.1:5173/public)
- [Workspace](http://127.0.0.1:5173/workspace)

Cổng web trên máy này là `5173` (đọc từ `.runtime/main/config.json`).

Launcher 5 core không hỗ trợ `-Seed`. Dữ liệu hiện có được giữ nguyên. Các module nằm trong `backend/<core>-service/modules/`; `common-lib` và `core-runtime` chỉ là thư viện, không chạy riêng.

## Kiến trúc và kiểm thử

Xem [kiến trúc](docs/ARCHITECTURE.md), [vận hành](docs/OPERATIONS.md) và [ghi chú chuyển cấu trúc](docs/LAYOUT-MIGRATION.md).

```powershell
mvn -f backend/pom.xml test
npm --prefix frontend run build
npm --prefix frontend test
node scripts/verify-front-desk.mjs
node scripts/verify-cashier-desk.mjs
```

Hai script kiểm tra trình duyệt cuối chỉ đọc dữ liệu và chặn ghi nghiệp vụ. Một số bài kiểm thử tích hợp cần PostgreSQL sandbox riêng; không trỏ kiểm thử tạo dữ liệu vào database vận hành.
