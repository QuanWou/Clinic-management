# 11 — Workshop xác nhận thiết kế trước khi giao code

**Mục tiêu:** giải quyết các giả định có thể thay đổi API, schema hoặc workflow. Chỉ ghi nhận quyết định bằng biên bản có người duyệt, không dựa vào phỏng đoán từ giao diện prototype.

## Session A — Onboarding & Marketplace (PO/Clinic/Platform/Legal)
- Hồ sơ phòng khám nào phải upload/verify; cơ sở nào được công bố, sửa và tạm ngưng?
- Branch có lịch, bảng giá và bác sĩ riêng không? Người dùng có chọn bác sĩ cụ thể hay pool chuyên khoa?
- Người dùng tìm theo từ khóa/vị trí/dịch vụ như thế nào; giá hiển thị là giá niêm yết hay giá cuối? Thời điểm cập nhật?
- Output: checklist publish, branch configuration, price/availability copy, OD-04/11 decision, acceptance update.

## Session B — Front Desk & Operations (receptionist/manager)
- Giờ cao điểm, bệnh nhân đặt hẹn/đến trực tiếp, no-show, bác sĩ nghỉ, đổi phòng/chi nhánh xử lý ra sao?
- Những thông tin cần xem trước check-in, nguyên tắc gợi ý trùng, ai phê duyệt merge?
- Hàng đợi có theo phòng/bác sĩ/chuyên khoa? Skip/transfer/priority áp dụng điều kiện nào?
- Output: appointment/visit/queue states, UX desk steps, OD-03/04/10.

## Session C — Clinical (doctor/nurse/lab/medical lead)
- Biểu mẫu khám ngoại trú, mandatory field, đơn thuốc, giá trị xét nghiệm, mẫu trả kết quả, người nhập/duyệt; hồ sơ ký bằng phương thức nào?
- Khi kết quả trả sau ca, ai nhận cảnh báo, ai tiếp tục encounter? Điều kiện ký/release và sửa addendum?
- Tái khám dùng encounter mới, phần nào được viện dẫn từ hồ sơ cũ và quyền xem khác chi nhánh?
- Output: clinical form checklist, order/result lifecycle, release/sign policy, OD-05/06/07.

## Session D — Payment & Accounting (cashier/finance/legal)
- Ai là beneficiary và merchant cho mỗi phương thức? Dịch vụ nào thu trước/cọc/sau? Ai cấp chứng từ/hóa đơn?
- Chuyển khoản ngoài hệ thống được kiểm tra thế nào? Chính sách partial, refund, surcharge/discount, shift close/settlement?
- Provider timeout và late success cần cơ chế xử lý/đối soát nào? Ai có quyền approve exception?
- Output: money flow diagram signed, ledger ownership, refund matrix, OD-01/02/03/08.

## Session E — Privacy, architecture & QA
- Bệnh nhân/guardian xác minh quyền và thu hồi như thế nào? Ai được xem record trong hai chi nhánh? Audit retention, security incident/backup?
- Workload hiện có, peak, downtime, RPO/RTO, provider sandbox, V1 data mapping/duplicate resolution?
- Output: IAM/guardian policy, benchmark assumptions, migration rules, OD-06/09/10/12; test fixture freeze.

## Biên bản tối thiểu
`Meeting ID · date · participants/roles · observed workflow · decision ID · options · selected policy · scope · affected FR/BR/API/event/UI/test · owner/sign-off · action/due date · open risks`.

**Kết thúc workshop:** cập nhật Phase 02 Decision Log, Phase 03 ADR/contracts, Phase 04 UX/UX acceptance và Phase 05 backlog/test matrix bằng cùng một version; chỉ chuyển task `READY_FOR_IMPLEMENTATION` khi dependencies đã được xác nhận.
