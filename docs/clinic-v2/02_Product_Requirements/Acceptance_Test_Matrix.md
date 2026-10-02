# CMV2 — Acceptance Test Matrix

**Mục đích:** Yêu cầu là testable; QA điền Test Run ID, build, môi trường, evidence, kết quả, người duyệt. Case dưới đây ở cấp business acceptance, không thay thế unit/integration/security tests. Priority P0 phải PASS trước launch.

## A. Các luồng người dùng chuẩn

| ID | Given | When | Then / kỳ vọng | Liên kết |
|---|---|---|---|---|
| AT-001 | Clinic đăng ký thiếu license | Owner nộp review | Không publish; nêu trường thiếu | FR-ORG-01, FR-ORG-02 |
| AT-002 | Clinic hồ sơ đầy đủ | Ops duyệt và publish | Public index hiển thị đúng branch/dịch vụ; audit có actor | FR-ORG-02, FR-ORG-07 |
| AT-003 | Clinic ở trạng thái suspended | Khách chọn đặt lịch mới | Không tạo booking; lịch đã tồn tại không biến mất | FR-ORG-07, FR-OPS-06 |
| AT-004 | Clinic A và B đã cấu hình | Staff A chuyển context sang B khi không có membership | Bị từ chối; không trả dữ liệu B | FR-IAM-02, FR-IAM-03 |
| AT-005 | Doctor làm việc A và B | Manager A sửa lịch A | Lịch B không tự thay đổi | FR-ORG-06, FR-SCH-01 |
| AT-006 | Hai bệnh nhân cùng xem 1 slot capacity=1 | Hai yêu cầu xác nhận đồng thời | Tối đa một confirmed; hold/booking còn lại rejected/expired rõ ràng | FR-SCH-02, BR-05/06 |
| AT-007 | Bệnh nhân giữ slot rồi bỏ trang | TTL hết | Slot trở lại pool; không còn booking pending vĩnh viễn | FR-SCH-02, FR-SCH-04 |
| AT-008 | Người dùng đã trả cọc | Hủy đúng policy | Booking/slot/refund hoặc credit được xử lý nhất quán, thông báo gửi | FR-SCH-03, FR-SCH-04, FR-BIL-06, FR-BIL-08 |
| AT-009 | Lễ tân có patient record phù hợp | Tạo walk-in | Encounter/queue tạo thành công mà không tạo appointment giả | FR-IAM-06, FR-SCH-06 |
| AT-010 | Appointment confirmed | Bệnh nhân check-in 2 lần | Chỉ một check-in/active queue ticket | FR-SCH-07, FR-SCH-08 |
| AT-011 | Bệnh nhân đã check-in | Bác sĩ assigned mở worklist | Thấy đúng lượt theo branch, queue status | FR-MED-01, FR-MED-02 |
| AT-012 | Doctor đang khám | Tạo order xét nghiệm | Order hiện ở lab; encounter awaiting_results | FR-MED-05, FR-MED-06 |
| AT-013 | Lab trả kết quả | Doctor chưa review | Encounter không tự clinically_completed | FR-MED-06, FR-MED-07, BR-11 |
| AT-014 | Doctor review đầy đủ | Hoàn tất chẩn đoán, kê đơn, ký hồ sơ | Signed version và audit tạo; portal chỉ thấy bản released | FR-MED-04, FR-MED-08, FR-MED-09, FR-PUB-07 |
| AT-015 | Hồ sơ đã ký | Doctor cần sửa | Không overwrite; tạo addendum/version, liên kết bản cũ | FR-MED-09 |
| AT-016 | Catalog đổi giá sau booking | Billing tạo bill theo giá đã khóa | Snapshot được áp dụng theo pricing policy đã duyệt | FR-ORG-04, FR-BIL-01 |
| AT-017 | Encounter có khám + order | Thu ngân phát hành bill | Có từng charge đúng nguồn, không lặp | FR-BIL-01, FR-BIL-02 |
| AT-018 | Bill 500.000 VND | Thu cash 200.000 | Remaining 300.000, bill partially_paid, có chứng từ | FR-BIL-03, FR-BIL-07 |
| AT-019 | Bill chưa thanh toán | Patient trả online thành công | Payment verified; bill/ledger cập nhật; portal hiện biên nhận | FR-BIL-04, FR-PUB-08 |
| AT-020 | Payment success | Owner được duyệt refund | Refund dẫn payment gốc, đối soát balance và notify | FR-BIL-08, FR-BIL-10 |
| AT-021 | Clinic thu tại quầy và platform thu online | Chốt ca/đối soát | Báo cáo tách collector, fee, settlement và variance | FR-BIL-05, FR-BIL-10, FR-BIL-12 |
| AT-022 | Encounter đã kết thúc | Patient đăng nhập | Chỉ thấy tài liệu được released của mình | FR-PUB-07 |
| AT-023 | 1 encounter đang chờ kết quả qua ngày | Job chốt ca chạy | Encounter vẫn chờ, chốt ca ghi mục pending | FR-MED-07, FR-OPS-05 |
| AT-024 | Người dùng là guardian hợp lệ | Truy cập lịch/tài liệu người phụ thuộc | Xem đúng tài liệu được phép; log quan hệ và quyền | FR-IAM-07, FR-PUB-07 |
| AT-025 | Guardian bị thu hồi | Truy cập lại bằng token cũ | Bị từ chối | FR-IAM-07 |

