# Clinic Management V2 — Doctor Service (S0-04)

Owns the global practitioner reference, clinic/branch affiliations and recurring working schedules. Identity/IAM owns membership; Clinic owns clinic/branch validity. Booking availability, capacity, holds, absence exceptions and clinical assignment belong to later slices.

## Authorization and data rules

- Resolve the caller through V2 IAM, then authorize the requested capability and exact clinic/branch before setting transaction-local DB scope.
- Affiliation creation requires `CLINIC_CONFIG` for the manager and an active `DOCTOR_WORK` grant for the target user.
- A practitioner is matched by platform user ID, never display name. An existing practitioner's name/registration cannot be overwritten by branch affiliation creation; conflicting identity fields return HTTP 409.
- Schedule mutations require `SCHEDULE_MANAGE`. When IAM returns role `DOCTOR`, the practitioner must belong to that actor.
- Reads require `SCHEDULE_READ`; object queries include clinic and branch.
- Expected row versions reject stale updates. Effective date ranges use an exclusive end, and overlapping recurring schedules in the same practitioner/clinic/branch/day are rejected by PostgreSQL.
- FORCE RLS protects affiliations and schedules. Missing clinic context returns no tenant rows; transaction-local context disappears after commit/rollback.
- Runtime has SELECT/INSERT on global practitioners and SELECT/INSERT/UPDATE on affiliations/schedules, with no DELETE or schema ownership. Migrations run under separate credentials.

## API

All routes are authenticated and start with:
`/api/v2/clinics/{clinicId}/branches/{branchId}`

| Method | Suffix | Capability |
|---|---|---|
| POST | /doctor-affiliations | CLINIC_CONFIG; target DOCTOR_WORK |
| PUT | /doctor-affiliations/{affiliationId} | CLINIC_CONFIG |
| GET | /doctor-affiliations | SCHEDULE_READ |
| POST | /doctor-affiliations/{affiliationId}/schedules | SCHEDULE_MANAGE |
| PUT | /doctor-affiliations/{affiliationId}/schedules/{scheduleId} | SCHEDULE_MANAGE |
| GET | /doctor-affiliations/{affiliationId}/schedules | SCHEDULE_READ |

## Runtime configuration

```text
DOCTOR_V2_PORT=8094
DOCTOR_V2_DB_URL=jdbc:postgresql://127.0.0.1:<port>/<isolated-v2-db>
DOCTOR_V2_DB_USER=<runtime login inheriting clinic_v2_doctor_runtime>
DOCTOR_V2_DB_PASSWORD=<runtime secret>
DOCTOR_V2_MIGRATION_DB_USER=<migrator>
DOCTOR_V2_MIGRATION_DB_PASSWORD=<migration secret>
DOCTOR_V2_IAM_URL=http://127.0.0.1:8093
DOCTOR_V2_IAM_SERVICE_SECRET=<matches IAM configured inbound secret; at least 32 bytes>
DOCTOR_V2_CLINIC_URL=http://127.0.0.1:8092
DOCTOR_V2_CLINIC_SERVICE_SECRET=<matches CLINIC_V2_DOCTOR_SERVICE_SECRET; at least 32 bytes>
```

IAM's allowed workload issuers must include `doctor-v2-service`. Doctor→IAM tokens use audience `identity-v2-service`, scope `iam.authorize`; Doctor→Clinic tokens use audience `clinic-v2-service`, scope `clinic.scope.read`. The caller bearer is forwarded only to IAM's current-user endpoint.

Flyway V1 creates affiliations/schedules and the overlap constraints, V2 adds tenant RLS, V3 grants the NOLOGIN non-bypass runtime role. Provision a separate non-owner, non-superuser NOBYPASSRLS login and grant that role to it. These V2 development migrations must use an isolated V2 database.

## Verification

From the repository root:

```powershell
mvn.cmd -f v2/services/doctor-service/pom.xml test
mvn.cmd -f v2/services/doctor-service/pom.xml -DskipTests package
.\v2\scripts\verify-s0-04.ps1
```

Normal runs skip the external PostgreSQL tests. The shared S0-04 script creates fresh disposable Doctor and Catalog DBs, runs Flyway V1–V3 with a migrator, runs service tests through non-bypass runtime logins, packages both services and removes its labeled container in finally. Credentials are generated in memory and passed through environment variables.

The opt-in Doctor test accepts only `jdbc:postgresql://127.0.0.1:<port>/clinic_v2_s004_doctor_sandbox`. Set `doctor.it.enabled=true`, `doctor.it.jdbc-url`, and `DOCTOR_IT_RUNTIME_USER/PASSWORD`; `doctor.it.migrate=true` additionally requires `DOCTOR_IT_MIGRATION_USER/PASSWORD`.

Evidence: [S0-04 implementation record](../../../docs/audits/clinic-v2/P05-S0-04/S0-04_Implementation_Evidence.md).

OD-04 doctor-choice versus specialty-pool semantics remain open. This service supplies recurring baseline schedules; it does not claim Appointment capacity or booking E2E acceptance.
