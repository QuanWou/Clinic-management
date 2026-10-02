# Clinic V2 trên main và database hiện có

Ngày kiểm chứng: 2026-10-02, Asia/Bangkok. Phạm vi: bàn giao bản chạy local từ main với database cũ được bảo toàn và dữ liệu phòng khám để thử nghiệp vụ.

## Code và dữ liệu nguồn

- V2 từ `local-coder/clinic-management-v2-6820c6b7` đã được commit tại `27434d0` và fast-forward vào main local.
- Checkout chạy ứng dụng: `D:/MainDV/Clinic-management`.
- Các thay đổi V1 đang có trong checkout chính được giữ riêng. Snapshot phục hồi: `84873f8b0123ad97bc99e3f2cf8508941d1fb6be`, nhánh `codex/backup-primary-before-v2-20261002`.
- Database: `clinic_db`, PostgreSQL Docker tại `127.0.0.1:5432`, volume `clinic-management_postgres_data`.
- Backup custom-format trước migration: file riêng trong `v2/.runtime/main`; SHA256 `227D44571DD667FB972DDB44E2A1CAD23131CC06180D6AA3612792C4CB6B7FCA`.
- Kiểm chứng bằng `pg_restore --data-only` và so sánh COPY rows với database đang chạy: **40 bảng nguồn có toàn bộ dòng cũ nguyên vẹn**, bao gồm tất cả lịch sử Flyway V1. Auth có thêm dòng cho tài khoản được tạo và phiên đăng nhập mới.
- Số lượng nguồn được giữ: **526 bệnh nhân, 23 bác sĩ, 2.506 lịch hẹn**.

## Chạy V2 trên cùng database

V2 dùng schema/lịch sử Flyway riêng. Doctor chia sẻ schema `doctor` nhưng các bảng V1 và `flyway_schema_history` vẫn nguyên vẹn; V2 dùng `flyway_v2_schema_history`. Package xác thực Identity hiện có chạy với migration tắt và Hibernate validate. 13 login runtime không có SUPERUSER hoặc BYPASSRLS.

Một lần khởi chạy đầu tiên dừng khi package auth chưa có executable manifest, trong lúc các dịch vụ khác đã bắt đầu migrate. Appointment V10 có cấu trúc hoàn tất nhưng thiếu dòng lịch sử. Recovery đối chiếu 8 cột, 2 CHECK constraints, function và 2 triggers với chính SQL V10 được áp dụng trên temp objects; lấy checksum `-1797010146` bằng `ChecksumCalculator` của Flyway 10.10.0. Chỉ sau khi mọi định nghĩa khớp mới khôi phục dòng lịch sử trong transaction. Không sửa SQL migration đã phát hành, không xóa bảng/dữ liệu, không bỏ qua validation. Flyway sau đó validate và áp dụng V11 thành công. Launcher hiện chờ health từng dịch vụ trước khi mở dịch vụ tiếp theo.

## Bộ dữ liệu vận hành

Phòng khám An Nhiên, một địa điểm tại Long Biên, Hà Nội. Dữ liệu bổ sung là fixture local, sử dụng tên hiển thị thông thường; giấy phép riêng ghi rõ phạm vi kiểm thử, không phải phê duyệt chuyên môn thật.

| Dữ liệu V2 | Số lượng |
|---|---:|
| Hồ sơ bệnh nhân | 570 |
| Hồ sơ giữ ID từ V1 | 522 |
| Hồ sơ V1 thiếu ngày sinh, giữ tại nguồn | 4 |
| Tài khoản mới | 60 |
| Bác sĩ | 6 |
| Lịch làm việc tuần | 78 |
| Dịch vụ / phiên bản giá | 9 / 9 |
| Phòng nghiệp vụ | 7 |
| Lịch hẹn đã xác nhận | 60 |
| Lịch hẹn hôm nay lúc nạp dữ liệu | 12 |
| Lượt khám | 18 |
| Phiếu thu | 6 |
| Khoản thu / biên nhận | 4 |