## B. Negative/security/financial cases

| ID | Given | When | Then / kỳ vọng | Liên kết |
|---|---|---|---|---|
| AT-026 | Owner clinic A | GET/PUT resource ID clinic B | Không trả dữ liệu/không thay đổi B; security audit | NFR-01, FR-IAM-03 |
| AT-027 | Receptionist | Gọi endpoint chẩn đoán bằng URL trực tiếp | Denied; API không trả lâm sàng | FR-IAM-08, BR-09 |
| AT-028 | Doctor không assigned | Mở encounter khác | Denied và audit | FR-MED-02 |
| AT-029 | Payment webhook payload giả/sai chữ ký | POST callback | Không ghi success/payment, có alert phù hợp | FR-BIL-04 |
| AT-030 | Payment success webhook đã xử lý | Gửi lại 5 lần | Chỉ một hiệu lực tài chính, vẫn trả ACK phù hợp | FR-BIL-11 |
| AT-031 | Provider timeout chưa rõ trạng thái | Frontend retry | Không thu trùng, hệ thống reconcile rồi chốt | FR-BIL-04, FR-BIL-11 |
| AT-032 | Refund thành công | Gửi lại cùng idempotency key | Không hoàn hai lần | FR-BIL-08 |
| AT-033 | Hai cashier cập nhật một bill | Thu đồng thời vượt remaining | Không over-collect im lặng; xử lý theo policy | FR-BIL-07 |
| AT-034 | Draft clinical document | Patient đoán URL file | Access denied | FR-PUB-07, NFR-01 |
| AT-035 | Staff bị revoke | Token đã đăng nhập gọi API | Denied, không được cache quyền cũ | FR-IAM-05 |
| AT-036 | Kết quả order branch A | Staff branch B đoán ID | Denied | BR-02/03 |
| AT-037 | Thông báo booking/tái khám | Gửi SMS/email/push | Không có chẩn đoán hoặc kết quả y tế nhạy cảm trong preview | FR-OPS-02 |
| AT-038 | Database primary lỗi rồi restore | Thực hiện drill | Restore có integrity và RPO/RTO đo thực tế | NFR-05/09 |
| AT-039 | Message broker mất kết nối ngay sau DB commit | Order/payment event phát sinh | Outbox retry; không mất/sinh đôi hiệu lực | NFR-08 |
| AT-040 | Migration mapping từ V1 | Chạy dry-run trên bản sao | Số bản ghi/định danh/tổng tiền khớp hoặc có exception log duyệt | NFR-14 |
| AT-041 | Thử sửa hồ sơ signed bằng API khác | PUT raw resource | Denied hoặc tạo addendum có reason | FR-MED-09 |
| AT-042 | Booking đang chờ cọc và webhook đến sau TTL | Payment success đến muộn | Không cấp slot đã giao người khác; đi vào refund/exception queue | FR-SCH-04, FR-BIL-11 |
| AT-043 | Người dùng đổi clinic context | Search/worklist/dashboard | Không còn dữ liệu tenant cũ trong state/cache | FR-IAM-02, NFR-01 |
| AT-044 | Patient account trùng dữ liệu liên lạc | Receptionist đề nghị merge | Phải verify; không tự nối hồ sơ lâm sàng khác người | FR-IAM-05 |
| AT-045 | Manager cố cập nhật price đã dùng | Sửa version hiệu lực | Bill đã phát hành giữ snapshot; price mới áp dụng theo thời điểm | FR-ORG-04, BR-12 |

## C. Hai kịch bản go/no-go bắt buộc

**E2E-ONLINE — Online to aftercare:** Clinic approved → public search → chọn branch, doctor, slot → hold + confirmation/deposit policy → check-in → queue → assigned doctor → note → order → lab result → review → diagnosis/prescription → signature → bill/online payment hoặc phần còn lại → published portal → notification. **Go** khi toàn bộ flow và cross-tenant/payment negative tests liên quan PASS.

**E2E-WALKIN — No appointment:** Bệnh nhân chưa có tài khoản web đến quầy → receptionist tìm/matching hoặc tạo profile → walk-in encounter → queue → doctor → order/result nếu cần → prescription + signing → cashier thu trực tiếp → biên nhận và truy cập portal sau khi liên kết tài khoản hợp lệ. **Go** khi không có bước nào ép tạo booking web.

## D. Bảng điền bằng chứng khi thực thi

| Test ID | Build / môi trường | Dữ liệu test | PASS/FAIL/BLOCKED | Evidence (URL/log/screenshot) | Defect | Người duyệt |
|---|---|---|---|---|---|---|
| [điền] | [điền] | Synthetic only | [điền] | [điền] | [điền] | [điền] |

