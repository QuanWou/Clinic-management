# P05-S0-01 — Service/UI disposition & migration impact

**Decision status:** engineering disposition **PROPOSED FOR REVIEW**, not approval to rewrite/migrate.  
**Source revision:** `e6ab0d4f45e0779dff82e555f990ab043614a5c6`; static audit 2026-09-29.  
**Rule:** REUSE means reuse a *narrow component/pattern* after security/contract tests; REFACTOR adapts a bounded context; REPLACE supersedes the V1 implementation with a versioned owner boundary while retaining V1 as legacy; NEW has no present V1 owner. No service is approved for unchanged production V2 use.

| Target context / UI | Disposition | What can survive | Must change / new contract | Planned slice and source evidence |
|---|---|---|---|---|
| common-lib | **REUSE (narrow)** | Error codes, `ApiResponse`, exception handling conventions | V2 error/idempotency/correlation/tenant-aware schema; no shared JPA entities | S0-05; `backend/common-lib/src/main/java/`, `backend/pom.xml:14-25` |
| api-gateway / BFF | **REFACTOR** | Spring Cloud routing, CORS lessons, downstream WebClient pattern | Public/workspace/platform separation; verified context not header authority; object guard stays with owner; `/api/v2` versioning subject to ADR | S0-03/06; `backend/api-gateway/src/main/resources/application.yml:25-57` |
| identity-service | **REFACTOR** | Credential hashing, JWT access/refresh types, refresh rotation, admin audit pieces | Session state/revoke; `clinic_membership`, branch grants, role at active clinic, no global role union; explicit platform operator | S0-03; `identity/V1__create_identity_tables.sql:3-35`, `AuthService.java:94-131`, `JwtAuthenticationFilter.java:59-87` |
| clinic-service | **NEW** | No V1 data owner | Clinic/branch/license/contact, review/publish/suspend, audit, approved public fields, platform ops gate | S0-02; absent from `backend/pom.xml:14-25` |
| patient-service | **REFACTOR** | UUID and walk-in no-account registration, search/code | PatientIdentity, verified user link, clinic patient link, guardian grant, duplicate review; tenant isolation | S1-02/S2-01; `patient/V2__reception_walk_in_patients.sql:1-6`, `ReceptionPatientService.java:26-79` |
| doctor-service | **REFACTOR** | Practitioner/specialty profile, schedule validation, admin create/edit patterns | Doctor affiliation by clinic/branch, scope/leave/capacity, publication and assignment | S0-04; `doctor/V1__create_doctor_tables.sql:1-28`; `DoctorService.java:38-122` |
| catalog-service | **REFACTOR** | Catalog CRUD, price versions with date non-overlap | Clinic/branch offering, approved price policy, effective snapshot in booking/charge; role separation | S0-04; `catalog/V1__catalog_tables.sql:1-43`, `V2__price_period_guards.sql:1-13` |
| appointment-service | **REFACTOR** | GiST overlap guard, date/time/appointment ID, booked lifecycle and reschedule validation | Slot inventory/hold TTL, idempotency, clinic/branch, doctor pool policy, history, no queue/clinical ownership | S1-03/04; `appointment/V2__prevent_overlapping_appointments.sql:1-15`, `AppointmentServiceImpl.java:48-119` |
| encounter / reception queue | **REPLACE semantic model; NEW owner context** | Ticket issuance/day locking/status transition concepts | `visit` with nullable appointment; branch/desk queue and assignment, independent lifecycle; whether a new deployable service or co-deployed module remains ADR OPEN | S2-02/03; `appointment/V3__reception_visit_queue.sql:2-15`, `ReceptionQueueService.java:46-76` |
| medical-record-service | **REFACTOR core; REPLACE document model** | Draft/optimistic locking, lab processing/result and prescription draft/sign, limited audit | Encounter FK/ref, clinical order doctor review, immutable signed document/version/addendum and **separate release** with purpose/assignment/guardian check | S3-02..05; `medical/MedicalRecord.java:43-83`, `MedicalRecordServiceImpl.java:143-244`, `LabOrderController.java:26-104` |
| billing-service | **REPLACE aggregate; REUSE selected primitives** | Verified catalog snapshot, source freeze/revision guard, cash receipt idempotency, outbox | Charge source-event key, bill lines, partial allocations, direct transfer/POS, online payment-intent/webhook, refund/reversal journal, shift and beneficiary settlement; no appointment-only key | S1-05 conditional, S4; `billing/Invoice.java:36-80`, `BillingServiceImpl.java:80-185,287-380`, `billing/V2__cash_audit_and_payment_transactions.sql:13-28` |
| notification-service | **REFACTOR** | DB inbox/status/preference, retry, producer outboxes and broker confirms | Versioned clinic/branch non-PHI envelope, trust producer, dedicated dedupe, recipient clinic context, delivery owner | S0-05 groundwork, S1-06/S5-03; `NotificationEventServiceImpl.java:25-50` and V1 publisher classes |
| search/public index | **NEW** | May reuse PostgreSQL as read model, not V1 records as public | Approved non-PHI clinic/doctor projection with provenance, stale marker; book action rechecks owner; no new search engine required initially | S1-01; P03 `01_System_Architecture.md:26-38` |
| audit/telemetry | **REFACTOR+NEW** | Existing admin/medical audit concepts, Prometheus/Grafana | Unified append-only event schema with clinic/branch/actor/outcome/correlation, PHI redaction, security alerts and restore evidence | S0-05; `docker-compose.yml:296-334`, medical/admin audit source |
| frontend shared primitives | **REUSE selectively** | Field controls, modal/alert, keyboard/mobile navigation primitives, small formatting helpers | Backend-validated role/context, accessibility QA and module-specific tokens | S0-06; `frontend/src/components/`, `layouts/AppShell.tsx:35-114` |
| frontend application architecture | **REPLACE** | Visual fragments/screens only where matching P04 contracts | Public guest site + patient portal; tenant/branch/role clinic workspace; separated platform mode; per-context data reset, explicit URLs and permission states | S0-06 shell; S1 onward feature screens; `frontend/src/app/App.tsx:141-195,202-256`, `utils/roles.ts:5-36` |
| V1 migrations / operations | **REUSE as historical inputs only** | Existing schemas, migration chain and seed generators for mapping review | New versioned, non-destructive V2 migrations on isolated DB; least-privilege per service; dry-run/reconcile before cutover | S0 planning/S6 rehearsal; `docker-compose.yml:1-199`, `infra/postgres/init/01-create-schemas.sql:1-7` |

