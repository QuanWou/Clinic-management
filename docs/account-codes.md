# Mã tài khoản và mã hồ sơ (local Clinic Management)

## Quy ước và tính bất biến

- `identity.users.account_code`: `TK000001`, ...; mã công khai của tài khoản, duy nhất trong Identity.
- `patient.patients.patient_code`: `BN000001`, ...; mã hồ sơ bệnh nhân, duy nhất trong Patient. Bệnh nhân vãng lai vẫn có mã BN nhưng không bắt buộc có tài khoản TK.
- `doctor.doctors.doctor_code`: `BS000001`, ...; mã hồ sơ bác sĩ, duy nhất trong Doctor. Bác sĩ được liên kết với tài khoản Identity qua `user_id`.
- **Không dùng mã TK/BN/BS làm JWT subject, mật khẩu, token, khóa chính hoặc khóa ngoại xuyên service.** UUID `id`, `user_id`, `patient_id`, `doctor_id` vẫn là các liên kết máy-đọc chính thức. Tài khoản và mật khẩu BCrypt chỉ thuộc `identity.users`; không đồng bộ mật khẩu vào schema patient/doctor.
- Đăng nhập hiện tại vẫn bằng **email + mật khẩu**, không phải mã TK. Mã TK không phải bí mật xác thực. Mã không được đổi hoặc tái sử dụng sau khi cấp; chuỗi thứ tự có thể có khoảng trống do transaction rollback (bình thường với sequence).

## Triển khai

Flyway đã triển khai trên `clinic_db`: Identity V5, Patient V3, Doctor V5. Mỗi migration thêm một sequence riêng, backfill mã cho dữ liệu cũ, sau đó đặt default tại PostgreSQL với UNIQUE, NOT NULL và CHECK. Không sửa lịch sử migration, UUID, mật khẩu hoặc lịch hẹn/bệnh án. Hibernate lấy lại mã do database tạo với `@Generated(event = INSERT)`. API Auth, /users/me, quản lý người dùng, bác sĩ và bệnh nhân trả thêm thuộc tính `accountCode`, `doctorCode`, `patientCode` tương ứng; các trường UUID cũ giữ nguyên. Frontend sử dụng mã này trong trang cài đặt, bảng và chi tiết hồ sơ; màn hình tạo bác sĩ vẫn yêu cầu UUID account theo API cũ và ghi rõ đó là UUID.

## Tài khoản test bốn vai trò

Chỉ chạy một lần trong database phát triển chưa có bốn email QA: `scripts/provision-test-logins.ps1` từ thư mục project với Docker Compose đang chạy và các migration đã thành công. Script tạo một QA account cho từng role ADMIN/DOCTOR/RECEPTIONIST/PATIENT, một hồ sơ bác sĩ + 10 ca và một hồ sơ bệnh nhân tương ứng. Bốn mật khẩu riêng được tạo bằng bộ sinh số ngẫu nhiên mật mã, lưu hash BCrypt trong database và ghi thông tin đăng nhập ở **`%LOCALAPPDATA%\ClinicManagement\test-accounts.json`** bên ngoài repository, chỉ cho Windows user hiện tại đọc. Không in mật khẩu ra màn hình/log; không đặt mật khẩu mặc định chung và không sửa mật khẩu người dùng trước đó. Email mẫu thuộc `@example.invalid` nên không nhận mail. Script từ chối chạy lại thay vì đổi mật khẩu ngoài ý muốn.

Không đưa file `test-accounts.json` vào Git hoặc báo cáo công khai. Chỉ dùng trong môi trường local/test; không mang mã nguồn seed và tài khoản QA vào production. Nếu credentials cục bộ bị mất, dùng quy trình đặt lại mật khẩu có kiểm soát, không thực thi script lại trên dữ liệu sẵn có.

## Kiểm tra an toàn

```powershell
Get-Content -Raw -Encoding UTF8 .\scripts\audit-account-identifiers.sql | docker compose exec -T postgres psql -X -U postgres -d clinic_db -v ON_ERROR_STOP=1
.\scripts\smoke.ps1
```

Tại lần triển khai này, số lượng sau khi bổ sung QA: 132 tài khoản, 515 bệnh nhân, 23 bác sĩ; mọi hàng đều có mã duy nhất; cả bốn role có một QA account; doctor/patient QA có hồ sơ liên kết; 0 bệnh án lệch patient/doctor. Unit tests ba backend modules thành công và frontend/Gateway smoke thành công. Kiểm thử đăng nhập với mật khẩu theo E2E **chưa thực hiện được do giới hạn kiểm soát thao tác truy cập thông tin đăng nhập**; không diễn giải các phép kiểm tra DB/health là xác minh login thực tế.
