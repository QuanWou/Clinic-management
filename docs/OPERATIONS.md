# Vận hành 5 service core

Yêu cầu Java 21, Maven, Node.js, PowerShell 7 và database hiện có.

```powershell
pwsh -NoProfile -File scripts/stop.ps1
pwsh -NoProfile -File scripts/build-main.ps1
pwsh -NoProfile -File scripts/start.ps1
```

Website: http://127.0.0.1:4176. Launcher chạy 5 Java process nghiệp vụ, 1 Java process gateway và 1 Vite process. Gateway ở cổng 8090, tùy chỉnh qua `ports.gateway`. `start-main.ps1` chuyển tới launcher `start-core.ps1`. Dừng dựa trên PID, executable và thời điểm tạo để không dừng nhầm tiến trình.

Cấu hình bí mật ở `.runtime/main/config.json`; không commit. Cổng core lấy từ identity/doctor/patient/appointment/billing trong config, các cổng module cũ không còn được mở. Runtime state ở `.runtime/main/processes.json`.

Database `clinic_db` cổng 5432 là container `clinic-postgres`, volume `clinic-management_postgres_data`. Nếu cần, mở Docker Desktop rồi `docker start clinic-postgres`. PostgreSQL Windows cổng 5433 là instance khác. Không đổi database, reset volume hoặc chạy seed để khởi động. Launcher mới từ chối `-Seed`.

Các schema, role và bảng lịch sử Flyway cũ được giữ. Launcher cần quyền runtime hiện có đã được cấu hình; không phải công cụ tạo database mới từ đầu. Mỗi module giữ pool và role riêng.

Bản trước khi gộp nằm trong `.archive/before-five-core-20261005` (chứa cấu hình riêng, không commit). Khôi phục chỉ sau khi dừng runtime và đối chiếu source; không cần reset database.

Kiểm tra: `mvn -f backend/pom.xml test`, `npm --prefix frontend run build`, `node scripts/verify-front-desk.mjs`, `node scripts/verify-cashier-desk.mjs`. Các kiểm thử database ngoài cần sandbox riêng. Docker packaging chưa được xác minh trong đợt gộp này.
