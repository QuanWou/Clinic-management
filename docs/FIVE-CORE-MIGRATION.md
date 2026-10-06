# Gộp 5 core — 05/10/2026

**Cập nhật sau đó:** API Gateway đã được tách khỏi Identity thành `backend/api-gateway`, cổng 8090. Hệ thống hiện chạy 5 core + 1 gateway (6 JVM backend). Các số liệu 5 PID và gateway nằm trong Identity bên dưới là kết quả tại thời điểm gộp, không phải topology mới nhất; xem `ARCHITECTURE.md`.

Theo cấu trúc người dùng chốt: Doctor; Patient + Medical Record; Identity + Gateway + Authentication + Account; Appointment + Booking; Billing + Payment + Notification.

Các module phụ được gộp theo [kiến trúc](ARCHITECTURE.md). Đây là gộp triển khai thật: mỗi core có executable JAR, JVM và cổng riêng. Các module giữ Spring context, pool database và lời gọi HTTP nội bộ để bảo toàn quyền hiện hành. Chưa đơn giản hóa thành một persistence context hoặc thay toàn bộ HTTP cùng-core bằng lời gọi hàm.

## Đã kiểm tra

- Backend package và Maven test reactor thành công; các test yêu cầu database sandbox ngoài vẫn được skip khi chưa cấu hình.
- Ba test mới của core-runtime đạt: hai context chạy chung một listener; gateway chỉ dùng đích cố định; giữ phản hồi từ chối của module đích.
- Frontend build thành công.
- 5 PID Java, mỗi PID đúng một cổng: Identity 8093, Doctor 8094, Patient 8098, Appointment 8099, Billing 8103. Health tổng hợp đều UP.
- Hai kiểm tra trình duyệt tiếp nhận và thu phí đạt ở 320/768/1024/1440 px, không ghi nghiệp vụ.
- Kiểm tra API qua gateway đạt: đăng nhập, hồ sơ bệnh nhân, thông báo, tra cứu bác sĩ/dịch vụ, danh sách khám và đọc chỉ định. Người chưa đăng nhập/bệnh nhân bị từ chối danh sách khám của bác sĩ.
- 67 file SQL migration (bao gồm Auth) khớp từng byte với bản trước khi gộp.
- Dữ liệu hiện có: 571 hồ sơ, 202 tài khoản, 7 phiếu thu, 6 thanh toán, không đổi so với trước khi gộp.

## Giới hạn

Chưa thực hiện giao dịch khám/thu tiền thật để kiểm thử. Chưa chạy lại toàn bộ sandbox E2E và Docker build. Một số script sandbox lịch sử còn đường dẫn cũ; xem `scripts/README.md`. Kiến trúc local bind loopback; triển khai production cần cấu hình riêng, không công bố trực tiếp các cổng nội bộ.

Bản source/config trước khi gộp: `.archive/before-five-core-20261005`. Chứa bí mật, không commit; có thể dùng để khôi phục sau khi dừng runtime. Database không reset.
