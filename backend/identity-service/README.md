# identity-service

Authentication, Account, IAM và Audit. API Gateway nằm riêng tại `backend/api-gateway`, không chạy trong Identity.

Một JAR triển khai, một JVM và một HTTP listener. Các module trong `modules/` là thư viện nghiệp vụ cùng chạy trong core; giữ context, quyền database và transaction riêng. Không chạy từng module như service độc lập.

Build toàn hệ thống: `pwsh -File scripts/build-main.ps1`. Chạy: `pwsh -File scripts/start.ps1` từ root. Xem [kiến trúc](../../docs/ARCHITECTURE.md) và [vận hành](../../docs/OPERATIONS.md).
