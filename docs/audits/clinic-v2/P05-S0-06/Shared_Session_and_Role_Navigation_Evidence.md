# Shared session và điều hướng theo vai trò — 2026-10-02

## Quyết định sản phẩm

Product Owner chọn ba trải nghiệm riêng: Public cho bệnh nhân, Clinic Workspace cho phòng khám, Platform Console cho nền tảng. Workspace quản lý một phòng khám theo A0; branch là phạm vi vận hành được cấp quyền. Quyết định này không tự chấp nhận A1–A6 hoặc phát hành production.

## Thay đổi đã thực hiện

- Trang đăng nhập chung, ba khu vực rõ ràng, giao diện xanh/trắng theo `S0-06_Design_Direction.md`. Đăng ký tài khoản chỉ ở khu vực bệnh nhân. Các panel lấy phiên chung rồi đọc nguồn được server cấp quyền; không hiện form đăng nhập lại từng panel.
- `/workspace` tự mở Tổng quan cho Owner/Manager, Tiếp nhận cho Receptionist, Danh sách khám cho Doctor, Lab cho Lab và Thu phí cho Cashier. Menu chỉ hiện màn được cấp quyền. Mỗi lần đổi màn đọc lại quyền IAM; service nguồn vẫn xác minh JWT/membership/branch.
- Link chỉ định một clinic không được chuyển ngầm sang clinic khác. Deep link trái vai trò hiển thị từ chối trước khi tải dữ liệu nghiệp vụ. Platform yêu cầu quyền operator; quyền này không cấp quyền bệnh án.
- Chuyển màn hoặc giữa các khu vực bằng liên kết ứng dụng giữ phiên trong bộ nhớ. JWT/mật khẩu không ghi vào localStorage/sessionStorage. Tải lại trang hoặc mở tab khác cần đăng nhập lại; chưa có refresh token/cookie phiên bền vững.
- Public giữ cơ sở và kết quả tìm kiếm khi đi qua đăng nhập. Đăng xuất/đổi tài khoản xóa state hồ sơ/lịch sử bằng remount; phản hồi 401 của token cũ không làm mất phiên mới. 401 của token hiện tại hoặc thu hồi phiên xóa phiên chung.
- Địa điểm duy nhất đang được cấp quyền được chọn tự động. Khi có bản nháp/thao tác chưa xác định kết quả, menu/đăng xuất/liên kết khu vực bị khóa; Back trong lịch sử điều hướng ứng dụng giữ màn và nội dung. Thoát/tải lại trang vẫn được bảo vệ bằng beforeunload.
- Bổ sung focus cho trang đăng nhập, nhãn hiện/ẩn mật khẩu, kiểm tra bàn phím và short laptop. Sửa card Public chỉ có nội dung chữ bị bó vào cột ảnh trống; bổ sung khoảng cách giữa các panel bệnh nhân.

## Kiểm chứng

- TypeScript + Vite production build: PASS.
- Vitest: 18 files / 76 tests PASS, gồm 11 bài kiểm tra application session/role/deep-link/revocation.
- Playwright: 20 scenario PASS sau thay đổi session/navigation. Bao gồm booking giữ TTL/idempotency, reload phục hồi kết quả, tiếp nhận, bác sĩ/lab, thu tại chỗ, giá nguồn và Platform review. Ba bài laptop giữ nguyên bản nháp khi Back và retry đúng request sau mất phản hồi. Sau sửa CSS Public cuối cùng, chạy lại cả 4 scenario bị ảnh hưởng: PASS.
- Local demo thật: 13 backend health UP, 8 password login và canonical IAM scope PASS, 8 vai trò trong Edge 1366×768 PASS. Mỗi vai trò có đúng 1 password login; 6 vai trò staff mở Cài đặt rồi browser Back vẫn đọc được màn nguồn. Search public và 24 slot ngày kế tiếp PASS. Không tạo appointment, thu tiền hoặc revoke tài khoản trong live verifier.
- Screenshots được xem trực tiếp; dữ liệu là demo tổng hợp. Backend và PostgreSQL tiếp tục chạy loopback để Product Owner kiểm tra.

Evidence: `shared-session-verification/verification.json` (hash source/checks), `local-demo-runtime.json` (runtime không chứa credentials) và screenshots cùng thư mục. Hướng dẫn: `v2/LOCAL_DEMO.md`.

## Giới hạn chấp nhận

Đây là kiểm chứng thay đổi đăng nhập/điều hướng và hồi quy UI. Không kết luận toàn bộ sản phẩm đã hoàn thành/đẹp theo chấp nhận của Product Owner. Còn đánh giá nghiệp vụ end-to-end thực tế, staff mutations trên browser + PostgreSQL, accessibility và cutover/load/production acceptance. Ký/phát hành hồ sơ và thanh toán online tiếp tục DISABLED theo quyết định người dùng; các gate chuyên môn/chính sách tiền chưa được tự đóng. Không thay V1, không reset database, không commit/merge/push.

## Cập nhật Public sau evidence này

Homepage marketplace/tìm kiếm đã được thay bằng website giới thiệu một phòng khám theo chỉ đạo Product Owner ngày 2026-10-02. Xem `Public_Clinic_Website_Evidence.md`; cơ chế phiên/vai trò và ranh giới quyền trong tài liệu này vẫn áp dụng.
