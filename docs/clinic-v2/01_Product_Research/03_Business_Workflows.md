# 03 — Business Workflows
## WF-01 Onboarding phòng khám
Owner đăng ký -> nộp thông tin pháp lý/giấy phép và cơ sở -> nền tảng kiểm tra -> duyệt/từ chối/yêu cầu bổ sung -> tạo tenant -> cấu hình chi nhánh, nhân sự, chuyên khoa, dịch vụ, giá, lịch -> kiểm tra sẵn sàng -> công bố trang public.
Không tự công bố cơ sở khi hồ sơ chưa được duyệt.

## WF-02 Public discovery & booking
Tìm theo vị trí/chuyên khoa/dịch vụ/bác sĩ -> xem hồ sơ đã công bố, giá và lịch -> chọn chi nhánh/dịch vụ/slot -> nhập/đăng nhập và chọn người khám -> giữ slot tạm -> xác nhận và xử lý đặt cọc nếu có -> tạo appointment -> gửi xác nhận.
Nếu payment timeout, dùng trạng thái chờ và cơ chế giải phóng giữ chỗ; tránh đặt trùng.

## WF-03 Walk-in
Lễ tân tra cứu bằng thông tin phù hợp -> xác minh và chống tạo trùng -> tạo hoặc liên kết patient -> chọn dịch vụ/bác sĩ/chi nhánh -> tạo visit/encounter với nguồn walk-in -> xếp hàng -> tiếp nhận. Không bắt buộc tạo appointment trước.

## WF-04 Check-in và hàng đợi
Xác minh người đến -> đối chiếu lịch/điều kiện khám -> check-in -> cấp queue ticket theo ngày/điểm phục vụ -> gọi lượt -> bác sĩ bắt đầu khám. Late/no-show/cancel/transfer cần lịch sử sự kiện.

## WF-05 Clinical encounter
Mở encounter -> triệu chứng/tiền sử/dị ứng/sinh hiệu -> khám/chẩn đoán sơ bộ -> chỉ định cận lâm sàng nếu cần -> thực hiện và trả kết quả -> bác sĩ xem lại -> chẩn đoán kết luận -> đơn thuốc/hướng dẫn/tái khám -> xác nhận hồ sơ. Bệnh án đã xác nhận sửa bằng bổ sung có truy vết, không ghi đè âm thầm.

## WF-06 Billing hybrid
Dịch vụ phát sinh tạo charge -> bill tổng hợp khoản phải thu -> thu trực tiếp (tiền mặt/chuyển khoản/POS) hoặc online -> webhook xác thực, idempotency -> phân bổ payment vào charge -> biên nhận/hóa đơn theo quy trình phù hợp -> hoàn tiền/đối soát nếu có. Platform collection và clinic collection phải tách ledger và chủ thể nhận tiền.

## WF-07 Sau khám
Bác sĩ công bố tài liệu được phép -> patient portal hiển thị -> nhắc tái khám -> tạo lịch mới có liên kết encounter trước. Không công bố ghi chú nội bộ theo mặc định.

## WF-08 Chốt ca
Lễ tân/thu ngân bàn giao lượt chưa hoàn tất -> đối chiếu tiền mặt, chuyển khoản, online, hoàn tiền -> lập báo cáo chênh lệch -> khóa/chốt ca có người xác nhận. Encounter đang chờ kết quả không được tự đóng chỉ vì hết ngày.
