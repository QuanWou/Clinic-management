# Public — website giới thiệu một phòng khám (2026-10-02)

## Quyết định sản phẩm

Product Owner chọn Public cho bệnh nhân, Workspace riêng cho phòng khám và Platform riêng. Public chỉ có một phòng khám, không tìm/chọn cơ sở. Product Owner cho phép tự đặt tên; bản local dùng **Phòng khám An Nhiên**. Quyết định này thay baseline marketplace trong sitemap Phase 04, không tự chấp nhận A1–A6 hay production.

## Giao diện và hành vi đã triển khai

- `/public` và `/` là homepage giới thiệu: hero, giới thiệu phòng khám, dịch vụ với giá công khai, bác sĩ, hướng dẫn đặt lịch, địa chỉ/giờ hoạt động, FAQ và CTA. Hồ sơ/lịch sử bệnh nhân không xuất hiện trên homepage.
- `/public/booking` giữ booking API thật, TTL, idempotency, phục hồi giữ giờ, giá snapshot và confirm không cọc. Thẻ dịch vụ/bác sĩ mở booking và chọn sẵn ID nguồn. Một địa điểm chọn tự động; backend vẫn nhận `branch_id`.
- `/public/account` chứa hồ sơ, lịch đã đặt tự tải khi nguồn/phiên sẵn sàng, đổi/hủy, thông báo, lịch sử vận hành/biên nhận và tái khám. Chọn tái khám phải thuộc clinic của website; không chuyển ngầm sang tenant khác. Phục hồi giữ giờ từ account mở booking để tiếp tục xác nhận.
- Đăng nhập/đăng ký giữ trang đích booking/account và tên clinic nguồn. Chuyển trang giữ phiên hiện có. Điều hướng section cuộn đến mục và chuyển trang đặt focus vào main.
- Clinic lấy từ public source đã công bố của Clinic. Launcher truyền `VITE_PUBLIC_CLINIC_ID`; phiên web local đang chạy đã được khởi động lại với ID này. Khi chưa cấu hình ID, chỉ nguồn có đúng một clinic công bố được chấp nhận. Nguồn 0/nhiều clinic hoặc configured ID không hợp lệ hiển thị recovery, không chọn clinic khác.
- Dịch vụ/bác sĩ lấy projection công khai thuộc clinic. Nguồn lỗi có thông báo/tải lại; không bịa card hoặc giá. Không đưa license, Owner contact hay tài liệu chuyên môn riêng tư lên homepage.

## Tham khảo thiết kế

Đã xem trực tiếp homepage [CarePlus](https://careplusvn.com/vi/), [Victoria Healthcare](https://www.victoriavn.com/en/) và [Family Medical Practice](https://www.vietnammedicalpractice.com/?lang=en). Tham khảo cấu trúc hero/CTA, giới thiệu, nhóm dịch vụ/bác sĩ và hướng dẫn đến khám. Giữ hướng xanh/trắng, radius nhẹ và Lucide của S0-06; layout/copy viết riêng.

Hình clinic là SVG có nhãn “Minh họa”; doctor là avatar biểu tượng. Không sao chép ảnh/logo hoặc bịa bằng cấp, thành tích, đánh giá, hotline. Tên bác sĩ, dịch vụ, địa chỉ đang chạy local vẫn là dữ liệu mẫu; cần dữ liệu/ảnh thực được phép sử dụng trước khi phát hành thật.

## Kiểm chứng sau thay đổi cuối cùng

- TypeScript + Vite production build: PASS.
- Vitest: 19 files / 80 tests PASS (`--maxWorkers=1`). Bổ sung resolver một clinic, configured ID, nguồn không duy nhất và không fallback tenant. Booking giữ coverage TTL, conflict, giá đóng băng và retry cùng key.
- Playwright fixture browser: 22 scenarios PASS (`--workers=2`). Homepage tại 1366/1024/375 px; không search/PHI form, thẻ prefill, section navigation, account riêng, recovery nguồn mơ hồ. Hồi quy booking reload, tái khám, lịch sử unpublished, quyền nguồn và staff workflows vẫn PASS.
- Live demo: 13 backend health UP; 8 password login/canonical IAM scope PASS; 8 vai trò thực trong Edge 1366×768 PASS, mỗi vai trò một password login. Homepage nguồn thật tại 1366/1024/375 px PASS, không tràn ngang; service/doctor prefill và account ↔ booking giữ phiên PASS; availability ngày kế tiếp 24 slot.
- Screenshots homepage laptop/mobile được xem trực tiếp. Runtime verifier không tạo booking, thu tiền hay revoke tài khoản. Chỉ tên/description của clinic demo được cập nhật qua Owner/Platform API với lý do `DEMO ONLY`; không reset DB hay bỏ qua các gate API.

Evidence đã chốt ở `public-site-verification/verification.json`, `local-demo-runtime.json` và ảnh cùng thư mục. PostgreSQL, 13 backend và web tiếp tục chạy loopback tại `http://127.0.0.1:4176/public`. Hướng dẫn ở `v2/LOCAL_DEMO.md`.

## Giới hạn

Đây là hoàn thiện Public theo chỉ đạo mới và kiểm chứng hồi quy; không kết luận toàn bộ sản phẩm đã được Product Owner chấp nhận. Ký/phát hành hồ sơ và thanh toán online tiếp tục DISABLED. Accessibility certification, dữ liệu/ảnh y tế thực và acceptance/cutover production chưa được chốt. Không thay V1, không commit/merge/push.
