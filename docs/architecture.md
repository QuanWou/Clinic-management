# Kiến trúc 5 service core + API Gateway

| Service | Module nghiệp vụ | Cổng local |
|---|---|---|
| api-gateway | Định tuyến API, chuyển tiếp token và mã chống lặp | 8090 |
| identity-service | Authentication, Account, IAM, Audit | 8093 |
| doctor-service | Doctor, Specialty, Schedule, Clinic, Search | 8094 |
| patient-service | Patient, Medical Record, chỉ định/kết quả | 8098 |
| appointment-service | Appointment, Booking, tiếp nhận, hàng đợi/lượt khám | 8099 |
| billing-service | Billing, Payment, Notification, Catalog/bảng giá | 8103 |

Mỗi core có một JAR triển khai, một tiến trình Java và một HTTP listener. Source nghiệp vụ nằm trong `<core>-service/modules/`; các module là thư viện, không triển khai thành service độc lập. `common-lib` và `core-runtime` là thư viện dùng chung, không có tiến trình/cổng riêng.

Đây là gộp ở cấp triển khai: các module vẫn có Spring context, datasource và transaction boundary riêng, nhằm giữ nguyên phân quyền và dữ liệu. Lời gọi nội bộ hiện vẫn qua HTTP loopback; chưa chuyển toàn bộ thành gọi hàm trực tiếp. Không phải một Spring context duy nhất cho mỗi core.

Frontend → Vite proxy `/s1` → API Gateway độc lập → core sở hữu module. Gateway có JAR/JVM riêng, không dùng database hoặc bí mật JWT. Gateway chỉ định tuyến tới danh sách địa chỉ loopback cố định, chuyển tiếp token và Idempotency-Key, không tự cấp quyền. Module đích vẫn xác thực và kiểm tra scope. Các core chỉ bind loopback trong launcher local; đây chưa phải cấu hình production.

Module phục vụ tại `/modules/<module>/api/...`. Gateway giữ alias `/s1/<module>/api/...` để frontend không cần đổi luồng. Health tổng hợp của mỗi core: `/actuator/health`.

Database, schema, quyền runtime và checksum migration giữ nguyên. Migration được phân tách resource theo module để không trùng version khi đóng chung JAR. Xem [vận hành](OPERATIONS.md).
