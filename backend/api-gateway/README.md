# API Gateway

Ứng dụng Spring Boot độc lập, mặc định loopback cổng 8090. Không phụ thuộc Identity JAR, datasource hoặc bí mật ký JWT.

Frontend → Gateway `/s1/<module>/api/...` → một trong 5 core. Gateway chuyển tiếp token, Idempotency-Key và phản hồi của module; không tự cấp quyền. Module đích vẫn xác thực người gọi và scope.

Launcher `scripts/start.ps1` cung cấp `GATEWAY_PORT` và `GATEWAY_ROUTES` (JSON mapping tới địa chỉ module loopback cố định). Có thể đặt `ports.gateway` trong cấu hình riêng; mặc định 8090. Health `/actuator/health` phản ánh gateway, không chứng minh các core đều sẵn sàng; launcher kiểm tra riêng từng core.

Chạy kiểm thử: `mvn -f backend/api-gateway/pom.xml test`. Không thêm database hoặc seed khi tách gateway. Rate limiting, TLS và cấu hình CORS cho deployment khác origin chưa được triển khai; frontend local dùng proxy cùng origin.

Đã xác minh sau khi tách: clean build backend/frontend; 3 test gateway; test runtime dùng chung listener; kiểm tra API qua gateway (bao gồm từ chối truy cập sai quyền); kiểm tra trình duyệt thu phí. Gateway và 5 core đều báo UP; Identity không còn định tuyến `/s1/*`.
