# Chạy trên IntelliJ IDEA

Mở thư mục gốc `Clinic-management`. Các cấu hình trong `.run/` xuất hiện ở
menu Run trên thanh công cụ:

- **Clinic - Run All**: kiểm tra Java 21 và PostgreSQL, build backend/frontend,
  rồi chạy 5 core, API Gateway và Vite. Nếu ứng dụng đang chạy, kiểm tra sức khỏe
  và dùng lại các tiến trình đó.
- **Clinic - Stop All**: dừng các tiến trình thuộc dự án. Database tiếp tục chạy.
- **Clinic - Build All**: chỉ build backend và frontend.

Chọn **Clinic - Run All**, bấm nút tam giác xanh hoặc `Shift+F10`.
Khi console hiện `Five cores ready`, mở:

- Bệnh nhân: <http://127.0.0.1:5173/public>
- Nhân viên: <http://127.0.0.1:5173/workspace>

Các dịch vụ chạy nền sau khi launcher hoàn tất. Để dừng, chọn **Clinic - Stop All**
và bấm Run. Sau khi sửa code, chạy Stop All rồi Run All để build và khởi động lại.
Log từng dịch vụ nằm trong `.runtime/main/<service>.log` và `.stderr`.

## Cấu hình máy này

- Project SDK: **21** (`C:/Program Files/Zulu/zulu-21`).
- Maven: chỉ nạp `backend/pom.xml`; không nạp POM trong `exports`, `.archive`,
  `.runtime` hoặc `.sandbox`. Chọn **Reload All Maven Projects** sau khi mở lại dự án.
- Run Configuration dùng plugin **Shell Script** có sẵn trong bản IntelliJ đã cài.
  Interpreter là PowerShell 7 đi kèm runtime Codex trên máy này.
- `JAVA_HOME` của Run/Build trỏ tới JDK 21. Java, Maven và Node.js phải có trong PATH.
- Kết nối và bí mật được đọc từ `.runtime/main/config.json`, không lưu trong `.run/`.
- Máy này dùng cổng web **5173** vì Windows giữ dải cổng 4138–4237, bao gồm 4176.
  Launcher truyền cổng trong cấu hình riêng cho Vite; URL thực tế được in ra console.
- Nếu container `clinic-postgres` đã tồn tại và đúng cổng cấu hình, launcher tự bật
  container khi cần. Nó không tạo database mới hay xóa volume.

Nếu menu Run chưa cập nhật, đóng rồi mở lại project. Khi dùng máy khác, sửa
**Interpreter path** thành đường dẫn `pwsh.exe` của PowerShell 7 và sửa
`JAVA_HOME` thành thư mục JDK 21 trong **Run → Edit Configurations**.
