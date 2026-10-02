# S1 — Gap review theo Phase 05

Task: `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`  
Branch: `local-coder/clinic-management-v2-6820c6b7`  
Ngày: 2026-10-01

Nguồn quyết định: [A0](../A0_Foundation_Gate_Decision.md), [backlog](../../../clinic-v2/05_Implementation_Delivery/03_Implementation_Backlog.md), [test plan](../../../clinic-v2/05_Implementation_Delivery/04_End_to_End_Test_Plan.md), `v2/contracts/audit-producer-checklist.md`.

A0 đã ACCEPTED BY PRODUCT OWNER. Workspace của Owner quản lý một clinic; branch là phạm vi của dữ liệu nghiệp vụ và lựa chọn địa điểm khám trên Public.

| Hạng mục thiếu tại handoff | Thực hiện trong lượt này | Giới hạn còn lại |
|---|---|---|
| Search chỉ compile | PostgreSQL version/replay/concurrency, publication và branch ownership; inbox nhận snapshot theo source + event ID; snapshot thay thế đầy đủ để ẩn item đã bị bỏ | Index/snapshot giới hạn 2.000 items mỗi clinic; cần chiến lược paging nếu vượt giới hạn |
| Chưa có producer thật | Clinic/Doctor/Catalog V4 capture local outbox cùng transaction; relay workload JWT; retry/DLQ; refresh hiệu lực giá/license/affiliation | Bootstrap deployment và quan sát độ trễ/DLQ production thuộc rollout |
| Patient chỉ compile | Runtime RLS cho profile, user link và clinic link; serialize tạo link; optimistic version; không merge bằng phone/email | Matching nâng cao/walk-in/review hồ sơ thuộc S2 |
| Slot concurrency chưa chứng minh | PostgreSQL 2/50 requests; một hold thành công; overlap bác sĩ xuyên offering trong cùng clinic; advisory lock + pessimistic lock; scoped FK/idempotency | Chính sách bác sĩ xuyên các clinic vẫn cần OD-04; không suy diễn từ tenant A sang B |
| Cancel/reschedule/stale source chưa kiểm chứng | TTL, source schedule/version/duration, snapshot giá, suspension, cancel release, reschedule giữ lịch cũ khi thất bại, retry và ownership; ngày kết thúc lúc 00:00 và khoảng ngày [start,end) | Full clinical/revenue lifecycle ở S2–S4 |
| Public synthetic shell | API Search, login/signup qua Identity hiện có, profile, availability, hold countdown, confirm/cancel/reschedule; giữ key khi retry kết quả chưa rõ; mobile layout và state UX | Signup/login thực dùng Identity compatibility hiện có. Chưa thay thế Identity bằng flow mới |
| Notification chưa có | Service mới: inbox/order, thông báo trong ứng dụng, preference opt-in, reminder dedup và suppression khi cancel | Email/SMS/push provider chưa triển khai; kênh hiện tại là in-app |
| Audit chỉ local history | Appointment relay gửi cùng event ID độc lập tới Notification và Audit; audit inbox + hash-chain append atomically | Whole-platform audit producer adoption tiếp tục theo từng slice |
| Evidence/cleanup chưa chốt | Script fresh DB/least-privilege runtime, package hashes, logs, browser screenshots, transport fixtures | Hai thư mục sandbox của lần khởi động lỗi còn lại; lệnh dọn đã bị automatic approval review chặn |

## Phần vẫn còn ngoài S1 hiện tại

Handoff update 2026-10-01: matching/provisional reception, check-in/queue, assigned doctor start và ngoại lệ từng appointment đã được code/kiểm chứng tại [S2 checkpoint](../P05-S2/S2_Implementation_Evidence.md). Những câu "thuộc S2" phía trên ghi lại phạm vi tại checkpoint S1; [S2 gap review](../P05-S2/S2_Gap_Review.md) là trạng thái mới nhất cho các phần này.


- S1-05 deposit: BLOCKED theo OD-01/02/03 OPEN; chỉ triển khai no-deposit.
- Accessibility review thủ công bằng keyboard/screen reader/zoom và full journey với Identity thật vẫn cần evidence ở gate tương ứng.
- Production routing/BFF, secrets, provider, alert/DLQ retention, disaster recovery và rollout cần deployment evidence.
- S2: reception, matching/walk-in, check-in/encounter và queue; S3: clinical; S4: billing/financial exception; S5: portal/aftercare; S6: full QA/Security/SRE/migration/cutover chưa được triển khai full trong lượt này.
- Không tự chuyển A1 hoặc các gate sau thành ACCEPTED. Acceptance của A0 không phải production certification.

Trạng thái kiểm chứng chính xác nằm ở [evidence](S1_Implementation_Evidence.md) và các summary/log tương ứng. Không coi compile hoặc browser fixture là full E2E production.


Latest continuation 2026-10-02: actual registration/password login and Public keyboard registration/booking are verified in P05-S6/authenticated-checkpoint-06. S2–S5 operational no-deposit/unsigned/onsite flows, exception/source recovery and synthetic restore/application recovery are implemented; see ../P05-S6/Operational_Baseline_Completion_Evidence.md. Older remaining-work lines describe the original S1 checkpoint, not current implementation. Provider channels, production rollout, qualified forms and A1–A6 sign-off remain separate.
