# Clinic Management V2 — P05-S0-05 Audit / Eventing foundation

**Status:** S0-05 implementation for append-only audit trace, non-PHI integration envelope, local transactional outbox reference, synthetic A/B fixtures and sandbox restore drill. This is not a production retention/RPO/RTO certification.

## Audit model

Audit events record:

- event id
- clinic / branch scope
- actor and optional delegated actor
- category and action
- resource type + source-owned resource id
- outcome and reason
- correlation id
- UTC business timestamp
- safe metadata only
- previous hash + SHA-256 event hash

Rows are append-only. Runtime role receives SELECT/INSERT only on `audit_events`; DB triggers also reject UPDATE/DELETE. A per-scope chain head is row-locked so each clinic (or platform scope) forms a tamper-evident hash chain.

The audit service is **not** a clinical/document database. Never put diagnosis, symptoms, contact data, clinical body, prescription text, result text, DOB or equivalent PHI in audit metadata.

## Internal APIs

All non-health routes require a short-lived workload JWT with issuer-specific secret and audience `audit-v2-service`.

- `POST /api/v2/internal/audit/events` — scope `audit.write`
- `GET /api/v2/internal/audit/trace/{correlationId}` — scope `audit.read`
- `GET /api/v2/internal/audit/chain?clinicId=<uuid>` — scope `audit.read`
- `POST /api/v2/internal/event-envelope/validate` — scope `event.validate`

Audit read is therefore separate from ordinary clinic/clinical user access. S0-06 Platform Console/BFF must still authorize the human operator before calling an audit-read workload route.

## Non-PHI event envelope

The canonical JSON schema is copied from the approved P03 source:

`v2/contracts/event-envelope.schema.json`

Fields follow the CloudEvents-inspired contract: `specversion,id,source,type,subject,time,datacontenttype,data` plus `clinicid,branchid,correlationid,causationid,aggregateversion`.

The runtime validator also rejects common PHI/free-text field names and oversized free text. IDs and safe states are allowed; raw clinical/contact content is not.

## Outbox semantics

An audit append for a clinic persists a safe `clinic.audit.recorded.v1` event into the audit service's **local** outbox in the same transaction.

`OutboxRelayService` demonstrates the required P03 transport semantics:

- DB commit first
- relay later
- retry with increasing delay
- dead-letter after configured attempts
- successful publish marks local row published
- a publish followed by DB failure may be repeated; downstream business consumers must deduplicate by event id

This is a reference for the audit service itself. Other domain services must keep their own outbox in their own DB transaction; they must not centralize their business transaction into this database.

## Configuration

Use isolated V2 credentials only.

```text
AUDIT_V2_DB_URL=jdbc:postgresql://127.0.0.1:<port>/<sandbox-db>
AUDIT_V2_DB_USER=<runtime login>
AUDIT_V2_DB_PASSWORD=<runtime secret>
AUDIT_V2_MIGRATION_DB_USER=<migration login>
AUDIT_V2_MIGRATION_DB_PASSWORD=<migration secret>

AUDIT_V2_IDENTITY_SECRET=<issuer-specific >=32-byte secret>
AUDIT_V2_CLINIC_SECRET=<issuer-specific >=32-byte secret>
AUDIT_V2_DOCTOR_SECRET=<issuer-specific >=32-byte secret>
AUDIT_V2_CATALOG_SECRET=<issuer-specific >=32-byte secret>
AUDIT_V2_OUTBOX_MAX_ATTEMPTS=5
AUDIT_V2_PORT=8096
```

Do not share one secret across all producers in production. New producer services require an explicit issuer/key mapping and least-privilege scopes.

## Synthetic / recovery assets

- `v2/infra/synthetic/fixture-registry.json`
- `v2/infra/synthetic/Validate-SyntheticFixtures.ps1`
- `v2/infra/recovery/README.md`
- `v2/infra/recovery/Invoke-SyntheticRestoreDrill.ps1`

The restore helper refuses non-sandbox database names and restores only into a new `*_restore_sandbox` database.

## Verification

Normal unit/security suite:

```powershell
mvn -q -f v2/services/audit-service/pom.xml test
mvn -q -f v2/services/audit-service/pom.xml -DskipTests package
```

The explicit PostgreSQL integration suite is opt-in and accepts only the exact disposable database name `clinic_v2_s005_audit_sandbox`.

Evidence is stored under:

`docs/audits/clinic-v2/P05-S0-05/`

## Carry-forward

- Domain-service adoption of transactional outbox/audit emission continues as those slices are implemented.
- Unified monitored security sink, broker/DLQ dashboards and alert routing remain deployment work under S0-05/S6 operations.
- Production retention, offsite immutable storage, encryption key ownership, RPO/RTO and recurring drill cadence require OD-09 / operational approval.
- S0-06 must implement human-facing Platform/Workspace shells and cache-safe tenant indicators; this audit service does not grant human permissions by itself.
