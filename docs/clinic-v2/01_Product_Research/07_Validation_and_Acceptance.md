# 07 — Validation and Acceptance
## Kế hoạch phỏng vấn
- 1–2 chủ/quản lý phòng khám: onboarding, cơ cấu chi nhánh, doanh thu, phân quyền.
- 2 lễ tân/thu ngân: giờ cao điểm, walk-in, no-show, chốt ca, thanh toán.
- 2 bác sĩ: bệnh án, chỉ định, kết quả, đơn thuốc, xác nhận.
- 3–5 bệnh nhân: tìm kiếm, đặt lịch, người thân, kết quả, hoàn tiền.
Mỗi nhóm: quan sát thao tác thực tế, ghi tình huống ngoại lệ, xác minh dữ liệu đầu vào/đầu ra và người chịu trách nhiệm.

## Hai E2E bắt buộc
A. Public search -> booking -> payment nếu áp dụng -> check-in -> encounter -> clinical order/result -> prescription -> bill/settlement -> patient portal.
B. Walk-in -> patient matching -> check-in -> queue -> encounter -> order/result -> prescription -> onsite payment -> portal.

## Tiêu chí exit phase 01
- 2 hành trình được stakeholder duyệt.
- Vai trò và quyền theo tenant/branch được duyệt.
- Business rules và state transitions có owner, exception, acceptance.
- Payment collection/refund/settlement có mô hình tiền và chủ thể nhận tiền.
- Compliance matrix có người chịu trách nhiệm xác minh.
- V1 gap có evidence từ source hoặc ghi rõ chưa xác minh.
- Danh sách quyết định mở được chốt hoặc chuyển thành risk có owner.

## Open decisions
1. Booking deposit bắt buộc/tùy phòng khám?
2. Phòng khám thu trực tuyến qua merchant riêng hay nền tảng nhận hộ?
3. Refund ai duyệt, ai thực hiện, SLA?
4. Bác sĩ chọn theo tên hay hệ thống phân tự động?
5. Patient identity matching theo dữ liệu nào?
6. Lab/pharmacy nội bộ hay đối tác?
7. Chi nhánh chia sẻ hồ sơ theo chính sách nào?
8. Các loại giấy phép/phạm vi chuyên môn được phép hiển thị công khai?
