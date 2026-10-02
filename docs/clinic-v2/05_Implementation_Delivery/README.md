# Clinic Management V2 — Phase 05: Vertical-Slice Delivery & E2E Plan

- **Document set:** CMV2-P05 · version `0.9-draft` · 29/09/2026.
- **Phạm vi LOCKED:** Marketplace + SaaS; phòng khám đa khoa; ngoại trú; thanh toán tại quầy và online.
- **Chỉ là tài liệu chuẩn bị triển khai.** Không có source ứng dụng, migrations, seed executable, test scripts hay lệnh triển khai. Không kết nối/đọc/sửa workspace, repository, hệ thống hay dữ liệu bệnh nhân thực tế.
- **Trạng thái:** yêu cầu/kế hoạch dự kiến; chưa có kết quả E2E, chưa phê duyệt chính sách pháp lý/tiền, chưa audit mã nguồn V1.

## Nội dung
| Tài liệu | Mục tiêu |
|---|---|
| `01_Implementation_Strategy.md` | Phạm vi, nguyên tắc, môi trường và chiến lược thực hiện |
| `02_Vertical_Slice_Roadmap.md` | Thứ tự S0–S6, mốc, dependency, gate và bàn giao từng lát |
| `03_Implementation_Backlog.md` | Công việc có ID, người phụ trách, đầu ra và Definition of Done |
| `04_End_to_End_Test_Plan.md` | Kịch bản E2E, negative, tài chính, dữ liệu, bảo mật; evidence |
| `05_Service_Contracts_and_Events.md` | Handoff API/event, khoảng trống contract, consistency và lỗi |
| `06_Synthetic_Test_Data_and_Environments.md` | Hồ sơ dữ liệu giả, môi trường và test matrix |
| `07_Release_Readiness_and_Rollback.md` | Release gates, pilot, cutover, rollback và trách nhiệm |
| `08_Risks_Decisions_and_Dependency.md` | Quyết định OPEN, rủi ro và điều kiện unblock |
| `09_Traceability_and_Signoff.md` | FR → UX → slice → AT; biểu mẫu xác nhận |
| `10_Workflow_Diagrams.md` | Sơ đồ Mermaid trong Markdown, không phải source code |
| `11_Stakeholder_Workshop.md` | Kịch bản workshop với các nhóm sử dụng và checklist chốt |
| `backlog.csv` | Bảng task có thể import vào tracker (không phải file thực thi) |

## Nguồn tham chiếu theo thứ tự ưu tiên
1. Phase 02 `PRD_Clinic_Management_V2.md`, `Decision_Log.md`, `Acceptance_Test_Matrix.md`, `Traceability.md`.
2. Phase 03 `01_System_Architecture.md`, `04_Lifecycle_and_Invariants.md`, `05_API_Contracts.md`, `06_Events_Sagas_and_Sequences.md`, `09_Architecture_Acceptance.md`, `contracts/openapi.yaml` (representative only), `contracts/event-catalog.yaml`.
3. Phase 04 `docs/05_Screen_Inventory_and_Traceability.md`, `docs/06_UX_Acceptance_Matrix.md`, `docs/07_Design_Handoff_Backlog.md`.
4. Phase 01 business workflow & V1 gap checklist.

**Quy tắc bảo toàn:** Nếu phát hiện mâu thuẫn giữa tài liệu, tạo change request có owner/impact, không âm thầm sửa hợp đồng/định nghĩa trạng thái. Thông số chưa được duyệt giữ nhãn `[OPEN]` hoặc `[PROPOSED]`. Bản này không có giá trị chứng nhận hệ thống sẵn sàng vận hành y tế.
