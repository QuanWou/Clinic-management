# Clinic Management V2 — Phase 02 PRD package

**Ngày tạo:** 29/09/2026  
**Trạng thái:** PRD v0.9 để review; phạm vi sản phẩm nền tảng đã LOCKED, quy tắc chi tiết còn PROPOSED/OPEN.

## File
1. `PRD_Clinic_Management_V2.md`: tài liệu nguồn chính — mục tiêu, in/out scope, kênh, vai trò, functional requirements có ID, state machines, BR, NFR, UX, rollout và pháp lý.
2. `Role_Permission_Matrix.md`: quyền theo role/resource/scope, nguyên tắc backend authorization.
3. `Acceptance_Test_Matrix.md`: 68 acceptance cases Given/When/Then, 2 E2E go/no-go và mẫu thu evidence.
4. `Traceability.md`: đối chiếu 66 yêu cầu với acceptance cases; kiểm tra bao phủ P0.
5. `Decision_Log.md`: 4 quyết định đã chốt và 12 quyết định còn mở với owner.

## Quy trình duyệt
PO review phạm vi và ưu tiên → đại diện lễ tân/bác sĩ/thu ngân duyệt workflow → finance/legal duyệt payment/EMR/data → Tech/QA audit V1 và bổ sung API/ERD constraints → ký baseline PRD → Phase 03.

**Lưu ý:** Các tài liệu này được soạn bên ngoài source V1; chưa truy cập hoặc chỉnh sửa repository, workspace hay database của dự án. Đường dẫn pháp lý trong PRD là nguồn tham chiếu, không thay thế thẩm định pháp lý theo cơ sở/giấy phép cụ thể.
