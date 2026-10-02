# Clinic Management System

## Ứng dụng hiện tại: Clinic V2

Chạy Public cho bệnh nhân, Workspace cho một phòng khám và Platform riêng từ code V2 trên nhánh `main`. Database hiện dùng là PostgreSQL `clinic_db` của main, với dữ liệu cũ được giữ và dữ liệu vận hành phòng khám được bổ sung.

```powershell
pwsh -NoProfile -File v2/scripts/build-main.ps1
pwsh -NoProfile -File scripts/start.ps1
```

Mở [Public](http://127.0.0.1:4176/public), [Workspace](http://127.0.0.1:4176/workspace) hoặc [Platform](http://127.0.0.1:4176/platform). Xem [cách chạy, dữ liệu và tài khoản V2](v2/MAIN.md). Đặt lịch không cọc, khám nội bộ chưa ký và thu phí tại quầy được bật; ký/phát hành và thanh toán online chưa bật.

## Legacy V1 reference
Micro-service based platform for managing clinics. Built with **Java 21**, **Spring Boot 3**, **PostgreSQL**, and **Docker Compose**. Includes implemented identity, patient, doctor, appointment, medical record, billing, and notification service foundations.

## Architecture Docs
- [Root system prompt](system_prompt.md)
- [AI system prompt](docs/ai-system-prompt.md)
- [Architecture overview](docs/architecture-overview.md)
- [Backend service standard](docs/backend-service-standard.md)
- [Project structure](docs/project-structure.md)
- [Service interaction guide](docs/service-interaction.md)
- [API contract](docs/api-contract.md)
- [ERD](docs/erd.md)
- [Roadmap](docs/roadmap.md)
- [Testing and smoke checks](docs/testing.md)

## Legacy V1 quick start (reference)
```bash
# Start PostgreSQL, backend services, API Gateway, Prometheus, and Grafana
docker compose up --build

# Verify all backend modules
cd backend
mvn clean test
```

Local URLs:

- API Gateway: `http://localhost:8090`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3000` (`admin` / `admin`)

Stop the stack:

```bash
docker compose down
```
