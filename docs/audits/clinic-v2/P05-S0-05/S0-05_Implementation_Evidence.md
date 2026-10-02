# P05-S0-05 — Audit / eventing / recovery / synthetic environment evidence

**Date:** 2026-09-30  
**Task:** `6820c6b7-522a-4a2c-9f1b-b05d2184fb36` — Clinic Management V2  
**Branch:** `local-coder/clinic-management-v2-6820c6b7`  
**Status:** **IMPLEMENTED** for the S0-05 foundation and **VERIFIED** for the isolated evidence listed below. Overall A0 and platform-wide AT-038/039/068 remain broader gates requiring later producer adoption, S0-06 and S6/QA evidence.

## 1. P05 scope implemented

Backlog source: `P05-S0-05 | Platform/DevOps | Audit trace, non-PHI event envelope, backup/recovery checklist và synthetic environment | FR-OPS-04/05 / AT-038/039/068`.

Delivered:

- `v2/services/audit-service/`
  - append-only audit rows with actor, optional delegated actor, object, clinic/branch, action, outcome, reason, correlation id and UTC timestamp;
  - per-scope SHA-256 chain using previous hash + event hash for tamper evidence;
  - runtime DB role has no UPDATE/DELETE privilege on audit rows and DB triggers also reject UPDATE/DELETE;
  - audit read is workload-only and separate from normal clinical/financial users;
  - issuer-specific workload JWT verification with audience/scope checks;
  - safe metadata validator that rejects diagnosis, symptoms, patient contact, clinical body, result/prescription free text and similar PHI-shaped fields.
- `v2/contracts/event-envelope.schema.json`
  - exact copy of the P03 canonical event-envelope schema;
  - runtime validator for versioned CloudEvents-inspired non-PHI envelopes.
- Local transactional outbox reference in Audit Service:
  - audit append + safe `clinic.audit.recorded.v1` outbox row are committed together;
  - relay uses retry/backoff, attempt count and dead-letter state;
  - transport is at-least-once; consumer business effect must deduplicate by event id.
- `v2/contracts/audit-producer-checklist.md`
  - adoption contract for future source services; explicitly requires each domain service to keep its own local outbox instead of using Audit DB as a shared business transaction database.
- `v2/infra/synthetic/fixture-registry.json`
  - CL-A with A-B1/A-B2, CL-B/B-B1, draft/suspended clinics, staff scopes, cross-clinic/revoked users, Doctor A/B/absence fixtures, offerings and branch price versions;
  - future Patient/Encounter/Billing/Notification fixture names are registered without claiming those slices implemented.
- `v2/infra/synthetic/Validate-SyntheticFixtures.ps1`
  - rejects non-synthetic registry and real-data-shaped contact/license/clinical properties.
- `v2/infra/recovery/Invoke-SyntheticRestoreDrill.ps1` and recovery checklist
  - refuses non-sandbox source names;
  - refuses existing restore target;
  - custom-format `pg_dump`, SHA-256, restore into new sandbox DB, per-table row-count comparison and measured restore time;
  - records OD-09 RPO/RTO as not production-evaluated.

## 2. Audit invariants verified

1. Audit chain scope is `clinic:<clinicId>` or `platform`; branch may only exist with clinic.
2. DENIED/FAILED audit entries require a reason.
3. Metadata is bounded and rejects common PHI/free-text keys.
4. Correlation id is a bounded string rather than a forced UUID so it can carry an approved distributed trace id.
5. PostgreSQL timestamp is normalized to microsecond precision before hashing, preventing false chain failures after persistence.
6. The hash chain is verified using insertion order; back-dated source timestamps do not reorder the chain.
7. Runtime audit rows cannot be mutated/deleted.
8. Audit read requires `audit.read`; append requires `audit.write`; event validation requires `event.validate`.
9. Each configured producer issuer has a distinct HMAC key mapping; a service cannot authenticate merely by changing the event JSON `source`.
10. Public/clinical users have no direct audit endpoint authorization in this service.

## 3. Event contract / privacy

P03 source contract:

`docs/clinic-v2/03_Architecture_and_Database/contracts/event-envelope.schema.json`

Implemented copy:

`v2/contracts/event-envelope.schema.json`

SHA-256 comparison executed:

- P03: `F27A0ECDB63F4EFA0E72B8473D82C0F2D354281F95FF42BBA8910DADFC512445`
- V2:  `F27A0ECDB63F4EFA0E72B8473D82C0F2D354281F95FF42BBA8910DADFC512445`

**MATCH.**

Additional runtime validator enforces:
- `specversion=1.0`;
- `application/json`;
- clinic required; branch cannot exist without clinic;
- event type `clinic.<domain>.<event>.vN`;
- minimal bounded safe metadata;
- PHI-shaped field names rejected.

This does not replace producer authentication or a consumer's tenant/version/idempotency checks.

## 4. Test evidence

### Normal unit/security suite

Command:

```powershell
mvn -q -f v2/services/audit-service/pom.xml test
```

Result:
- `WorkloadTokenVerifierTest`: **3 passed**
- `EventEnvelopeValidatorTest`: **3 passed**
- external DB suite skipped by default as designed

Normal suite: **6 passed, 0 failure/error**.

### Explicit PostgreSQL integration

