# Backend Service Development Standard

This document defines the default standard for new backend code in every Spring Boot service.

## 1. Module Structure

Use this structure for each service:

```text
src/main/java/com/clinic/<service>/
  <Service>Application.java
  config/
  controller/
  dto/
  entity/
  exception/
  repository/
  security/
  service/
    <DomainService>.java
    impl/
      <DomainServiceImpl>.java
  client/
  mapper/
src/main/resources/
  application.yml
  db/migration/
```

For small existing services, a single `service/<Name>Service.java` class is acceptable until a feature becomes complex. For new full service implementations, prefer service interface + `impl`.

## 2. Controller Rules

Controllers must:

- define REST mappings
- receive DTO requests
- apply `@Valid`
- read `@AuthenticationPrincipal` when needed
- call service methods
- wrap success responses with `ApiResponse<T>`

Controllers must not:

- contain business rules
- access repositories directly
- construct JPA entities
- call other microservices directly
- trust client-submitted current user ids when JWT already contains the user identity

Example shape:

```java
@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {
    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    @PostMapping
    public ApiResponse<AppointmentResponse> create(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody CreateAppointmentRequest request
    ) {
        return ApiResponse.success(
                "Appointment created successfully",
                appointmentService.create(principal.id(), request)
        );
    }
}
```

## 3. Service Rules

Services own business behavior:

- validate business state
- orchestrate repository access
- call Feign clients
- publish events when available
- apply transactions
- convert entities to response DTOs or delegate to mappers
- throw `BusinessException` for expected failures

Use:

- `@Transactional(readOnly = true)` for read methods
- `@Transactional` for writes
- `@Slf4j` where business flow or external calls need traceable logs

Do not log sensitive data such as passwords, token values, password hashes, medical details, or payment secrets.

## 4. Repository Rules

Repositories must be Spring Data interfaces only:

- no business logic
- no HTTP calls
- no DTO assembly unless using explicit projections for read optimization

Method names must express the query clearly:

```java
Optional<Patient> findByUserId(UUID userId);
boolean existsByDoctorIdAndAppointmentDateAndStartTimeLessThanAndEndTimeGreaterThan(...);
```

For complex queries, prefer `@Query` with readable JPQL or a dedicated query service.

## 5. Entity Rules

Entities represent persistence, not API contracts.

Required conventions:

- UUID primary keys
- table and column names match Flyway migrations
- `createdAt` and `updatedAt` for business tables
- `@CreationTimestamp` and `@UpdateTimestamp` are acceptable when aligned with database defaults
- relationships inside one service schema may use JPA associations
- cross-service references must be UUID fields, not JPA relationships

Lombok:

- Use `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, `@Builder` where useful.
- Avoid `@Data` on JPA entities with relationships.

## 6. DTO Rules

Every API input/output uses DTOs.

Naming:

- create request: `CreateAppointmentRequest`
- update request: `UpdateDoctorRequest`
- response: `AppointmentResponse`
- summary/list row: `AppointmentSummaryResponse`
- profile response: `PatientProfileResponse`

Validation belongs on request DTOs:

```java
public record CreateAppointmentRequest(
        @NotNull UUID doctorId,
        @NotNull @Future LocalDate appointmentDate,
        @NotNull LocalTime startTime,
        @NotBlank @Size(max = 500) String reason
) {
}
```

## 7. API Response Rules

Use `common-lib` response wrappers:

```json
{
  "success": true,
  "message": "Success",
  "data": {},
  "timestamp": "2026-05-09T00:00:00Z"
}
```

Errors use:

```json
{
  "success": false,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Doctor profile not found",
  "timestamp": "2026-05-09T00:00:00Z"
}
```

If `path`, `status`, or validation field details are added later, update `common-lib` once and reuse it across all services.

## 8. Exception Handling

Use `BusinessException` for expected failures:

```java
throw new BusinessException(ErrorCode.RESOURCE_NOT_FOUND, "Appointment not found");
```

Each service should have a `GlobalExceptionHandler` until the project extracts a shared handler strategy.

Required mappings:

| Error code | HTTP status |
| --- | ---: |
| `VALIDATION_ERROR` | 400 |
| `UNAUTHORIZED` | 401 |
| `FORBIDDEN` | 403 |
| `RESOURCE_NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `INTERNAL_SERVER_ERROR` | 500 |

## 9. Security Rules

Use JWT-authenticated principal for current-user operations.

Good:

```java
public AppointmentResponse create(UUID currentUserId, CreateAppointmentRequest request)
```

Avoid:

```java
public AppointmentResponse create(UUID patientUserIdFromRequest, CreateAppointmentRequest request)
```

Role-sensitive APIs must check roles through Spring Security, not request body fields.

## 10. Feign Client Rules

When a service needs data from another service:

- define a client under `client/`
- keep DTOs specific to the client contract
- pass Authorization header when required
- configure timeout and error handling
- convert remote failures to domain-specific `BusinessException`

Example shape:

```java
@FeignClient(name = "doctor-service", url = "${services.doctor.url}")
public interface DoctorClient {
    @GetMapping("/api/doctors/{doctorId}/availability")
    DoctorAvailabilityResponse getAvailability(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @PathVariable UUID doctorId
    );
}
```

Do not use Feign to perform chatty per-row lookups. Batch endpoints or read models are preferred for list screens.

## 11. Database Migration Rules

Every schema change requires Flyway:

```text
src/main/resources/db/migration/V2__add_appointment_status_history.sql
```

Rules:

- never edit an already-applied migration in shared environments
- add new migrations with clear names
- create indexes for lookup patterns
- add unique constraints for business invariants
- keep migration names deterministic and readable

## 12. Testing Standard

Minimum expectations:

- service unit tests for business rules and edge cases
- controller tests for validation and auth behavior when the API surface grows
- repository tests for custom queries
- integration tests for appointment lifecycle and auth-sensitive flows

Maven commands from `backend/`:

```bash
mvn -pl appointment-service -am test
mvn -pl doctor-service -am test
mvn test
```

## 13. Implementation Checklist

Before finishing a backend feature:

- DTOs exist for all request/response payloads
- request DTO validation is complete
- controller has no business logic
- service has correct transaction boundaries
- expected failures use `BusinessException`
- entity mapping matches Flyway SQL
- API paths match gateway/docs
- auth uses principal instead of client-submitted current user id
- no sensitive data is logged
- focused Maven verification has run

