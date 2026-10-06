# S1 projection and appointment delivery

## Projection producers

Clinic, Doctor and Catalog each capture an invalidation in their own `projection_outbox` from a database trigger inside the business transaction. Rollback removes the event. No remote service is called from that transaction.

The relay sends POST `/api/internal/projections/snapshot` using source-specific workload JWTs (`search.project`, audience `search-service`). A delivery contains:
- `event`: canonical non-PHI envelope, source `/services/{clinic|doctor|catalog}`, type `clinic.{domain}.public_changed.v1`, immutable event ID, captured aggregate version/time, clinic/correlation and only clinic ID in data.
- `eventId`, `clinicId`, `sourceVersion`: delivery identity and version of the consistent public snapshot.
- `snapshot`: public DTO fields only, under `clinic`, `doctors` or `offerings`. It is projection material, separate from event metadata. No owner contact, license document reference, practitioner registration code or patient data.

Snapshot and its source version are read consistently using repeatable-read; full child snapshots hide removed rows. The consumer commits inbox `(authenticated source,event ID)` and projection/version in one transaction. Versions are monotonic per source/clinic. The source identity comes from JWT, not request JSON. A missing parent/branch causes retry. Parent publication and branch scope govern all public reads, including suspended clinics. Public Doctor/Catalog endpoints additionally recheck Clinic directly.

Enable relay with `PROJECTION_RELAY_ENABLED=true`, `PROJECTION_RELAY_SEARCH_URL`, `PROJECTION_RELAY_SECRET` in each producer. Search must have the matching `SEARCH_CLINIC_SECRET/DOCTOR_SECRET/CATALOG_SECRET`. Clinic publication feature flag remains authoritative and disabled by default. Refresh defaults to 60 seconds for changes driven by time (price/affiliation/license), so projection freshness is eventual; booking always revalidates sources.

Five attempts lead to DEAD_LETTER. Backoff is bounded. Last error stores only a fixed safe code. A deployment operator should fix the consumer/configuration before resetting a selected dead-letter event to PENDING using a reviewed database operation. Replay preserves event ID and relies on inbox idempotency; do not truncate inbox/version tables.

## Appointment consumers

Appointment local outbox records confirmation/cancel/reschedule in the same transaction as history/state. Envelope ID equals its persisted event ID. Metadata contains only IDs, status and appointment start time; no name/contact/reason/diagnosis is transported.

Enable `APPOINTMENT_RELAY_ENABLED=true`; configure `APPOINTMENT_RELAY_NOTIFICATION_URL`, `APPOINTMENT_RELAY_AUDIT_URL`. Notification audience/scope: `notification-service / notification.consume`. Audit: `audit-service / audit.write`. Both accept issuer `appointment-service` and must use the matching Appointment workload secret (`NOTIFICATION_APPOINTMENT_SECRET`, `audit.security.appointment-secret`). Per-consumer acknowledgement timestamps avoid resending to an acknowledged consumer while another target fails. A lost response is safe because both consumers keep an inbox.

Consumer failure cannot roll back a committed booking. Notification is currently in-app only; reminder consent starts false. Audit dedup and chain append commit together. No outbox is represented as external exactly-once delivery.

## Verification boundary

`verify-s1-local.ps1` creates fresh loopback PostgreSQL databases and non-bypass runtime logins, runs selected relevant unit/PostgreSQL suites without skips, packages, then starts real service jars for HTTP transport verification. Its Identity endpoint is explicitly a synthetic contract fixture; real Identity signup/login and a full production journey remain separate evidence. Browser tests use HTTP fixtures and prove UI behavior/layout, not backend truth. Test publication flag/secrets apply only to these disposable synthetic databases.

