# Document map — đọc tài liệu nào cho từng câu hỏi?

| Câu hỏi/đầu ra | Nguồn ưu tiên | Bổ trợ |
|---|---|---|
| Chức năng, phạm vi, business rule | `02_Product_Requirements/PRD_Clinic_Management_V2.md` | `01_Product_Research/03_Business_Workflows.md`, `04_Business_Rules.md` |
| Quyền/tách tenant | `02_Product_Requirements/Role_Permission_Matrix.md` | `03_Architecture_and_Database/02_Multi_Tenancy_and_Authorization.md` |
| Quyết định LOCKED và OPEN | `02_Product_Requirements/Decision_Log.md` | `03_Architecture_and_Database/10_ADR_and_Open_Decisions.md`, `05_Implementation_Delivery/08_Risks_Decisions_and_Dependency.md` |
| Nghiệm thu PRD | `02_Product_Requirements/Acceptance_Test_Matrix.md` + `Traceability.md` | `05_Implementation_Delivery/09_Traceability_and_Signoff.md` |
| Owner và sơ đồ dữ liệu | `03_Architecture_and_Database/01_System_Architecture.md`, `03_Data_Model_and_ERD.md` | `diagrams/*.mmd`, `sql/*.sql` (reference) |
| Lifecycle và state | `03_Architecture_and_Database/04_Lifecycle_and_Invariants.md` | `06_Events_Sagas_and_Sequences.md` |
| API/event | `03_Architecture_and_Database/05_API_Contracts.md`, `06_Events_Sagas_and_Sequences.md` | `contracts/openapi.yaml` (representative), `event-catalog.yaml`, P05 `05_Service_Contracts_and_Events.md` |
| Màn hình và giao diện | `04_UX_UI_and_Prototypes/docs/01_UX_Strategy_and_Sitemap.md`, `05_Screen_Inventory_and_Traceability.md`, `06_UX_Acceptance_Matrix.md` | `index.html`, `prototype/*.html` (demo) |
| Thực hiện theo thứ tự | `05_Implementation_Delivery/02_Vertical_Slice_Roadmap.md`, `03_Implementation_Backlog.md` | `backlog.csv` |
| Kiểm thử E2E / security / money | `05_Implementation_Delivery/04_End_to_End_Test_Plan.md` | P02 acceptance, P03 architecture acceptance, P04 UX acceptance |
| Audit/migration V1 | `03_Architecture_and_Database/08_V1_Migration_Strategy.md`, `05_Implementation_Delivery/01_Implementation_Strategy.md` | `03_Implementation_Backlog.md` task P05-S0-01 |
| Cutover/rollback | `05_Implementation_Delivery/07_Release_Readiness_and_Rollback.md` | `08_Risks_Decisions_and_Dependency.md`, `09_Traceability_and_Signoff.md` |

## Quy tắc ưu tiên khi có mâu thuẫn

1. **Thông tin người dùng đã chốt** (bốn lựa chọn sản phẩm) và quyết định/CR có owner ký sau đó, theo version/date.
2. **P02 PRD + Decision Log + Acceptance Matrix** nêu ý định sản phẩm. P01 là nguồn nghiên cứu, không thay đổi P02 đã chốt.
3. **P03** là kiến trúc đề xuất cụ thể hóa P02, không được tự sửa quy tắc nghiệp vụ. `openapi.yaml` là phần mẫu, không phải tất cả P0 endpoint.
4. **P04** là trải nghiệm tham chiếu và prototype giả lập, không chứng minh backend hay production.
5. **P05** là cách triển khai/test theo slice, không âm thầm chốt OD/ADR hay ghi đè PRD.
6. **Source/runtime V1 sau audit** mới là bằng chứng về hiện trạng V1, không phải `V1_Gap_Analysis.md` hoặc mô tả thiết kế V2.

Phát hiện mâu thuẫn: mở change request với owner, tác động PRD/schema/API/event/UI/test/migration; không tự giải quyết bằng code khi chưa được phép. Các bản PRD lặp tại `03_Architecture_and_Database/references/Phase02_PRD/` là snapshot tham khảo gốc; **nguồn chính vẫn ở `02_Product_Requirements/`**.
