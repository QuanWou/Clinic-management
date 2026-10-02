# P05-S0-02 — Clinic Onboarding implementation & evidence

**Date:** 2026-09-29. **Task verified:** `6820c6b7-522a-4a2c-9f1b-b05d2184fb36` / `local-coder/clinic-management-v2-6820c6b7`.  
**Status at S0-02 close (2026-09-29):** backend source **IMPLEMENTED**, isolated synthetic DB **VERIFIED for listed cases only**, V2 gateway/IAM/workspace **NOT INTEGRATED**, owner acceptance/A0 **PENDING**.  
**Follow-up 2026-09-30:** S0-03 IAM/tenant integration is now implemented in `v2/services/identity-service/` and Clinic Service; see `docs/audits/clinic-v2/P05-S0-03/S0-03_Implementation_Evidence.md`. The statements below describing S0-03 as OPEN are retained as the historical S0-02 handoff state.

## Scope delivered

Standalone `v2/services/clinic-service/` on Java 21/Spring Boot 3.3.5/PostgreSQL, independent Maven build and Flyway migration. This does not edit V1 services/DB/frontend. The S0-02 service owns:

- Clinic `DRAFT/SUBMITTED/NEEDS_CHANGES/APPROVED/REJECTED` review state; separate `UNPUBLISHED/PUBLISHED/SUSPENDED` public lifecycle; immutable review-event history with actor/time/reason.
- Owner-bound draft/edit/branch APIs; clinic profile, private license reference/expiry, contacts, active branches; completeness validation before submit/approve/publish.
- Platform review/request changes/reject/approve/publish/unpublish/suspend; requires explicit operator UUID allowlist + current global `ROLE_ADMIN` and rejects self approval.
- Public guest listing/detail returns allowlisted `PublicView` only; no private license/evidence/contact; unpublished, unapproved, expired-license, branchless or suspended entries are excluded.
- Authenticated booking-eligibility contract with active branch (interim service-key caller guard); `CLINIC_V2_PUBLICATION_ENABLED=false` by default pending OD-11.

| FR / AT | Source / observable evidence | Result or limitation |
|---|---|---|
| FR-ORG-01; AT-001 | `ClinicDto`, `ClinicOnboardingService.requireReady/submit`, Flyway license+branch constraints | Tested: incomplete draft fails; complete synthetic draft submits |
| FR-ORG-02; AT-002 | `PlatformClinicController`, `PlatformAccess`, workflow service/review events | Tested: unapproved/admin non-operator denied, self approval denied, explicit review reason and separate status |
| FR-ORG-07; AT-003/050 | `PublicClinicController`, `ClinicRepository.findPublicEligible`, publication flag | Tested in synthetic DB: hidden before publish, visible only after, excluded on suspend; Search projection (S1) not implemented |
| FR-ORG-03 partial | Clinic/Branch owner local data and active branch | Tested locally; S0-03 IAM membership/tenant authorization still missing |
| ARCH-01/02/03 | Owner and operator boundaries only | **NOT VERIFIED** cross-tenant membership/RLS/revoke; belongs to S0-03/A0 |
| UX-A09/10 | Backend contract only | UI prototype exists in P04; integrated shell/tenant switch belongs to S0-06 |

## Verification record

- `mvn -q -f v2/services/clinic-service/pom.xml -DskipTests compile`: **PASS**.
- `mvn -q -f v2/services/clinic-service/pom.xml -DskipTests package`: **PASS**.
- Unit service/security: 16 + 3 = **19 passed**; no failures.
- Explicit synthetic loopback PostgreSQL 16 sandbox `clinic_v2_s002_sandbox`, isolated container `clinic-v2-s002-6820-test`: Flyway migration V1 ran successfully; Hibernate `ddl-auto=validate` and repository startup succeeded. Two external integration tests **PASS**, full lifecycle + MockMvc public privacy and unauthorized private endpoints.
- HTTP smoke from isolated app at temporary localhost port `18092`: health 200; public empty list 200; absent draft 404; platform and owner routes without credentials 401; internal endpoint without key 403.
- Three Testcontainers cases **SKIPPED**: Java Docker client could not use Docker Desktop npipe proxy (400), though Docker CLI worked. Do not count these as passing tests. The two external PostgreSQL tests substitute for the tested real-DB workflow, not all future Testcontainers edge cases.
- **Total when external integration explicitly enabled:** 21 passed, 3 skipped, 0 failure/error. Normal `mvn test` (without isolated DB properties) runs 19 unit cases; external DB and Testcontainers cases may skip.
- Synthetic app process stopped and uniquely named disposable container stopped/removed. No V1 database/volume/container was touched.

## Gaps and decisions carried forward

1. **OD-11 remains OPEN:** publication feature flag defaults false, but exact license verification/checklist, private evidence object storage, legally permitted public fields and human sign-off still require Platform/Legal confirmation. `evidenceVerified` is an explicit authorized reviewer attestation, not automatic certificate verification.
2. **S0-03 OPEN:** V1 Identity compatibility checks current account/roles, not clinic memberships, branch grants, session revocation epoch or RLS. Explicit operator UUID allowlist and internal service key are temporary test/integration guards, not a production IAM design.
3. **S0-05 OPEN:** local review trail is not a unified immutable security audit/event envelope; backup/recovery and service-to-service identity remain pending.
4. **S0-06 OPEN:** standalone HTTP service has no integrated public website, Clinic Workspace, Platform Console or V2 gateway route. Backend alone does not prove user journey.
5. **S1 OPEN:** public Search/read projection and booking owner must check source `BookingEligibility`; public list must never be slot truth.
6. **No migration of V1 tenants/data:** original global records have unknown clinic ownership and need separate mapping on a controlled copy; do not execute this Flyway file against V1.

**Definition:** source implementation and isolated DB verification are real, but this task is **not ACCEPTED** pending owner review and A0; no legal/public production deployment authorization is implied. P02 PRD/Decision Log remain authoritative over this engineering adaptation.
