# 02 — Roles and Permissions
## Phân tách danh tính và phạm vi
Identity user là tài khoản nền tảng. Membership = user + clinic + branch (tùy quyền) + role + thời hạn hiệu lực. Doctor assignment có lịch và phạm vi hành nghề riêng. Patient identity có thể dùng chung; encounter/clinical record thuộc cơ sở sở hữu dữ liệu.

| Vai trò | Quyền nghiệp vụ | Giới hạn |
|---|---|---|
| Platform admin | Duyệt hồ sơ cơ sở, vận hành marketplace, gói SaaS | Không mặc nhiên xem bệnh án |
| Clinic owner | Cấu hình tenant, quản lý quản trị viên, báo cáo | Không tự động được xem chi tiết bệnh án |
| Clinic manager | Cấu hình chi nhánh, nhân sự, lịch, giá, báo cáo | Theo tenant/branch |
| Receptionist | Đặt/đổi lịch, check-in, walk-in, hàng đợi | Chỉ dữ liệu hành chính cần thiết |
| Cashier | Thu/hoàn tiền được duyệt, chứng từ, chốt ca | Không chỉnh sửa chẩn đoán |
| Doctor | Xem bệnh nhân được phân công, khám, chỉ định, kê đơn, xác nhận | Theo nhiệm vụ và encounter |
| Nurse | Sinh hiệu, công việc điều dưỡng được giao | Không ký thay bác sĩ |
| Lab staff | Nhận chỉ định, nhập/trả kết quả được phân công | Không xem toàn bộ hồ sơ |
| Patient/guardian | Lịch hẹn, hồ sơ/tài liệu được công bố | Theo quan hệ và quyền hợp lệ |

## Kiểm soát bắt buộc [PROPOSED]
- Backend xác minh user, tenant, branch, role, relationship, record scope tại từng request.
- Không tin clinic_id/branch_id do frontend tự gửi.
- Tách quyền đọc thông tin hành chính, dữ liệu lâm sàng, thông tin tài chính.
- Mọi thao tác nhạy cảm ghi audit actor, action, object, tenant, time, reason.
- Thu hồi membership phải vô hiệu quyền ngay; hỗ trợ nhân sự nhiều phòng khám.
- Quy trình truy cập khẩn cấp (break-glass) cần phê duyệt, lý do và giám sát riêng nếu triển khai.
