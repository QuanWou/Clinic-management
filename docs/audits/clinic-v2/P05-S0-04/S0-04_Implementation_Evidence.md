# P05-S0-04 — Doctor / Catalog implementation and evidence

Date: 2026-09-30 (Asia/Bangkok)
Workspace task: 6820c6b7-522a-4a2c-9f1b-b05d2184fb36 — Clinic Management V2
Branch: local-coder/clinic-management-v2-6820c6b7
Status: IMPLEMENTED AND VERIFIED for the S0-04 service-source scope. A0 acceptance and downstream Appointment/Billing E2E remain pending.

## Delivered scope

- Doctor V2: practitioner matched by platform user ID; clinic/branch affiliation; recurring schedule create/update/read; optimistic row versions; same-branch PostgreSQL overlap constraints.
- Affiliation creation verifies manager branch capability, source Clinic branch and a target IAM decision with role DOCTOR. DOCTOR_WORK alone is insufficient because IAM also grants it to NURSE and CLINIC_OWNER. Doctor schedule mutations also verify practitioner ownership.
- Existing global practitioner identity cannot be overwritten through a new clinic affiliation. A mismatch returns conflict, and runtime DB privileges do not permit global profile UPDATE.
- Catalog V2: clinic offerings, branch assignments, effective price history, append-only runtime price permissions and versioned snapshot response.
- FORCE RLS and transaction-local clinic context protect Doctor tenant tables and all Catalog tenant tables.
- Separate migrator and non-bypass runtime logins; scoped Doctor/Catalog workload calls to IAM and Clinic.
- Service READMEs, reproducible disposable-PostgreSQL verifier, final Maven packages and persisted evidence.

## Traceability and acceptance boundaries

| Requirement / case | Source and executed evidence | Outcome / boundary |
|---|---|---|
| FR-ORG-06 / AT-005 | DoctorService; DoctorExternalPostgresTest.rlsAndScheduleIsolationKeepClinicAChangesOutOfClinicB | PASS: changing clinic A schedule preserves clinic B schedule |
| FR-ORG-06 | affiliationCannotChangePractitionerSharedWithAnotherClinic; branchManagerCannotOverwriteGlobalPractitionerIdentity | PASS: clinic manager cannot overwrite shared practitioner identity |
| FR-ORG-06 target role | clinicalCapabilityWithoutDoctorRoleCannotCreateDoctorAffiliation | PASS: NURSE clinical capability cannot create a Doctor affiliation |
| FR-ORG-04 | CatalogService; branchPricesStayIndependentAndFuturePriceDoesNotReplacePastPrice | PASS: independent branch prices, temporal resolution and original snapshot value |
| AT-016 Catalog prerequisite | appendOnlyPriceVersionsKeepHistoricalSnapshotStable | PASS for Catalog contract; booking price-lock and Billing integration NOT RUN |
| AT-045 Catalog prerequisite | PostgreSQL denies UPDATE/DELETE of existing price versions; new effective version leaves old row unchanged | PASS for source price protection; issued-bill snapshot persistence/adjustment policy NOT RUN |
| Tenant denial | deniedManagerCannotEditScheduleInAnotherClinic; deniedIamScopeNeverSetsTenantOrChangesAnotherClinic | PASS: denied writes preserve data, subsequent unscoped query returns no rows |
| Database defense | direct cross-clinic insert, scope FK violation, FORCE RLS checks, non-superuser/non-bypass login assertions | PASS |
| Stale edits / overlap / duplicate effective time | service unit tests and external DB constraint tests | PASS |

IAM and Clinic clients are mocked in Doctor/Catalog external tests; this verifies service authorization decisions and real persistence, not a live four-service HTTP chain. Existing IAM/Clinic unit/security regressions were rerun separately.

## Fresh PostgreSQL and migrations

The final verifier created a new PostgreSQL 16.15 container with unique name, task/verification labels, loopback-only port and tmpfs storage. It created exactly these disposable DBs:

- clinic_v2_s004_doctor_sandbox
- clinic_v2_s004_catalog_sandbox

Each started with no service schema. Flyway applied V1, V2 and V3 from classpath using the migrator. Flyway history confirms success for all six versioned migrations.

