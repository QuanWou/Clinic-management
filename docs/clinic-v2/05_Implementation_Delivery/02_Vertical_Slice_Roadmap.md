# 02 — Roadmap: xây một luồng hoàn chỉnh trước khi mở rộng

## Sơ đồ dependency
`S0 Foundation → S1 Public Discovery/Booking → S2 Reception/Walk-in → S3 Clinical Care → S4 Hybrid Revenue → S5 Portal/Aftercare → S6 Integrated E2E & Pilot readiness`

Thanh toán **đặt cọc online khi đặt lịch** là nhánh mỏng của Billing được chuẩn bị cùng S1, không chờ đến S4 mới kiểm chứng. S4 hoàn thiện toàn bộ billing/ledger/refund/settlement. Trước khi S1 bắt đầu, OD-01/02/03 phải đủ quyết định cho nhánh được triển khai; nếu chưa duyệt, chỉ test booking không cọc trên synthetic sandbox và chặn release flow có cọc.

| Slice | Giá trị nghiệm thu theo người dùng | Service / UI liên quan | Đầu ra cần thiết | Gate |
|---|---|---|---|---|
| S0 — Foundation | Owner tạo cơ sở, operator duyệt, nhân viên vào đúng branch | Identity, Clinic, Doctor, Catalog, Audit; shared UI | Tenant/context, publish flow, membership, baseline schedules/prices, telemetry, backup plan | A0: cross-tenant/revoke không vượt quyền; source-of-truth xác lập |
| S1 — Find & Book | Bệnh nhân tìm cơ sở và nhận lịch đã xác nhận | Search, Clinic, Doctor, Catalog, Appointment, Patient, Notification, Billing deposit thin path; Public UI | Public projection, slot hold, confirm, conflict/timeout/pending UI | A1: 1 capacity không overbook; confirm/cancel/late payment rõ ràng |
| S2 — Arrive & Queue | Bệnh nhân đặt trước hoặc đi thẳng vào quầy đều được phục vụ | Patient, Appointment, Encounter; Reception UI | Matching review, check-in idempotent, ticket, handoff doctor | A2: walk-in không appointment; một check-in/ticket active |
| S3 — Examine & Treat | Bác sĩ có đủ hồ sơ và quyết định điều trị hợp lệ | Encounter, Medical, Catalog, Notification; Doctor/Lab UI | draft, order/result/review, diagnosis, prescription, sign/addendum/release | A3: signed immutable, medical role enforced, pending-result giữ trạng thái |
| S4 — Collect & Reconcile | Thu ngân thu đúng, bệnh nhân theo dõi trạng thái | Billing, Appointment, Medical, Portal; Cashier UI | unique charge, bill, direct, online, partial, refund, ledger, close shift | A4: no duplicate money effect, beneficiary đúng, reconciliation |
| S5 — Aftercare & Follow-up | Người bệnh nhận bản released và đặt tái khám | Portal, Medical, Notification, Appointment; Patient UI | secure release/download, follow-up linked prior visit, reminder, guardian access | A5: draft invisible, revoke denied; follow-up không sửa encounter cũ |
| S6 — Cross-slice validation | Hai đường E2E chạy được và đủ điều kiện pilot | All + infra/security/data migration | Evidence pack, restore & migration dry run, defect closure, go/no-go | GATE-A–E Phase 02 & ARCH-01–16 theo phạm vi |

## Slice checklists theo dependency
### S0 → S1
- Clinic đã verified/published; thông tin public được duyệt. Staff role, doctor affiliation, branch scope, catalog/price version và doctor schedule sẵn sàng.
- Search projection chỉ có thông tin public; booking revalidate clinic status, price, slot với nguồn.

### S1 → S2
- Appointment có ID, branch, patientRef, slot, source và trạng thái; notification không tự khẳng định đã thu tiền.
- Reception nhận history/audit khi đổi lịch; walk-in có identity/matching kiểm duyệt riêng.

### S2 → S3
- Encounter là nguồn danh sách bác sĩ, queue event có idempotency; bác sĩ không được mở lượt ngoài assignment.
- `appointment.fulfilled` không đồng nghĩa ký bệnh án.

### S3 → S4
- Order và service dùng snapshot hợp lệ; Billing tính charge từ source event idempotent; medical không bị block chỉ vì portal/payment projection chậm.
- Cơ chế hold bill chờ event và cảnh báo khi thiếu charge được chỉ rõ.

### S4 → S5
- Có bill/receipts và payment state được verify; record signing và release độc lập financial state theo policy đã duyệt.
- Patient identity/guardian relationship được xác thực trước khi tải tài liệu.

### S5 → S6
- Cả online và walk-in đều chạy synthetic ở staging, gồm late webhook, signed addendum, aftercare, follow-up, clinic A/B isolation.
- Báo cáo từ service owner và projection có cơ chế đối chiếu; không coi màn hình đẹp là bằng chứng E2E.

## Phương án release từng phần (đề xuất, cần phê duyệt)
- `Internal demo`: có thể demo UI với dữ liệu giả, hiển thị banner simulated; không nhận booking/tiền thực.
- `Pilot limited`: chỉ sau khi gate an toàn tài chính, y tế, quyền dữ liệu, legal và vận hành ký; dùng cơ sở thí điểm có chủ quản.
- `General availability`: sau pilot, quan sát sự cố, rollback rehearsal, đáp ứng mục tiêu tải/SLA đã thống nhất.

Không ước lượng thời gian chính xác khi chưa audit V1, chốt quyết định OPEN, biết số người/nguồn lực và năng lực QA.
