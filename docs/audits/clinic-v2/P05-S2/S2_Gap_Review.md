# S2 — phạm vi không cọc, cập nhật 2026-10-02

Theo [quyết định PO](../Delivery_Scope_No_Deposit_Unsigned.md), Workspace Owner quản lý một clinic; branch là phạm vi nghiệp vụ. A0 đã chốt; A2 chưa nghiệm thu.

| Hạng mục | Triển khai và kiểm chứng | Giới hạn cần review |
|---|---|---|
| Patient tại quầy | Hồ sơ tạm, gợi ý theo clinic, lựa chọn rõ ràng; review có version/evidence/reason, không auto merge hoặc gán account | Matching nâng cao, merge và guardian cần quy tắc được duyệt |
| Walk-in/check-in | Claim nguồn, ARRIVAL_PENDING, actor receipts; quản lý phục hồi cùng visit sau mất ACK/nhân viên rời ca; replay/revoke/concurrency | Pending supervisor và queue có keyset paging; actor receipt list giới hạn 100 |
| Queue | Atomic counter, call/skip/transfer, assigned Doctor, chờ/quay lại; chuyển WAITING qua ngày giữ encounter/check-in và ticket cũ | Doctor worklist giới hạn 200; benchmark/paging cho tải lớn và review người dùng |
| Vắng bác sĩ | ACTIVE/CANCELLED có version, amendment append nguồn mới, relay nền/batch, resolve kiểm nguồn, no-show/cancel giữ history/giá | Cancel/reschedule/rebook kiểm nguồn hiện tại; không override lịch vắng hoặc tự hoàn tiền |
| IAM/Audit | Canonical role/branch, RLS, next-request revoke; source outbox, clinical read/deny identifiers-only | Privacy/security review production, gateway/secrets/alerts theo môi trường |
| Hành trình thật | Signup/password login, Public browser booking, reception/care/billing/portal API, recovery và restore synthetic | UI fixture và browser gọi service thật ghi riêng trong evidence; không suy ra acceptance |

[Checkpoint 05](../P05-S6/authenticated-checkpoint-05/summary.json) có bộ package 206 selected backend tests/12 builds, SHA256 khớp các lượt zero-skip trước; HTTP thật và restore 13 database. Đây không phải 206 tests chạy lại trong lượt package reuse. [Absence evidence](Absence_Lifecycle_Implementation_Evidence.md) giữ provenance nguồn; checkpoint mới bổ sung supervisor/overnight/paging.

Các sandbox mới được dừng và giữ lại. Không tuyên bố cleanup deletion PASS hoặc A2 ACCEPTED. Ký/phát hành, online collection và chính sách hoàn tiền chưa bật.

