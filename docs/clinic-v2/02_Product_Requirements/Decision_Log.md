# CMV2 — Product Decision Log

**Locked từ yêu cầu sản phẩm (29/09/2026):** DL-001 Marketplace + SaaS; DL-002 General Clinic; DL-003 Outpatient; DL-004 Hybrid Payment.

| ID | Quyết định | Trạng thái | Baseline/đầu ra cần chốt | Owner cần duyệt | Cản trở |
|---|---|---|---|---|---|
| DL-001 | Marketplace + SaaS | LOCKED | 3 kênh public/clinic/platform | PO | — |
| DL-002 | Phòng khám đa khoa | LOCKED | Hỗ trợ đa chuyên khoa, đa chi nhánh | PO | — |
| DL-003 | Ngoại trú | LOCKED | Encounter, order, prescription, follow-up | PO | — |
| DL-004 | Thu trực tiếp + online | LOCKED | Hybrid ledger | PO | — |
| OD-01 | Merchant/beneficiary của giao dịch online | OPEN | Kịch bản clinic merchant vs platform collects on behalf; contract, settlement, fee, refund | Finance/Legal | Billing architecture |
| OD-02 | Đặt cọc booking | OPEN | Cấu hình clinic/service, booking TTL, chính sách trả cọc | PO/Clinic | Slot lifecycle |
| OD-03 | No-show/cancel/refund | OPEN | Thời hạn, actor, approval, auto/manual | PO/Clinic/Finance | Appointment acceptance |
| OD-04 | Bệnh nhân chọn bác sĩ hay specialty pool | OPEN | Tùy cấu hình clinic | Clinic/Medical | Slot model |
| OD-05 | Biểu mẫu hồ sơ ngoại trú/ký | OPEN | Danh sách biểu mẫu và trường mandatory từ chuyên môn/pháp lý | Medical/Compliance | Medical MVP |
| OD-06 | Chia sẻ hồ sơ cross-branch/cross-clinic | OPEN | Deny by default, quyền chia sẻ/audit | Privacy/Medical | Identity/data architecture |
| OD-07 | Nội bộ hay đối tác cho lab/pharmacy | OPEN | Internal MVP; external integration P1 | Clinic | Order contract |
| OD-08 | Biên nhận/hóa đơn/đối soát thuế | OPEN | Chủ thể phát hành, tích hợp hóa đơn điện tử nếu áp dụng | Accounting/Legal | Billing acceptance |
| OD-09 | Tải mục tiêu và SLA production | OPEN | Workshop workload, đo staging, xác nhận RPO/RTO | PO/Tech | NFR acceptance |
| OD-10 | Patient matching và đại diện | OPEN | Dữ liệu đối chiếu, căn cứ quan hệ và quyền thu hồi | Privacy/Clinic | Patient model |
| OD-11 | Giấy phép clinic và thông tin được public | OPEN | Approval checklist, chứng từ, phạm vi hành nghề | Legal/Platform Ops | Clinic onboarding |
| OD-12 | Quy tắc trùng dữ liệu khi migration V1 | OPEN | Mapping ID, giữ nguyên lịch sử, reconciliation owner | Tech/Clinic | Cutover |

## Mẫu ghi quyết định

- **Decision ID:** …
- **Ngày / người duyệt:** …
- **Quyết định và phạm vi áp dụng:** …
- **Phương án đã cân nhắc:** …
- **Lý do / tác động business, legal, security:** …
- **FR/BR/AT cần sửa:** …
- **Kế hoạch rollout / rollback:** …

Một quyết định OPEN không ngăn viết tài liệu kiến trúc giả định, nhưng không được coi đó là hợp đồng đã được ký hoặc chính sách vận hành được phép triển khai.
