# Decisions & gates — chưa tự chốt chính sách còn mở

## LOCKED (29/09/2026)

| ID | Quyết định |
|---|---|
| DL-001 | Marketplace + SaaS |
| DL-002 | Phòng khám đa khoa |
| DL-003 | Ngoại trú |
| DL-004 | Thu trực tiếp + trực tuyến |

## Quyết định nghiệp vụ OPEN (P02 là nguồn chính)

| ID | Nội dung | Liên quan trước khi phát hành |
|---|---|---|
| OD-01 | Chủ thể nhận tiền/merchant/collect-on-behalf | Billing, tiền online/settlement |
| OD-02 | Đặt cọc, slot TTL và xử lý cọc | Booking/payment deposit |
| OD-03 | Hủy lịch, no-show, hoàn tiền | Appointment, Reception, Billing |
| OD-04 | Chọn bác sĩ cụ thể hay specialty pool | Assignment, capacity, UX |
| OD-05 | Biểu mẫu, ký và xác nhận y khoa | Medical/Patient Portal |
| OD-06 | Chia sẻ hồ sơ liên chi nhánh/liên phòng khám | Privacy/Security/Medical |
| OD-07 | Lab/pharmacy nội bộ hoặc đối tác | Clinical workflow |
| OD-08 | Biên nhận và hóa đơn thuế | Billing/Accounting |
| OD-09 | Workload, SLA, RPO, RTO | Infra, recovery |
| OD-10 | Patient matching/guardian | Walk-in, portal, privacy |
| OD-11 | Điều kiện và trường pháp lý được public | Onboarding/search |
| OD-12 | Dữ liệu V1 trùng/khó ánh xạ | Migration reconciliation |

Quyết định kỹ thuật bổ sung trong P03 ADR vẫn cần Tech/Security/DBA/phụ trách nghiệp vụ duyệt. Không mặc định công nghệ/provider hoặc giả định demo thành chính sách production.

## Gate thực hiện và phát hành

- S0 phải có read-only V1 source audit (`P05-S0-01`), mapping reuse/refactor/replace có bằng chứng; không xóa V1.
- Trước mỗi slice: trace FR/AT/UX; owner API/event; tenant/object auth; negative cases và kết quả dự kiến.
- Đặt cọc online chỉ làm theo nhánh S1 nếu OD-01/02/03 được duyệt; nếu chưa, chỉ kiểm tra booking **không cọc** với dữ liệu synthetic, không bật flow thu cọc thật.
- `IMPLEMENTED` ≠ `INTEGRATED` ≠ `VERIFIED` ≠ `ACCEPTED`.
- Go/no-go phải chứng minh `E2E-ONLINE` và `E2E-WALKIN` + negative/security/money tests liên quan, migration rehearsal, backup/restore/rollback, và các phê duyệt của Medical/Finance/Legal/Privacy.

Đọc bảng chính xác và owner tại `02_Product_Requirements/Decision_Log.md`; gating và evidence tại `05_Implementation_Delivery/07_Release_Readiness_and_Rollback.md` + `09_Traceability_and_Signoff.md`.
