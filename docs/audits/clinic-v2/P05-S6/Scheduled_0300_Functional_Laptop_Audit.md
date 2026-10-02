# Kiểm tra chức năng, database và UI/UX laptop — 02/10/2026

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`; branch `local-coder/clinic-management-v2-6820c6b7`.

Yêu cầu chạy một lần lúc **03:00 ngày 02/10/2026**, Asia/Bangkok (UTC+7), hoặc chạy ngay nếu đã qua giờ. Đồng hồ đầu lượt ghi `2026-10-01 21:17:40 UTC`, tức **04:17:40 ngày 02/10/2026**. Đã xử lý ngay trong chat này; không tạo automation lặp hay hẹn lại sang ngày khác.

## Kết luận kiểm tra

**Chưa hoàn thành toàn bộ để nghiệm thu/phát hành production.** Luồng không cọc/chưa ký đã có source, database và bằng chứng vận hành. [Phạm vi PO](../Delivery_Scope_No_Deposit_Unsigned.md) vẫn giữ ký/phát hành và thanh toán online chưa bật. A0 ACCEPTED không tự chuyển A1–A6 thành ACCEPTED.

| Câu hỏi | Kết quả và giới hạn |
|---|---|
| Chức năng đã đủ chưa? | Đã triển khai hành trình không cọc: đăng ký/profile/tìm kiếm/booking → reception/queue → unsigned Medical/order/result/review/completion → onsite bill/receipt/shift → own Portal/follow-up/notification. Full FR/AT gồm prescription/sign/release, online/deposit/refund/guardian và cutover chưa hoàn tất. |
| Có database chưa? | Có PostgreSQL, migration/constraints/runtime RLS/outbox/inbox. Fresh sandbox và 13-DB restore, 5 restored applications đã có bằng chứng. Đây là dữ liệu kiểm thử tổng hợp; không phải database production được triển khai và đang chạy. |
| UI/UX đẹp chưa? | Đã xem ảnh chụp trình duyệt: xanh/trắng nhất quán, sidebar/context rõ, control và thẻ gọn. Đã sửa các vấn đề cụ thể phía dưới. Đây là đánh giá trực quan và kiểm thử thao tác; chưa có nghiên cứu usability với người dùng hoặc nghiệm thu thẩm mỹ/chuyên môn. |
| Laptop đã tối ưu chưa? | Đã kiểm tra 1280×800, 1366×768, 1440×900; Doctor hai cột, note hai cột, thanh thao tác gọn, sidebar cuộn, focus và phím Tab/Enter, liên kết tới bước tiếp nhận. Kiểm tra viewport 683×384 tương đương vùng hiển thị zoom 200% không thay thế kiểm tra zoom/DPI/screen reader thực tế. |

## Các lỗi/thiếu đã sửa trong lượt này

1. Doctor worklist bị đẩy dưới hồ sơ dài: chuyển danh sách và case sang hai cột; danh sách tự cuộn và giữ vị trí khi đọc note. Note dùng hai cột trên laptop, một cột khi thu hẹp.
2. Mất draft/pending khi đổi lượt, địa điểm hoặc màn hình: khóa navigation/scope/logout cho Medical/LAB chưa ghi và yêu cầu khám/tiếp nhận/thu phí chưa xác nhận; beforeunload cảnh báo. Nội dung và credentials vẫn ở bộ nhớ, không ghi vào browser storage. Cảnh báo không bảo đảm phục hồi nếu OS/browser bị đóng cưỡng bức.
3. Điều hướng bàn phím: tên nút khi sidebar thu gọn, `aria-current`, trạng thái mở rộng, focus vào main khi chuyển view; focus control được đưa ra khỏi vùng bị topbar che. Dùng skip link có sẵn trong HTML, không thêm link trùng.
4. Màn denied/loading/empty bị tràn khi thu nhỏ: các trạng thái dùng cùng responsive shell; skeleton không ép chiều rộng cố định.
5. Reception phải cuộn qua nhiều bước: lối chuyển nhanh focus tới xác minh, tiếp nhận, hàng đợi và lượt đã gửi; giữ nguyên nội dung/phiên/phạm vi. Thu gọn khoảng cách và xếp các lượt đã gửi thành thẻ theo chiều rộng.
6. Lượt CLOSED không có live ticket bị gắn nhãn pending check-in: dùng trạng thái nguồn, hiển thị “Lượt đã đóng”; chỉ ARRIVAL_PENDING mang nhãn chờ xác nhận.
7. Doctor chỉ xem được 200 lượt: thêm [keyset pagination](../../../../v2/contracts/doctor-worklist-paging.md), index V10, tải tiếp giữ cursor khi lỗi kết nối, dedup và xóa dữ liệu cũ khi bị từ chối quyền. Số đếm ghi rõ số lượt đã tải.

## Bằng chứng kiểm thử

- [65 frontend tests](frontend-audit-unit-final.txt), [build](frontend-audit-build-final.txt), [20 browser fixtures](frontend-audit-browser-final.txt) PASS. [Reception shortcut rerun](reception-shortcuts-browser-final.txt) PASS với fixture đã bổ sung kiểm tra focus. Không cộng lượt chạy lại thành thêm test.
- [28 Encounter PostgreSQL tests](worklist-paging-verification/summary.json) PASS: 225 lượt có cùng timestamp, thứ tự/unique continuation, cursor đã inactive, wrong Doctor/scope/role/limit/revoke. Bộ 12 package hiện có tổng **208 selected backend tests**; các package còn lại giữ provenance của các lượt zero-skip trước, không tuyên bố đã chạy lại cả 208 test.
- [Checkpoint 08](authenticated-checkpoint-08/summary.json) PASS với package mới: actual password login, Public registration/booking, continuous operational API, worklist page ownership/audit, source recovery, clinical deny/revoke, 13-DB restore và 5 restored applications. [Worklist HTTP](authenticated-checkpoint-08/worklist-paging-summary.json) là dataset nhỏ; kiểm chứng 225 lượt thuộc fixture PostgreSQL riêng.
- [Checkpoint 09](authenticated-checkpoint-09/summary.json) sau thay đổi Reception: **PASS**, cùng bộ 208/12 packages; 2 actual Public + 5 actual operational reads, cả năm read kiểm tra ở ba kích thước laptop và 375 px. Restore 13 DB + khởi động 5 restored applications PASS.

Các browser fixtures mô phỏng HTTP; actual Public browser có 2 luồng mutation, actual operational browser có 5 luồng đọc nguồn. Chưa tuyên bố toàn bộ thao tác khám/tiền được thực hiện xuyên suốt bằng browser thật.

Attempt phân trang HTTP đầu thất bại ở truy vấn kiểm chứng audit: `metadata_json` là text, thiếu cast JSONB; đã sửa harness, giữ [attempt FAIL](worklist-http-attempt-01/summary.json), rồi chạy lại PASS. Không đổi policy/quyền để bỏ qua lỗi. Các attempt UI/focus thất bại cũng được giữ trong log; chỉ log cuối PASS làm bằng chứng chốt.

## Phần còn lại

Qualified medical/prescription forms, signature/addendum/release và online merchant/provider/deposit/refund/guardian policies còn OPEN/chưa bật. Cần nghiệm thu chuyên môn, finance/legal/privacy/security/QA; manual accessibility, benchmark/load theo môi trường, gateway/secrets/alerts/retention; authorized V1-copy migration/reconciliation và traffic rollback. LAB/receipt và một số history/billable endpoints vẫn có giới hạn 100, cần chiến lược khối lượng lớn; Doctor và queue/supervisor đã có continuation. Whole-platform authentication-edge audit và full real staff mutation-browser E2E chưa có đủ bằng chứng.

Source uncommitted; không commit/merge/push/deploy/reset production DB. Sandbox kiểm thử được dừng và giữ lại; không thử xóa lại các target từng bị safety review chặn. [Candidate manifest](operational-candidate-manifest.json) ghi SHA256 source/build/migration/evidence của checkpoint cuối.