Trạng thái lượt khám: 6 chờ khám, 4 đang khám (trong đó 2 có kết quả chờ bác sĩ đọc), 2 chờ xét nghiệm, 6 hoàn tất chuyên môn. Xét nghiệm: 2 đang xử lý, 2 đã trả kết quả, 6 đã được bác sĩ xem. Phiếu thu: 2 chưa trả, 1 trả một phần, 3 đã trả. Tất cả journals cân bằng, số tiền đã thu khớp payments. Source outbox không có DLQ/dead-letter tại lúc kiểm tra.

Tạo lịch hẹn, lượt khám, chỉ định, kết quả, hồ sơ nội bộ và thu phí qua service API thật. Nhân sự được mời/activate/grant phạm vi bằng IAM API. Patient V1 được sao chép bổ sung bằng transaction; dữ liệu nguồn không bị viết lại. Không suy diễn giá hoặc nhập giao dịch lịch sử V1 thiếu snapshot.

Chạy lại seeder giữ nguyên số lượng hồ sơ, bác sĩ, lịch tuần, dịch vụ, giá, phòng, lịch hẹn, lượt khám, phiếu thu và payments. Bản bổ sung thứ hai dùng hồ sơ trẻ em cho nhóm khám Nhi và bổ sung lịch hẹn hiện tại theo slot source còn trống.

## Kiểm chứng

- Build 12 V2 packages và package auth executable: PASS.
- Web build và 80 unit tests: PASS.
- 13 health endpoints: UP.
- Dừng/chạy lại từ root launcher với thứ tự dependency đã sửa: PASS; dữ liệu giữ nguyên và mọi source outbox không có dead-letter.
- 60 tài khoản: password login và phạm vi quyền canonical PASS.
- 8 vai trò qua trình duyệt thật: Owner, Manager, Reception, Doctor, Lab, Cashier, Patient, Platform PASS.
- Public hiển thị một phòng khám từ nguồn; chọn dịch vụ/bác sĩ đưa đúng dữ liệu sang booking; có slot thực. Kiểm tra không tràn ngang tại 1366, 1024 và 375 px.
- Doctor mở hồ sơ đã hoàn tất; nhãn danh sách phản ánh đúng trạng thái.
- Cashier mở phiếu đã trả, ca thu và biên nhận nội bộ bằng dữ liệu nguồn.
- Phiên đăng nhập giữ khi chuyển Workspace sang cài đặt rồi quay lại.

Scripts: `v2/scripts/verify-main.mjs`, `v2/scripts/verify-main-database.mjs`. Báo cáo không có mật khẩu và kết quả cuối nằm tại [Main_Database/verification.json](Main_Database/verification.json), [Main_Database/database-verification.json](Main_Database/database-verification.json). Log, ảnh các màn có dữ liệu bệnh nhân và file cấu hình có khóa được giữ riêng trong `.runtime/main`, không commit.

Kiểm tra restart phát hiện 2 projection events (Clinic, Doctor) vượt retry khi Search khởi động sau các publisher. Đã đưa Search/Audit/Notification lên trước publisher, dừng theo thứ tự ngược và dùng refresh 60 giây. Chỉ requeue 2 event có ID/trạng thái/attempts/error khớp lỗi khởi động sau khi health Search UP; giữ nguyên event ID, payload và source version. Worker phát lại theo cơ chế inbox/projection thông thường. Không có giao dịch khám hoặc thu phí nào bị phát lại. Kiểm tra cuối yêu cầu mọi source outbox có số dead-letter bằng 0.

Đặt lịch không cọc, hồ sơ nội bộ chưa ký và thu phí tại quầy theo quyết định Product Owner. Ký/phát hành, thanh toán online, chính sách cọc và các acceptance gate/cutover production vẫn chưa được chốt. Kết quả ở đây xác nhận bản chạy local và việc tích hợp database, không phải xác nhận toàn bộ sản phẩm đã được nghiệm thu.
