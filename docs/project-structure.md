# Project Structure

## 1. Root Layout

```text
clinic-management/
  README.md
  CLAUDE.md
  docs/
  backend/
  frontend/
  infra/
  .claude/
```

| Path | Purpose |
| --- | --- |
| `README.md` | Short project intro and quick start |
| `CLAUDE.md` | Persistent AI agent context and rules |
| `docs/` | Product, architecture, API, ERD, roadmap, and development standards |
| `backend/` | Java Spring Boot Maven multi-module backend |
| `frontend/` | Reserved for frontend implementation |
| `infra/` | Reserved for Docker, compose, observability, deployment assets |
| `.claude/` | Local Claude settings |

## 2. Backend Parent Module

```text
backend/
  pom.xml
  common-lib/
  api-gateway/
  identity-service/
  patient-service/
  doctor-service/
  appointment-service/
  medical-record-service/
  billing-service/
  notification-service/
```

The parent `backend/pom.xml` manages:

- module list
- Java version 21
- Spring Boot dependency versions
- Spring Cloud dependency versions
- compiler plugin configuration
- Lombok and MapStruct annotation processors

## 3. Common Library

```text
backend/common-lib/src/main/java/com/clinic/common/
  constants/
    ErrorCode.java
  dto/
    ApiResponse.java
    ErrorResponse.java
  exception/
    BusinessException.java
```

Use `common-lib` for shared contracts that are stable across services. Keep it small. Do not put service-specific business logic in `common-lib`.

Good candidates:

- response wrappers
- error code constants
- shared exception base classes
- small immutable utility contracts

Bad candidates:

- appointment business rules
- doctor schedule rules
- service-specific repositories
- JPA entities for service-owned tables

## 4. Service Package Standard

For service `appointment-service`, package root should be:

```text
com.clinic.appointment
```

Recommended package layout:

```text
com/clinic/appointment/
  AppointmentServiceApplication.java
  client/
  config/
  controller/
  dto/
  entity/
  exception/
  mapper/
  repository/
  security/
  service/
    AppointmentService.java
    impl/
      AppointmentServiceImpl.java
```

## 5. Current Implemented Service Shapes

### identity-service

Owns:

- users
- roles
- refresh tokens
- JWT generation and authentication flow

Important packages:

- `controller`: `AuthController`, `UserController`
- `service`: `AuthService`
- `security`: JWT filter, JWT service, user details, current principal
- `entity`: `User`, `Role`, `RefreshToken`
- `repository`: user, role, refresh token repositories
- `exception`: global exception handler

### patient-service

Owns:

- patient profile table
- mapping between authenticated identity user and patient profile

Important packages:

- `controller`: `PatientController`
- `service`: `PatientService`
- `entity`: `Patient`
- `repository`: `PatientRepository`
- `dto`: `UpdatePatientRequest`, `PatientProfileResponse`
- `security`: local JWT validation and current principal

### doctor-service

Owns:

- doctor profile
- specialties
- schedules

Important packages:

- `controller`: `DoctorController`
- `service`: `DoctorService`
- `entity`: `Doctor`, `Specialty`, `Schedule`
- `repository`: doctor, specialty, schedule repositories
- `dto`: `UpdateDoctorRequest`, `DoctorProfileResponse`
- `security`: local JWT validation and current principal

### appointment-service

Owns:

- appointment lifecycle table
- booking, listing, cancellation, confirmation, and completion workflow
- patient profile resolution through `patient-service`
- doctor schedule availability checks through `doctor-service`

Important packages:

- `entity`: `Appointment`, `AppointmentStatus`
- `dto`: `CreateAppointmentRequest`, `AppointmentResponse`
- `repository`: appointment lookup and overlap checks
- `service`: `AppointmentService`, `AppointmentServiceImpl`
- `client`: `PatientClient`, `DoctorClient`
- `exception`: global handler aligned with existing services
- `security`: JWT config aligned with patient/doctor services

### medical-record-service

Owns:

- medical record table linked to completed appointments
- prescription and prescription item tables
- doctor/admin record creation workflow
- patient, doctor, receptionist, and admin read authorization rules

Important packages:

- `controller`: `MedicalRecordController`
- `service`: `MedicalRecordService`, `MedicalRecordServiceImpl`
- `entity`: `MedicalRecord`, `Prescription`, `PrescriptionItem`
- `repository`: medical record, prescription, and prescription item repositories
- `dto`: create record, prescription item, and response DTOs
- `client`: appointment, doctor, and patient clients
- `exception`: global handler aligned with existing services
- `security`: JWT config aligned with patient/doctor/appointment services

### billing-service

Owns:

- invoice table linked to completed appointments
- invoice generation and payment state transitions
- patient, receptionist, and admin invoice access rules

Important packages:

- `controller`: `BillingController`
- `service`: `BillingService`, `BillingServiceImpl`
- `entity`: `Invoice`, `InvoiceStatus`, `PaymentMethod`
- `repository`: `InvoiceRepository`
- `dto`: create invoice, pay invoice, and response DTOs
- `client`: appointment and patient clients
- `exception`: global handler aligned with existing services
- `security`: JWT config aligned with other resource services

## 6. Notification Service

### notification-service

Owns:

- notification request persistence
- notification delivery status tracking
- email/SMS/push delivery foundation

Important packages:

- `controller`: `NotificationController`
- `service`: `NotificationService`, `NotificationServiceImpl`
- `entity`: `Notification`, `NotificationType`, `NotificationStatus`
- `repository`: `NotificationRepository`
- `dto`: `NotificationRequest`, `NotificationResponse`
- `security`: local JWT validation and current principal

Future packages when RabbitMQ/Kafka and real providers are introduced:

- `provider`: email/SMS/push provider integrations
- `consumer`: broker consumers

## 7. Resource Files

Every database-backed service should contain:

```text
src/main/resources/
  application.yml
  db/migration/
    V1__create_<domain>_tables.sql
```

Rules:

- `application.yml` defines service port, application name, datasource, JPA validate mode, Flyway schema, and actuator exposure.
- migrations define tables, indexes, constraints, and default timestamps.
- secrets in local files are acceptable only for development; production secrets belong in environment variables or secret stores.

## 8. Where To Add New Code

| Need | Put code here |
| --- | --- |
| New API endpoint | `<service>/controller` |
| Request or response payload | `<service>/dto` |
| Business rule | `<service>/service` or `<service>/service/impl` |
| Database access | `<service>/repository` |
| Database table mapping | `<service>/entity` |
| DB schema change | `<service>/src/main/resources/db/migration` |
| Cross-service HTTP call | `<service>/client` |
| Security config/principal/JWT filter | `<service>/security` |
| Service-specific exception mapping | `<service>/exception` |
| Shared response/error primitive | `common-lib` |

## 9. Naming Conventions

Packages:

```text
com.clinic.<service>
```

Classes:

- Controller: `<Domain>Controller`
- Service interface: `<Domain>Service`
- Service implementation: `<Domain>ServiceImpl`
- Repository: `<Entity>Repository`
- Request DTO: `<Action><Entity>Request`
- Response DTO: `<Entity>Response`
- Entity enum: `<Domain>Status`, `<Domain>Type`
- Feign client: `<RemoteDomain>Client`

Database:

- tables: snake_case plural nouns
- columns: snake_case
- indexes: `idx_<table>_<columns>`
- unique constraints: `uk_<table>_<business_key>`
- foreign keys inside same schema: `fk_<table>_<target>`