The test context then uses a separate runtime login inheriting its service's NOLOGIN runtime role. Both runtime logins assert rolsuper=false and rolbypassrls=false. Hibernate ddl-auto=validate and repository startup succeed under those runtime credentials.

Database snapshots: [Doctor](verification/doctor-database.txt), [Catalog](verification/catalog-database.txt).

The earlier manually migrated Catalog sandbox also accepted V3 during this Codex run. Final acceptance evidence uses the new fresh Flyway run above, so it does not rely on earlier manual migration or old Surefire results.

## Final execution results

Command from worktree root:

```powershell
.\v2\scripts\verify-s0-04.ps1
```

| Suite | Passed | Failures | Errors | Skipped |
|---|---:|---:|---:|---:|
| DoctorServiceTest | 8 | 0 | 0 | 0 |
| DoctorExternalPostgresTest | 4 | 0 | 0 | 0 |
| CatalogServiceTest | 6 | 0 | 0 | 0 |
| CatalogExternalPostgresTest | 5 | 0 | 0 | 0 |
| S0-04 total | 23 | 0 | 0 | 0 |

Doctor and Catalog `mvn -DskipTests package`: PASS after the successful tests. Executable Spring Boot JAR hashes are recorded in [summary.json](verification/summary.json).

Logs: [Doctor tests](verification/doctor-test.txt), [Catalog tests](verification/catalog-test.txt), [Doctor package](verification/doctor-package.txt), [Catalog package](verification/catalog-package.txt).

Dependency regression commands:

```powershell
mvn.cmd -B -ntp -f v2/services/identity-service/pom.xml test
mvn.cmd -B -ntp -f v2/services/clinic-service/pom.xml test
```

- Identity: 15 passed, 0 failure/error; 5 opt-in DB tests skipped.
- Clinic: 23 passed, 0 failure/error; 6 external/Testcontainers tests skipped.
- Those 11 skipped dependency tests are NOT counted as PASS or fresh DB verification.

Regression logs: [Identity](verification/identity-regression.txt), [Clinic](verification/clinic-regression.txt).

## Reproduction and cleanup

`v2/scripts/verify-s0-04.ps1` generates disposable credentials in memory, passes them through process environment variables and restores the original environment in finally. It writes text logs, test summaries, migration history and package hashes; credentials are not passed as Maven properties or saved to the evidence.

The script requires zero skipped S0-04 tests, fails on native command errors and removes only its exact container after matching the unique verification label. Cleanup succeeded; its tmpfs databases and runtime credentials were destroyed. No V1/production DB, shared Compose resources or main-checkout changes were used.

The previous task sandbox `clinic-v2-s004-doctor-6820` was also removed after matching its exact container ID, PostgreSQL image, loopback port, anonymous volume and database inventory. It contained only the two S0-04 databases plus postgres and had zero active client sessions. Its anonymous volume was removed; no S0-04 container remains. See [previous sandbox cleanup](verification/previous-sandbox-cleanup.json).

The [source manifest](verification/source-manifest.csv) records SHA-256 hashes for the final Doctor/Catalog source, tests, migrations, READMEs, POMs and verifier script. Changes remain in the V2 worktree; no commit or push was made.

## Remaining boundaries

1. A0 requires S0-05 audit/operations, S0-06 UI and Security/Tech/QA review; source verification is not overall foundation sign-off.
2. OD-04 doctor-choice versus specialty-pool semantics remain open. Slot generation, capacity, hold TTL and cross-branch doctor availability policies belong to Appointment/S1.
3. Price snapshot persistence in booking/charge/bill belongs to S1/S4. Consumers must store the original snapshot instead of resolving it again later. Authorized backdated price insertions are currently possible; approved price-lock/adjustment policy is a downstream decision.
4. Public Doctor/Catalog projections and publication gating belong to S1 Search/Clinic integration; these service routes require authentication.
5. Patient/guardian consent, encounter assignment, medical release, absence/leave exception workflows, unified audit and frontend tenant-cache clearing are owned by later slices.
6. The practitioner UPDATE privilege was removed in the undeployed V2 development V3 migration. An environment that has already recorded the previous V3 checksum needs an explicit forward migration; do not repair production history to match this development edit.

P05-S0-04 is complete for the planned Doctor/Catalog source deliverable, with final tests, fresh migrations, package and verification-container cleanup recorded above.
