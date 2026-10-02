# Chạy Clinic V2 từ main

Public giới thiệu một phòng khám, Workspace cho nhân sự phòng khám, Platform cho quản trị nền tảng. Địa điểm khám vẫn là dữ liệu nghiệp vụ cho lịch khám, hàng đợi và thu phí.

## Chạy trên máy hiện tại

Tại thư mục gốc repository, dùng PowerShell 7:

```powershell
pwsh -NoProfile -File v2/scripts/build-main.ps1
pwsh -NoProfile -File scripts/start.ps1
```

- Public: http://127.0.0.1:4176/public
- Workspace: http://127.0.0.1:4176/workspace
- Platform: http://127.0.0.1:4176/platform
- Đăng nhập chung: http://127.0.0.1:4176/login

`start-main.ps1` đọc cấu hình riêng tại `v2/.runtime/main/config.json`. File này chứa thông tin kết nối, khóa workload/JWT và tài khoản test; đã được Git bỏ qua. Khi chưa có file cấu hình, launcher dừng trước khi ghi database. Trên máy đã cấu hình, chỉ cần lệnh start; build lại khi source thay đổi.

```powershell
# Bổ sung bộ dữ liệu phòng khám bằng API, có lưu tiến độ để chạy lại.
pwsh -NoProfile -File scripts/start.ps1 -Seed

# Kiểm tra health, quyền tài khoản và trình duyệt trên dữ liệu thật trong DB.
node v2/scripts/verify-main.mjs
node v2/scripts/verify-main-database.mjs

# Dừng các tiến trình thuộc launcher này, giữ PostgreSQL và dữ liệu.
pwsh -NoProfile -File v2/scripts/stop-main.ps1
```

Launcher kiểm tra PID, thời điểm khởi động và executable trước khi dừng tiến trình. Cổng đang có tiến trình khác sử dụng sẽ gây lỗi rõ ràng. Khi khởi chạy thất bại, xem log riêng trong `.runtime/main`, sửa nguyên nhân, chạy `stop-main.ps1` rồi start lại.

Search, Audit và Notification được chờ healthy trước các service phát event tới chúng. Khi dừng, launcher xử lý theo thứ tự ngược lại. Refresh theo thời gian của Public projection dùng chu kỳ 60 giây; thay đổi dữ liệu vẫn phát event ngay qua transactional outbox.

## Database hiện có

Database của main là `clinic_db`, PostgreSQL tại `127.0.0.1:5432`, container `clinic-postgres`, volume `clinic-management_postgres_data`. PostgreSQL Windows tại cổng 5433 là instance khác. Nếu container đã dừng, khởi động container hiện có bằng `docker start clinic-postgres`.

V2 dùng cùng database, các schema riêng `iam`, `clinic`, `catalog_v2`, `patient_v2`, `appointment_v2`, `search_v2`, `encounter_v2`, `medical_v2`, `billing_v2`, `notification_v2`, `audit_v2`; Doctor có các bảng V2 trong schema `doctor`. Mỗi schema V2 dùng `flyway_v2_schema_history`, không ghi đè `flyway_schema_history` của V1. Các schema cũ không bị xóa.

Xác thực mật khẩu tiếp tục dùng `identity.users` hiện có. Package Identity này chạy với Flyway tắt và Hibernate validate. Mỗi V2 service chạy bằng login riêng không có SUPERUSER/BYPASSRLS; quyền migration được cung cấp riêng. V2 áp dụng migration từ version 1, với baseline 0 cho schema đã có bảng V1.

Phải giữ bản sao lưu PostgreSQL trước migration. Cấu hình `databaseBackup` trỏ tới file dump custom-format và `backupSha256` lưu hash SHA256 đã kiểm tra. Không reset database để nạp dữ liệu test.

## Dữ liệu để thử nghiệp vụ

Seeder tạo Phòng khám An Nhiên với 6 bác sĩ, 9 dịch vụ có phiên bản giá, 7 phòng nghiệp vụ, 48 tài khoản bệnh nhân, 60 lịch hẹn không cọc và 18 lượt khám. 48 lịch hẹn ở các ngày tiếp theo; 12 lịch hẹn ưu tiên giờ còn trống hôm nay, chuyển sang ngày tiếp theo nếu đã hết giờ khám. Nhóm đặt khám Nhi có ngày sinh trẻ em. Các lượt khám đi qua API thật: chờ khám, đang khám, chờ xét nghiệm, kết quả chờ bác sĩ đọc, hồ sơ nội bộ hoàn tất, phiếu thu chưa trả/trả một phần/đã trả. Hàng đợi tuân thủ thứ tự gọi và một lượt phục vụ trên mỗi phòng.

Tên hiển thị dùng tên người, chuyên khoa và dịch vụ thông thường. Dữ liệu bổ sung là dữ liệu giả lập để kiểm thử phần mềm tại máy local. Thông tin giấy phép riêng ghi rõ phạm vi kiểm thử; không đại diện cho giấy phép hoặc phê duyệt chuyên môn thật. Những thông tin này không dùng làm nội dung quảng bá Public.

Hồ sơ bệnh nhân V1 có ngày sinh hợp lệ được sao chép giữ nguyên ID vào V2, cùng liên kết tài khoản và liên kết phòng khám. Nguồn V1 vẫn được giữ. Lịch hẹn, hồ sơ khám và khoản thu cũ chưa được chuyển thành giao dịch V2 vì thiếu chứng cứ snapshot giá và trạng thái phù hợp; không suy diễn dữ liệu lịch sử.

Email test chính: `owner@annhien.local`, `manager@annhien.local`, `reception@annhien.local`, `doctor@annhien.local`, `lab@annhien.local`, `cashier@annhien.local`, `patient@annhien.local`, `platform@annhien.local`. Mật khẩu có trong file cấu hình riêng và được cung cấp khi bàn giao. Tài khoản bệnh nhân cũ giữ nguyên mật khẩu.

Đặt lịch không cọc, hồ sơ khám nội bộ chưa ký và thu phí tại quầy được bật theo quyết định Product Owner. Ký/phát hành hồ sơ, thanh toán online và chính sách cọc vẫn chưa bật. Kiểm chứng local không thay thế các acceptance gate/cutover cho production.
