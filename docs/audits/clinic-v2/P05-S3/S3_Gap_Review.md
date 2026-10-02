# S3 — clinical nội bộ chưa ký, cập nhật 2026-10-02

Theo [PO](../Delivery_Scope_No_Deposit_Unsigned.md), các trường Medical là baseline draft đề xuất, chưa là mẫu chuyên môn/pháp lý được duyệt.

| Task | Đã triển khai/kiểm chứng | Còn ngoài bằng chứng hiện tại |
|---|---|---|
| S3-01 | Assigned Doctor/worklist/start/wait/requeue/resume cùng encounter; overnight, unsigned complete/close/FULFILLED; audit read/deny | Worklist 200, reassignment nâng cao, benchmark và review vận hành |
| S3-02 | Draft 9 trường, opt-in autosave, version/conflict/history; source assignment/RLS; không đưa nội dung vào event/audit | Qualified form review, accessibility/privacy assessment |
| S3-03 | Internal orders, LAB accept/process/reject/append result; Doctor review đúng version; immutable VALIDATED, charge delivery/recovery | LIS integration và production retention/ownership |
| S3-04 | Ký/phát hành chưa bật; completion nội bộ riêng với signature/money | Approved prescription, signature/version/addendum/release |
| S3-05 | Patient operational history/follow-up chỉ metadata tối thiểu, không trả draft note/result text | Clinical sharing/download/guardian khi có policy/mẫu được duyệt |

[Checkpoint 05](../P05-S6/authenticated-checkpoint-05/summary.json) ghi bộ package 206 selected tests/12 matched builds, real-auth HTTP và restore. [Clinical access](../P05-S6/authenticated-checkpoint-05/clinical-access-summary.json) chứng minh Doctor cùng branch nhưng không assigned bị 403, Reception bị 403, assigned Doctor được đọc; audit riêng và VALIDATED không đổi. PostgreSQL tests chứng minh audit từ chối sống qua outer transaction rollback, không chứa clinical body, unscoped runtime đọc zero rows; Audit từ chối producer giả/PHI/operation tùy ý và dedup.

[Medical](Medical_Implementation_Evidence.md) và [Completion](Completion_Implementation_Evidence.md) giữ provenance cũ. A3 chưa ACCEPTED; kiểm thử source không thay thế phê duyệt chuyên môn hoặc legal release.


Latest continuation: Doctor worklist now supports keyset continuation beyond 200, with 225-row equal-timestamp PostgreSQL proof, role/scope/cursor/revoke checks and actual source audit. See [laptop audit](../P05-S6/Scheduled_0300_Functional_Laptop_Audit.md) and [checkpoint 09](../P05-S6/authenticated-checkpoint-09/summary.json): 208 selected backend tests/12 exact packages; 65 frontend tests/20 fixtures; laptop actual reads. The earlier 200-row limitation is superseded for Doctor; qualified acceptance and reassignment/load review remain open.
