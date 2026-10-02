# 01 — Chiến lược triển khai theo luồng hoàn chỉnh

## 1. Kết quả mong đợi
Sau khi **thực sự triển khai trong tương lai**, một lượt khám đi xuyên hai website và các microservices: công bố cơ sở → tìm kiếm → đăng ký/đặt lịch → lễ tân check-in → bác sĩ khám → chỉ định/trả kết quả → hoàn tất hồ sơ/kê đơn → thanh toán → patient portal → tái khám. Đồng thời hỗ trợ walk-in không có tài khoản/appointment. **Phase 05 hiện chỉ xác định đường đi, backlog và test plan; không tạo feature.**

## 2. Phạm vi P0
- Tổ chức/chi nhánh, duyệt công bố; phân quyền theo tenant/branch; hồ sơ bác sĩ, dịch vụ, giá, lịch làm việc.
- Public search + booking có chống tranh chấp slot; patient identity và quan hệ đại diện khi đã xác minh.
- Tiếp nhận tại quầy và walk-in, hàng đợi, lượt khám, trạng thái chờ xét nghiệm.
- Bệnh án draft/review/sign/version/release, đơn thuốc, hướng dẫn, tái khám.
- Thu trực tiếp và online theo **mô hình beneficiary/merchant được phê duyệt**, bill, partial, refund, settlement/reconciliation.
- Portal chỉ dữ liệu released; thông báo an toàn; audit; backup/restore; QA và cutover.

**Ngoài P0:** nội trú, phẫu thuật, telemedicine, tích hợp LIS/PACS production, kho dược nâng cao, BI nâng cao, tối ưu marketplace quảng cáo. Không dùng các tính năng P1 làm điều kiện giả cho P0.

## 3. Nguyên tắc kiến trúc phải giữ
- `Appointment` ≠ `Encounter` ≠ `Clinical Document` ≠ `Bill` ≠ `Payment`.
- Một `walk-in` tạo encounter với `appointment_id=null`, không tạo lịch giả.
- Global identity không làm dữ liệu của phòng khám A tự động khả dụng tại B; mọi staff mutation cần tenant + branch + object scope được backend kiểm chứng.
- Mỗi service sở hữu dữ liệu của mình; không join trực tiếp xuyên DB để thực hiện nghiệp vụ.
- Source-of-truth cho slot là Appointment, cho hồ sơ/ký là Medical, cho ledger là Billing; public search/portal projection có thể eventual nhưng action phải revalidate nguồn.
- Side effect có retry phải idempotent; event theo outbox/inbox; giữ audit; giảm thiểu PHI trong log/event/notification.
- Không xem prototype HTML là bằng chứng auth/payment/security production.

## 4. Cách vận hành theo vertical slice
Mỗi slice tạo **một kết quả thấy được** từ UI → BFF/API → owner service → dữ liệu → event/consumer → quyền → lỗi → test → evidence. Chỉ khi slice đạt gate mới chuyển sang tính năng mở rộng. Việc dựng `shell` và hạ tầng nền ở S0 là ngoại lệ có chủ đích, không biến thành giai đoạn code tất cả dashboard.

## 5. Vai trò phê duyệt và ownership
- PO: phạm vi, thứ tự và acceptance; Clinic Lead: điều phối vận hành; Medical Lead: biểu mẫu/chuyên môn/ký; Finance/Accounting + Legal: merchant, refund, chứng từ, settlement; Privacy/Security: quyền dữ liệu; Tech Lead/owners: contracts và tích hợp; QA Lead: ma trận/evidence; UX Lead: thao tác & accessibility.
- Mỗi requirement và defect có owner, priority, phụ thuộc và ngày quyết định; không đặt tên người cá nhân khi chưa được phân công.

## 6. Hợp đồng và tiêu chí đầu vào
Trước mỗi slice: story + FR/AT/UX IDs; mock và copy trạng thái; API/event schema có owner; test data/negative paths; quyết định OPEN ảnh hưởng đến nó được duyệt hoặc dùng mock có gắn nhãn, **không phát hành production khi chưa duyệt**.

## 7. Môi trường kế hoạch (chưa khởi tạo)
Development → Integration sandbox → Staging isolated với synthetic data → Controlled pilot (sau pháp lý, migration rehearsal, consent/phân quyền) → Rollout. Tài khoản sandbox không tái sử dụng khóa/credential production. Không dùng dữ liệu y tế thật cho mock, screenshot, fixtures hoặc demo công khai.

## 8. Định nghĩa hoàn thành
`IMPLEMENTED` chỉ khi có source thực tế; `INTEGRATED` chỉ khi API/event nối thành công; `VERIFIED` chỉ khi kết quả test có evidence; `ACCEPTED` khi owner ký. Tất cả task trong gói này hiện `PLANNED`, mọi test `NOT RUN`.