## Hard blockers in the existing coupling (not cosmetic UI issues)

1. **Appointment ≠ Encounter.** The V1 queue FK is `appointment_id UUID NOT NULL UNIQUE` and the doctor UI persists the *appointment ID* in a session key (`appointment/V3__reception_visit_queue.sql:4`, `frontend/src/app/App.tsx:24-49,158-162`). The new walk-in route must not create fake appointments; source route and data linkage must be redesigned.
2. **Medical record is tied to appointment.** `MedicalRecord.appointmentId` is nonnull/unique; the current `FINAL` status only means a local record finalization, not legally qualified signature/release (`medical/MedicalRecord.java:48-79`, P03 `04_Lifecycle_and_Invariants.md:20-24`).
3. **Invoice is tied to appointment and one full cash transaction.** `Invoice.appointmentId NOT NULL UNIQUE`, `payment_transactions.invoice_id/type UNIQUE`. V2 needs event-source charges and partial payments/beneficiary; do not stretch the legacy table by renaming UI labels (`billing/Invoice.java:36-43`, `billing/V2__cash_audit_and_payment_transactions.sql:13-28`).
4. **Global role is not a tenant grant.** `identity.user_roles` and frontend `rolePriority` cannot authorize clinic B just because a user is doctor/admin at A (`identity/V1__create_identity_tables.sql:20-25`, `frontend/src/utils/roles.ts:5-36`).
5. **Search/Platform does not have an owner.** It must be added with publication governance and separate permission boundary; the V1 admin dashboard is clinic operations, not platform moderation (`backend/pom.xml:14-25`, `frontend/src/pages/AdminDashboard.tsx:23-57`).

## Data migration preservation plan (no migration executed)

| Legacy item | Preliminary mapping | Loss / ambiguity guard |
|---|---|---|
| identity user + global roles | `platform_user` + reviewable `clinic_membership` | Never infer tenant from global `ROLE_ADMIN`; unknown ownership quarantined |
| patient profile and nullable user link | patient identity + verified clinic patient link | Phone/email not sufficient to merge; preserve patient codes as legacy display references |
| doctors/schedules | practitioner + affiliation + branch schedule | Existing schedules have no branch; owner review for assignment |
| catalog service/price | tenant offering/price version + legacy reference | Historical effective dates/consumed snapshots preserved |
| appointments/reception visits | appointment + distinct encounter/queue linked by legacy ID | Do not turn a non-booked walk-in into a fictitious appointment; preserve both temporal status histories |
| medical records/labs/prescriptions | encounter-linked clinical content + original source status/evidence | Never fabricate signature, doctor review or release; preserve author and timestamps |
| invoices/payment transactions | charge/bill/payment journal plus `legacy_id_map` | Preserve original amounts, external receipt IDs, reconciliation-required flags and unknowns; no backfilled success without proof |
| notifications/audit | versioned outbox, audit references | Do not replay messages to real recipients from migrated legacy source without explicit policy |

Refer to P03 `08_V1_Migration_Strategy.md:5-29`. Migration owner must create `(source_system,legacy_type,legacy_id,new_uuid,clinic_id,migration_batch,hash,status)` mapping, row/count/hash/money reconciliation, backup and rollback plan. Only a controlled copy may be migrated at S6 after relevant S0 design approvals. All legacy source remains intact.

## Proposed engineering disposition approval checklist

- [ ] Tech Lead approves bounded contexts and service-owner/implementation boundaries; Encounter deployable-vs-module is explicitly decided (ADR A03).
- [ ] DBA/Security approves row model, service credentials, RLS design and test procedure (ADR A01/A02); no direct cross-service SQL.
- [ ] PO/Clinic/Platform/Medical/Finance/Legal/Privacy owners approve the corresponding OPEN decisions in `S0-01_Risk_And_Decision_Register.md`; no inferred rule is promoted silently.
- [ ] Owners sign migration source-of-truth/ambiguity ownership and no-delete rule.
- [ ] QA attaches isolated tests and gate A0 evidence before anyone labels an implementation VERIFIED/ACCEPTED.
