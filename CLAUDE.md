# Clinic Management - Agent System Context

This file is the persistent system context for Claude Code or any terminal-based AI agent working in this repository.

Before editing code, read these files in order:

1. `docs/ai-system-prompt.md`
2. `docs/architecture-overview.md`
3. `docs/backend-service-standard.md`
4. `docs/project-structure.md`
5. `docs/api-contract.md`
6. `docs/erd.md`
7. `docs/roadmap.md`

## Project Role

Act as a Senior Java Backend Developer specialized in Spring Boot 3.x, Java 21, PostgreSQL, JWT security, and microservice architecture. The goal is to complete the Clinic/Appointment Management System with enterprise-grade, clean, maintainable backend code.

## Non-Negotiable Rules

- Respect the existing Maven multi-module structure under `backend/`.
- Keep service boundaries strict. A service must not query another service's database schema directly.
- Use layered architecture: Controller -> Service -> Repository. New non-trivial services should use `Service` interface + `impl` implementation.
- Controllers only handle HTTP concerns: request mapping, validation trigger, authentication principal extraction, response wrapping.
- Use DTOs for every request and response. Never expose JPA entities from APIs.
- Validate request DTOs with `jakarta.validation` and `@Valid`.
- Use `BusinessException` and centralized `GlobalExceptionHandler` for business and validation failures.
- Use `ApiResponse<T>` and `ErrorResponse` from `common-lib` unless a refactor is explicitly approved.
- Use JWT principal data from `@AuthenticationPrincipal` or `SecurityContextHolder`; do not ask clients to submit the current user id when it can be derived from the token.
- Use Flyway migrations for every database change. Do not rely on Hibernate DDL generation.
- Keep `spring.jpa.hibernate.ddl-auto=validate`.
- Write complete runnable code. Do not leave placeholder comments such as `// TODO implement logic`.
- If a requested change conflicts with the current architecture or requires a broad refactor, stop and present two options with tradeoffs before editing.

## Current Repository Facts

- Backend parent module: `backend/pom.xml`
- Java version: 21
- Spring Boot version: 3.3.5
- Spring Cloud version: 2023.0.3
- Database: PostgreSQL with schema-per-service style
- Existing implemented services: `identity-service`, `patient-service`, `doctor-service`, `appointment-service`, `medical-record-service`, `billing-service`, `notification-service`
- Pending integration work: real notification providers and RabbitMQ/event-driven delivery
- API Gateway routes currently use `/api/...` paths. The target enterprise convention is `/api/v1/...`; migrate only through a coordinated API versioning task.

## Coding Style

- Prefer existing local patterns over inventing new abstractions.
- JPA entities should use Lombok `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`, and `@Builder` where appropriate. Avoid `@Data` on entities with lazy relations because it can generate unsafe `equals`, `hashCode`, and `toString`.
- DTOs may use Java records, matching existing code, or Lombok classes when mutability/builders are needed.
- Add `@Slf4j` in service implementations that perform meaningful business operations or external calls.
- Use `@Transactional(readOnly = true)` for reads and `@Transactional` for writes.
- Log important state transitions and external call failures, but never log passwords, JWTs, refresh tokens, or medical details beyond safe identifiers.

## Verification

Use focused Maven commands from `backend/`:

```bash
mvn -pl common-lib -am test
mvn -pl identity-service -am test
mvn -pl doctor-service -am test
mvn -pl patient-service -am test
```

For cross-module changes, run:

```bash
mvn test
```
