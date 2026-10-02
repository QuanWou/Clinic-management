# 01 — Product Discovery
## Tuyên bố sản phẩm
Một nền tảng hai mặt: bệnh nhân tìm kiếm/đặt lịch tại phòng khám đa khoa; cơ sở đăng ký và sử dụng workspace SaaS quản lý hoạt động khám ngoại trú.

## Đối tượng
- Bệnh nhân/người giám hộ; khách chưa đăng ký.
- Chủ phòng khám, quản lý chi nhánh, lễ tân, bác sĩ, điều dưỡng, thu ngân; nhân sự xét nghiệm/dược khi có.
- Platform operations: duyệt hồ sơ cơ sở, hỗ trợ, quản lý gói dịch vụ, xử lý khiếu nại, không mặc nhiên truy cập hồ sơ bệnh án.

## Giá trị
- Bệnh nhân: thông tin cơ sở minh bạch, lịch hẹn có xác nhận, lịch sử và tài liệu sau khám.
- Phòng khám: lịch/tiếp nhận/hàng đợi/lượt khám/thu phí nhất quán; kiểm soát nhiều chi nhánh.
- Nền tảng: onboarding, công bố thông tin đã xác minh, đối soát thanh toán, quản lý tenant.

## Phạm vi P0
Onboard và duyệt phòng khám; cấu hình chi nhánh, chuyên khoa, bác sĩ, dịch vụ/giá, lịch; public search; đặt lịch; walk-in; check-in; hàng đợi; encounter; khám, chỉ định, kết quả, kê đơn; thu phí trực tiếp và online; biên nhận; patient portal; audit/authorization.

## Không thuộc P0
Nội trú, phẫu thuật, cấp cứu điều phối, bảo hiểm y tế điện tử, telemedicine, kho dược đầy đủ, tích hợp LIS/PACS thực tế, marketplace quảng cáo xếp hạng trả phí. Có thể thiết kế điểm mở rộng.

## Giả thuyết cần kiểm chứng
- [VERIFY] Phòng khám có cho bệnh nhân chọn bác sĩ hay chỉ chọn chuyên khoa?
- [VERIFY] Thu tiền khám trước hay sau, tiền xét nghiệm và thuốc thu tại quầy nào?
- [VERIFY] Có nhiều quầy tiếp nhận/thu ngân, phòng khám, máy xét nghiệm?
- [VERIFY] Cơ sở tự tạo hồ sơ trên nền tảng hay cần kiểm duyệt thủ công?
- [VERIFY] Cơ sở có dùng chung bệnh nhân xuyên chi nhánh không?
- [VERIFY] Chính sách đặt cọc, hủy/hoàn tiền và hoa hồng nền tảng.
## Thước đo sản phẩm
Tỷ lệ đặt lịch thành công, no-show, thời gian chờ, thời gian hoàn tất lượt khám, tỷ lệ đối soát thành công, số sự cố lộ dữ liệu xuyên tenant.
