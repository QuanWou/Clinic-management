# Chuyển cấu trúc ngày 05/10/2026

Mã đang vận hành được gom về `backend`, `frontend`, `scripts`, `infra` và `docs`. Java package sử dụng `com.clinic`; API ứng dụng sử dụng `/api` và biến môi trường không có nhãn phiên bản dự án.

Dịch vụ mật khẩu trước đây nằm chung với mã cũ được giữ lại thành `backend/auth-service`. Dịch vụ phân quyền nằm ở `backend/identity-service`. Các service vẫn chạy độc lập.

## Tương thích dữ liệu

Không xóa database, tài khoản hoặc dữ liệu nghiệp vụ. SQL migration đã áp dụng được giữ nguyên từng byte để không thay đổi checksum Flyway. Các schema, database role, bảng lịch sử migration và khóa retry trong trình duyệt có tên cũ được giữ vì là định danh dữ liệu, không phải nhánh mã thứ hai. Đổi các tên đó cần một migration dữ liệu riêng.

## Bản lưu và phục hồi

`.archive/layout-before-20261005/` chứa mã cũ, bản chụp source đang chạy trước khi đổi, tài liệu lịch sử và bản sao Git index. `.runtime/main/` giữ cấu hình riêng và các database backup hiện có.

Bản lưu chỉ nằm trên máy, không được commit; hãy sao lưu riêng trước khi chuyển máy. Không ghi đè Git index hoặc khôi phục cả cây source lên thay đổi mới một cách tự động. Muốn quay lại, dừng ứng dụng và đối chiếu từng thư mục với bản lưu; database không cần reset.

## Kết quả xác minh

- Clean build toàn bộ backend và frontend thành công.
- Maven reactor: 263 test cases, 0 failures, 0 errors; 130 kiểm thử cần hạ tầng ngoài được skip (133 chạy đạt).
- Ba bộ kiểm thử frontend billing, application-session và reception: 39/39 đạt. Không tuyên bố toàn bộ bộ kiểm thử frontend đã đạt; các bài lễ tân cũ tìm nút tải thủ công cần cập nhật riêng.
- 63 file migration của các service đang dùng khớp từng byte với bản sao trước khi chuyển.
- 13 service báo health UP. Hai kiểm tra trình duyệt tiếp nhận và thu phí đạt ở 320, 768, 1024, 1440 px; không có ghi nghiệp vụ.
- Trước/sau khởi động: 571 hồ sơ bệnh nhân, 202 tài khoản, 7 phiếu thu, 6 khoản thanh toán; số lượng không đổi.
- Container PostgreSQL hiện có được khởi động lại; không tạo database hoặc volume mới. Dockerfile và Compose phát triển mới chưa được kiểm thử bằng container build.
