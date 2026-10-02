# 05 — V1 Gap Analysis (pre-audit)
**Chưa đọc source V1 trong phiên này.** Bảng là checklist kiểm chứng, không phải kết luận lỗi đã xác nhận.

| Vùng | V2 yêu cầu | Cần audit trong V1 |
|---|---|---|
| Identity | multi-clinic membership, branch scope | JWT claims, role mapping, middleware, refresh/session |
| Patient | identity dùng chung, hồ sơ theo cơ sở | patient key, duplicate matching, tenant isolation |
| Doctor | đa cơ sở, lịch và phân công | doctor profile, schedule, leave, slot capacity |
| Appointment | hold/booking/check-in/no-show | race condition, slot release, cancellation |
| Encounter | walk-in và appointment tách biệt | visit creation, queue linkage, record linkage |
| Medical | orders/results/prescription/signing | permissions, versioning, clinical status |
| Catalog | dịch vụ và giá theo tenant/branch | ownership, price snapshot |
| Billing | charge/payment/refund/settlement | double charge, webhook idempotency, ledger |
| Notification | template/channel/consent | queue, retry, privacy |
| Clinic | tenant, branch, onboarding | service mới và migration |
| Frontend | public marketplace + clinic workspace | route map, role workflows, empty/error states |
| Data | không mất lịch sử | schema, FK, migration/rollback, backups |

## Phương pháp audit
1. Inventory service/repo/schema/routes/events và environment.
2. Truy vết hai luồng E2E: online booking và walk-in.
3. Lập bảng endpoint -> owner -> role -> tenant scope -> dữ liệu -> test.
4. Chạy test read-only/isolated; chụp bằng chứng cho từng gap.
5. Phân loại reuse/refactor/replace/new, ước lượng migration.
Không xóa, reset, commit hay thay đổi source trước khi có quyền và xác minh task/workspace.