**Điều kiện release:** Tất cả P0 acceptance/negative cases PASS; không còn lỗi Critical/High chưa có quyết định xử lý; các điều kiện compliance và trách nhiệm merchant/tài chính được ký duyệt. Chỉ tiêu hiệu năng theo benchmark môi trường và tải đã thống nhất; không dùng một lần test thủ công để khẳng định production-ready.

## E. Bổ sung kiểm thử bao phủ yêu cầu P0

| ID | Given | When | Then / kỳ vọng | Liên kết |
|---|---|---|---|---|
| AT-046 | User đang đăng nhập và có session còn hạn | Logout/revoke session, gọi API cũ | Session bị vô hiệu; không thể dùng refresh/access theo policy | FR-IAM-01 |
| AT-047 | Patient xuất hiện ở hai cơ sở | Clinic B tạo clinic patient link hợp lệ | Identity logic không khiến B thấy encounter A | FR-IAM-04 |
| AT-048 | Clinic có nhiều branch | Manager tạo branch và tạo visit | Visit/bill/queue trỏ đúng branch thuộc clinic | FR-ORG-03 |
| AT-049 | Staff được mời rồi bị revoke | Gọi API trong và ngoài branch phân quyền | Chỉ branch được cấp có quyền; revoke có hiệu lực ngay | FR-ORG-05 |
| AT-050 | Có approved và draft clinic | Khách search theo tên/vị trí/dịch vụ | Chỉ approved xuất hiện; kết quả đúng bộ lọc | FR-PUB-01 |
| AT-051 | Clinic public có 2 branch/giá khác nhau | Khách mở detail | Hiện địa chỉ/giờ/service/giá theo branch và ngày cập nhật | FR-PUB-02 |
| AT-052 | Doctor được public tại branch A, không tại B | Khách mở doctor profile | Chỉ thông tin được duyệt và slot A hiện | FR-PUB-03 |
| AT-053 | Slot còn trống và patient hợp lệ | Chọn clinic/branch/service/doctor/slot rồi confirm | Có appointment ID, snapshot, confirmation; slot tiêu thụ đúng | FR-PUB-04, FR-PUB-05 |
| AT-054 | Patient có 2 lịch, một lịch hủy hợp lệ | Xem My Appointments và hủy | Trạng thái/historic đúng, slot release theo policy | FR-PUB-06 |
| AT-055 | Appointment cần đổi ca do receptionist | Reschedule với lý do | History + người sửa + notify; không có slot kép | FR-SCH-05 |
| AT-056 | Có queue đang chờ | Gọi, skip, chuyển đúng service point | Thứ tự, mã, branch và trạng thái nhất quán | FR-SCH-08 |
| AT-057 | Doctor vắng sau khi đã có confirmed appointments | Manager kích hoạt absence flow | Lịch không mất; đổi/hoàn/notify theo policy và audit | FR-SCH-09 |
| AT-058 | Doctor tạo encounter draft | Nhập tiền sử/sinh hiệu/chẩn đoán thiếu mandatory | Draft được lưu nhưng ký bị chặn kèm lỗi trường cụ thể | FR-MED-03 |
| AT-059 | Doctor kê đơn | Nhập đủ/thiếu thành phần theo mẫu duyệt | Ký đúng khi hợp lệ; không được ký đơn thiếu trường bắt buộc | FR-MED-08 |
| AT-060 | Hồ sơ đã clinically_completed nhưng bill chưa trả | Thực hiện thanh toán và phát hành tài liệu | Medical, encounter, document và finance giữ status riêng | FR-MED-10 |
| AT-061 | Hồ sơ đã xác nhận | Truy xuất/xuất/restore thử | Đúng version/tác giả/ký và dữ liệu bắt buộc theo checklist được duyệt | FR-MED-11 |
| AT-062 | Bill gồm khám, xét nghiệm, discount được duyệt | Xem line items/tổng và audit | Nguồn charge, giá snapshot, tổng tiền, điều chỉnh và actor rõ | FR-BIL-02 |
| AT-063 | Thanh toán tại quầy | In/download chứng từ | Nhãn biên nhận nội bộ đúng, không giả là hóa đơn thuế nếu chưa phát hành | FR-BIL-09 |
| AT-064 | Cuối ca có cash, transfer, online và refund | Cashier chốt ca | Đối chiếu theo phương thức và người thu; chênh lệch có reason/approve | FR-BIL-10 |
| AT-065 | Nền tảng nhận hộ giao dịch online | Chạy báo cáo settlement | Gross/fee/refund/net khớp ledger; tách pháp nhân nhận tiền | FR-BIL-12 |
| AT-066 | Notification provider lỗi tạm thời | Trigger booking/change/result released | Retry/dedup có trạng thái gửi; không gửi trùng gây hiểu nhầm | FR-OPS-01 |
| AT-067 | Doctor/Receptionist/Manager cùng clinic | Mở dashboard tương ứng | Chỉ các số liệu đúng role/branch, nguồn dữ liệu nhất quán | FR-OPS-03 |
| AT-068 | Staff sửa hồ sơ, manager đổi giá, cashier refund | Kiểm tra audit | Đủ actor, object, action, scope, timestamp, outcome, reason | FR-OPS-04 |
