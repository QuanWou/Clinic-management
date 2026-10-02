# Clinic Management V2 — Clinic Service (S0-02 + S0-03 integration)

**Status:** S0-02 clinic onboarding/publication backend is implemented. S0-03 replaces the temporary clinic-local authorization bridge with V2 IAM membership/context checks and scoped workload identity. Public release remains disabled by default pending OD-11 and owner/legal review.

## Service boundary

Clinic Service owns clinic, branch, private license reference/expiry, review history and publication lifecycle. It does not own credentials, clinic membership, doctor scheduling, patient/medical data, booking capacity or billing.

Identity/IAM owns staff membership and authorization. Clinic Service never treats a client-supplied clinic/branch id as proof of access.

## Authorization path after S0-03

Authenticated Clinic routes:

1. Clinic forwards the bearer token only to V2 Identity/IAM `GET /api/v2/me/current`.
2. IAM verifies token purpose/current account/session cutoff and fails closed if the compatibility identity dependency is unavailable or the session is revoked.
3. Before tenant data is read/written, Clinic asks IAM `/api/v2/internal/iam/authorization/check` using a short-lived Clinic→IAM workload JWT.
4. Only after IAM confirms the requested clinic/branch capability does Clinic set transaction-local `app.clinic_id` and query its own DB.
5. Object owner is then resolved from Clinic DB. Branch updates require authorization for that specific branch; clinic-wide changes require clinic-wide/all-branch capability.
6. Platform review capability is checked through IAM as `PLATFORM_CLINIC_REVIEW`; global V1 `ROLE_ADMIN` alone does not grant platform moderation.
7. A platform operator who also has membership in the clinic cannot review that clinic.

Clinic→IAM dependency failures are authorization failures, never permissive fallbacks.

## Workload identity

Two directions are separated:

- Clinic→IAM: scopes such as `iam.authorize`, `iam.contexts.read`, `iam.owner.provision`; audience `identity-v2-service`.
- IAM→Clinic: scope `clinic.scope.read`; audience `clinic-v2-service`.

The internal booking-eligibility route is reserved for a separately configured appointment-service workload identity with scope `clinic.booking.read`.

Workload JWTs are short-lived and validate issuer/subject, audience, token type, scopes, `iat/exp/jti`. Static browser/client service keys are not used.

## Owner membership bootstrap

Creating a clinic first commits the Clinic row. The controller then asks IAM to provision the creator as `CLINIC_OWNER`. IAM independently calls Clinic's workload-protected scope endpoint and confirms the `clinicId/ownerUserId` pair before inserting the owner membership.

If IAM provisioning is temporarily unavailable, clinic creation returns the durable clinic with header `X-Owner-Membership: PENDING`. The authenticated creator can retry:

`POST /api/v2/clinics/{clinicId}/owner-membership`

The retry verifies the creator against Clinic's source of truth before calling IAM, avoiding blind client-controlled owner grants.

## Onboarding/publication lifecycle

Clinic review state:
`DRAFT -> SUBMITTED -> NEEDS_CHANGES -> DRAFT -> ... -> APPROVED`, or `SUBMITTED -> REJECTED`.

Publication is independent:
`UNPUBLISHED -> PUBLISHED -> SUSPENDED/UNPUBLISHED`.

Before submit/approve/publish, Clinic requires contact identity, valid license metadata/private evidence reference and at least one active branch.

`CLINIC_V2_PUBLICATION_ENABLED=false` is the default. OD-11 public-field/legal verification remains open; synthetic tests may explicitly enable publication.

Public responses use the minimal `PublicView` and never include private license evidence/contact/review fields.

## API

Owner/manager routes:

- `POST /api/v2/clinics`
- `POST /api/v2/clinics/{clinicId}/owner-membership`
- `GET /api/v2/clinics/mine`
- `GET /api/v2/clinics/{clinicId}`
- `PUT /api/v2/clinics/{clinicId}`
- `POST /api/v2/clinics/{clinicId}/branches`
- `PUT /api/v2/clinics/{clinicId}/branches/{branchId}`
- `POST /api/v2/clinics/{clinicId}/submit`
- `GET /api/v2/clinics/{clinicId}/reviews`

Platform routes remain the S0-02 review/request-changes/reject/approve/publish/unpublish/suspend endpoints and require IAM platform capability.

Public routes:

- `GET /api/v2/public/clinics`
- `GET /api/v2/public/clinics/{slug}`

Workload routes:

- `GET /api/v2/internal/clinics/{clinicId}/scope?branchIds=...` — IAM scope verification
- `GET /api/v2/internal/clinics/{clinicId}/booking-eligibility?branchId=...` — appointment-service only

## Tenant RLS

Clinic migrations use FORCE RLS and transaction-local access mode/clinic id. Runtime DB role must be non-owner, non-superuser and `NOBYPASSRLS`.

Modes are server-only: tenant, platform, public, system. Missing mode/context fails closed. `TenantDbContext` uses `set_config(..., true)`, so context disappears at transaction end and does not leak through the pool.

RLS is defense-in-depth. IAM authorization and server-side object lookup are still mandatory.

## Configuration

Use isolated V2 resources only:

```text
CLINIC_V2_DB_URL=jdbc:postgresql://127.0.0.1:<port>/<isolated-v2-db>
CLINIC_V2_DB_USER=<non-owner runtime login>
CLINIC_V2_DB_PASSWORD=<runtime secret>
CLINIC_V2_MIGRATION_DB_USER=<migration login>
CLINIC_V2_MIGRATION_DB_PASSWORD=<migration secret>

CLINIC_V2_IAM_URL=http://127.0.0.1:8093
CLINIC_V2_IAM_SERVICE_SECRET=<Clinic->IAM workload secret, >=32 bytes>
CLINIC_V2_IAM_DIRECTORY_SECRET=<IAM->Clinic workload secret, >=32 bytes>
CLINIC_V2_APPOINTMENT_SERVICE_SECRET=<optional appointment->Clinic secret, >=32 bytes>

CLINIC_V2_PUBLICATION_ENABLED=false
CLINIC_V2_PORT=8092
```

Do not bind this service or its Flyway migrations to the V1 production DB.

## Verification

```powershell
mvn -q -f v2/services/clinic-service/pom.xml test
mvn -q -f v2/services/clinic-service/pom.xml -DskipTests package
```

S0-03 adds a real-PostgreSQL opt-in tenancy test that refuses non-disposable DB names. It verifies fail-closed RLS, a non-bypass runtime role, transaction-local scope and cross-tenant object denial. Unit tests also verify a branch-scoped manager must pass IAM authorization for the exact branch before DB tenant context is set.

Evidence:

- `docs/audits/clinic-v2/P05-S0-02/S0-02_Implementation_Evidence.md`
- `docs/audits/clinic-v2/P05-S0-03/S0-03_Implementation_Evidence.md`

## Carry-forward limits

- Search projection/booking owner, patient/guardian authorization, doctor assignment and clinical object checks belong to later source-owning services. Clinic/IAM provide the tenant/security foundation but do not claim those later domain ATs are already end-to-end complete.
- Unified tamper-evident security audit/trace, backup checklist and event envelope belong to S0-05.
- Public/workspace/platform UI shells and cache clearing on tenant switch belong to S0-06. Backend context switching is stateless and fail-closed, but frontend cache invalidation is not claimed here.
- OD-11 remains open, so publication stays disabled outside explicitly controlled synthetic tests.
