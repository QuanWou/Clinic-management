# Clinic Management V2 — Project Context (đọc đầu tiên)

**Baseline tài liệu:** P01–P05 ngày 29/09/2026; đây là context cho công việc tương lai, không phải trạng thái source V1 đã xác minh.

## 1. Lựa chọn sản phẩm đã LOCKED

- **Mô hình:** Marketplace + SaaS. **Cơ sở:** phòng khám đa khoa (thiết kế hướng đa chi nhánh). **Phạm vi:** khám ngoại trú. **Thu tiền:** tại cơ sở và online.
- Kênh (1) **Public Website / Patient Portal**: tìm phòng khám, bác sĩ, dịch vụ, lịch trống; đăng ký/đặt khám; xem tài liệu được release và lịch sử. (2) **Clinic Workspace**: vận hành theo vai trò và clinic/branch. **Platform Console** là chế độ/quyền điều hành nền tảng riêng, không đồng nhất Clinic Owner/Admin.
- Triển khai theo hành trình đầy đủ, **không** xây toàn bộ dashboard CRUD riêng lẻ rồi mới ghép nghiệp vụ.

## 2. Các vai trò và ranh giới

Platform Ops duyệt/công bố cơ sở; Clinic Owner/Manager cấu hình, nhân sự và báo cáo trong phạm vi tổ chức; Receptionist tiếp nhận và xếp hàng; Doctor khám theo assignment; Nurse/Lab xử lý nghiệp vụ được phân công; Cashier thu/đối soát; Patient/Guardian truy cập dữ liệu được cho phép. Quyền luôn do backend quyết định theo **identity + clinic + branch + object + assignment + lifecycle + consent**. Chủ cơ sở và Platform Ops không mặc nhiên đọc bệnh án cá nhân.

## 3. Đường đi nghiệp vụ tiêu chuẩn

**Online (J-01):** Duyệt/công bố clinic → tìm kiếm public → chọn clinic/branch/doctor/service/slot → đăng ký hoặc xác minh bệnh nhân → giữ chỗ và đặt lịch → lễ tân check-in → encounter/bác sĩ khám → cận lâm sàng nếu có → kết luận, kê đơn, ký và release hợp lệ → charge/bill/payment/receipt → bệnh nhân xem tài liệu đã release → tái khám bằng appointment mới liên kết lượt trước.

**Walk-in (J-02):** Lễ tân xác minh/tạo hồ sơ tạm → tạo encounter **không có appointment** (`appointment_id=null`) → xếp hàng và phân công bác sĩ → khám và thu phí → nếu người bệnh muốn tạo tài khoản, chỉ liên kết sau xác minh, không gộp hồ sơ vì trùng số điện thoại.

**Chốt ngày/ca:** encounter đang chờ kết quả không tự đóng; trạng thái chuyên môn, lịch hẹn, thanh toán và release là các sự thật độc lập.

## 4. Bounded contexts / ownership (thiết kế đề xuất)

Identity (user/session/membership); Clinic (clinic/branch/onboarding/publish); Patient (identity/link/guardian); Doctor (affiliation/schedule); Catalog (offering/price version); Appointment (slot/hold/booking); Encounter (actual visit/check-in/queue/assignment; độc lập ngữ nghĩa, quyết định deployment còn OPEN); Medical Record (notes/orders/results/prescription/signature/release); Billing (charge/bill/payment/refund/ledger/reconciliation); Notification; Search (public approved projection); Audit. BFF/API gateway cho từng kênh; owner service giữ quyền quyết định dữ liệu của mình.

**Bất biến:** `Appointment ≠ Encounter ≠ Clinical Document ≠ Bill ≠ Payment`; một hành động không tự ngầm suy ra hành động khác. Search chỉ là projection, mọi lệnh đặt chỗ phải revalidate dữ liệu nguồn. Payment return page không chứng minh thanh toán; webhook phải xác thực và xử lý idempotent. Hồ sơ ký không bị ghi đè; chỉnh sửa theo version/addendum. Dữ liệu phòng khám A không được lộ sang B; patient global identity không đồng nghĩa quyền truy cập clinical chart xuyên cơ sở.

## 5. Guardrails kỹ thuật và pháp lý

- Đề xuất row tenant isolation với `clinic_id`, `branch_id`, membership sống và RLS phòng thủ bổ sung; tenant context phải do backend xác minh, không tin header đơn thuần.
- Không query/join trực tiếp DB service khác trong nghiệp vụ; API/versioned events, outbox/inbox và idempotency khi cần.
- Lưu audit, tối thiểu hóa PHI trong log/event/search/notification; fixture/screenshot demo dùng dữ liệu synthetic.
- SQL trong P03 là **reference only**. Không sử dụng dữ liệu thật để thử nghiệm, không reset/restore/stash/clean, không xoá DB/volume V1. Mọi migration cần mapping, dry-run trên bản sao, reconciliation, backup/restore/rollback được duyệt.
- Chức năng ký bệnh án, phát hành tài liệu, nhận tiền hộ, hoàn tiền và chứng từ phải qua gate chuyên môn/pháp lý/tài chính liên quan.

## 6. Chỉ số trạng thái tài liệu

`[LOCKED]`: bốn lựa chọn phạm vi ở trên; `[PROPOSED]`: thiết kế cần review; `[OPEN]`: thiếu quyết định; `[GATE]`: điều kiện phát hành. Các task trong P05 là `PLANNED`; test chưa chạy (`NOT RUN`). Không tuyên bố đã implement/integrate/verified/accepted từ tài liệu hoặc HTML prototype.

## 7. Nguồn tra cứu chi tiết

- PRD chuẩn: [`02_Product_Requirements/PRD_Clinic_Management_V2.md`](02_Product_Requirements/PRD_Clinic_Management_V2.md).
- Quyền: [`02_Product_Requirements/Role_Permission_Matrix.md`](02_Product_Requirements/Role_Permission_Matrix.md).
- Quyết định: [`02_Product_Requirements/Decision_Log.md`](02_Product_Requirements/Decision_Log.md) và [`03_Architecture_and_Database/10_ADR_and_Open_Decisions.md`](03_Architecture_and_Database/10_ADR_and_Open_Decisions.md).
- Kiến trúc: [`03_Architecture_and_Database/01_System_Architecture.md`](03_Architecture_and_Database/01_System_Architecture.md); tenancy: [`03_Architecture_and_Database/02_Multi_Tenancy_and_Authorization.md`](03_Architecture_and_Database/02_Multi_Tenancy_and_Authorization.md).
- Lộ trình và backlog: [`05_Implementation_Delivery/02_Vertical_Slice_Roadmap.md`](05_Implementation_Delivery/02_Vertical_Slice_Roadmap.md), [`05_Implementation_Delivery/03_Implementation_Backlog.md`](05_Implementation_Delivery/03_Implementation_Backlog.md).
- Nghiệm thu: [`02_Product_Requirements/Acceptance_Test_Matrix.md`](02_Product_Requirements/Acceptance_Test_Matrix.md), [`05_Implementation_Delivery/04_End_to_End_Test_Plan.md`](05_Implementation_Delivery/04_End_to_End_Test_Plan.md).