Disposable environment:
- PostgreSQL 16 container: `clinic-v2-s005-audit-6820`
- source DB: `clinic_v2_s005_audit_sandbox`
- runtime login: non-superuser / `NOBYPASSRLS` synthetic account
- migrations: `V1__audit_and_outbox.sql`, `V2__audit_runtime_role.sql`

Command shape:

```powershell
mvn -q -f v2/services/audit-service/pom.xml \
  -Dtest=AuditExternalPostgresTest \
  -Daudit.it.enabled=true \
  -Daudit.it.jdbc-url=jdbc:postgresql://127.0.0.1:<ephemeral-port>/clinic_v2_s005_audit_sandbox \
  -Daudit.it.runtime-user=<synthetic-runtime> \
  -Daudit.it.runtime-password=<synthetic> test
```

Result: **3 passed, 0 failure/error, 0 skipped**.

Verified:
- two audit rows form a valid hash chain and can be traced by correlation id;
- runtime UPDATE/DELETE attempts on audit rows fail;
- publisher failure after durable outbox commit keeps the outbox PENDING with attempt/error;
- later retry publishes and marks the same outbox row PUBLISHED;
- invalid audit state is rejected.

This is an S0-05 reference implementation for AT-039 semantics. It does **not** claim every future domain producer has already adopted a local outbox.

### Build

```powershell
mvn -q -f v2/services/audit-service/pom.xml -DskipTests package
```

**PASS**, exit 0.

## 5. Synthetic fixture evidence

Command:

```powershell
powershell -ExecutionPolicy Bypass -File v2/infra/synthetic/Validate-SyntheticFixtures.ps1
```

Result:

`VALID synthetic fixture registry version=s0-05-v1`

The registry intentionally contains no patient names, phone, email, address, real license, diagnosis or clinical body. Future fixture keys represent planned cases only.

## 6. Backup / restore drill evidence

Executed against the disposable Audit S0-05 database only.

Evidence file:

`docs/audits/clinic-v2/P05-S0-05/restore-drill.json`

Observed at drill time:
- source tables:
  - `audit_v2.audit_chain_heads = 4`
  - `audit_v2.audit_events = 6`
  - `audit_v2.outbox_events = 6`
- restored table counts matched exactly;
- integrity: **true**;
- differences: none;
- dump SHA-256: `2dbc73da8966f0dc50336980fd0a2cda9379de88d03217e98ec63c12e4a62eee`;
- measured restore: **0.144 s**;
- total local drill: **0.812 s**.

These measurements are local synthetic evidence only.

**Not claimed:**
- proposed production RPO <=15 min;
- proposed production RTO <=4 h;
- encrypted/offsite immutable backup;
- whole-platform restore ordering;
- real medical document/object-store restore.

Those remain OD-09 / S6 operational gates.

## 7. Traceability to requested acceptance IDs

| Source | S0-05 evidence | Status |
|---|---|---|
| FR-OPS-04 | audit schema, immutable runtime/trigger, actor/object/scope/outcome/reason/correlation/hash chain | FOUNDATION VERIFIED |
| FR-OPS-05 | recovery checklist + safe restore script + actual synthetic restore/count/hash evidence | FOUNDATION VERIFIED |
| AT-038 | one source-service DB backup/restore with integrity and measured duration | PARTIAL PLATFORM COVERAGE; S6 must repeat per service/system |
| AT-039 | DB commit retains outbox through synthetic broker failure; retry succeeds | REFERENCE PATTERN VERIFIED; future domain producers must adopt |
| AT-068 | audit fields/hash/privacy/trace contract verified | STORAGE/CONTRACT VERIFIED; staff/price/refund cross-service E2E not yet available |
| NFR-03 | actor/action/object/scope/time/outcome/reason | IMPLEMENTED |
| NFR-04 | correlation id/event trace foundation | IMPLEMENTED IN AUDIT/EVENT CONTRACT; full distributed trace rollout pending |
| NFR-05 | restore test and checklist | SYNTHETIC DRILL VERIFIED; production target OPEN |
| NFR-08 | transactional outbox retry semantics | VERIFIED IN AUDIT SERVICE REFERENCE |

## 8. Carry-forward / no false completion

- Existing Clinic/IAM/Doctor/Catalog services are not retrofitted with synchronous calls to Audit Service. That would create the wrong transaction boundary. They should adopt their **local outbox** and safe audit/event producer pattern when integrated.
- Notification/Broker monitored sink, consumer inbox, dead-letter dashboards and cross-service replay evidence remain future integration work.
- Security-event external monitored sink remains a deployment/operations item.
- Patient/clinical/billing audit categories will be emitted only after their source owners exist; no placeholder clinical events are fabricated.
- S0-06 still owns Public/Workspace/Platform shells, tenant indicator and UI cache state.
- Overall A0 requires S0-02..06 combined evidence and Tech/Security/QA/owner sign-off.
- No production/V1 data was copied, migrated or modified by S0-05.

## 9. Completion statement

P05-S0-05 is **source-complete for its planned foundation outputs**: append-only/tamper-evident audit trace, non-PHI event envelope, transactional outbox reference, synthetic A/B registry and executable backup/restore checklist/drill. The evidence above deliberately distinguishes this foundation from later whole-platform adoption and production recovery certification.
