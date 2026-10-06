# Doctor absence and exception recovery

Doctor owns immutable intervals. Manager/Owner canonical `CLINIC_CONFIG` authority, branch eligibility, expected source version, bounded reason and Idempotency-Key are required for cancellation/amendment. Cancel transitions ACTIVE version 1 to CANCELLED version 2. Amendment cancels the old interval and appends a new ACTIVE source with a distinct ID. Original interval/reason/actor and command receipts cannot be rewritten by the runtime. Every replay rechecks authority and exact payload.

Doctor routes under `/api/clinics/{c}/branches/{b}/doctors/{d}/absences`:

- `GET`, `POST`: source list and report.
- `POST /{id}/cancel`: `{expectedVersion,reason}`.
- `POST /{id}/amend`: `{expectedVersion,startsAt,endsAt,reason}`; response `{previous,replacement}`.

Minimal delivery metadata is captured atomically with source state. `absence.relay.enabled=true`, `absence.relay.appointment-url` and a separate `absence.relay.secret` enable the Doctor worker. Its bounded dedicated workload token has issuer/subject `doctor-service`, audience `appointment-service`, scope `appointment.absence.consume`. Appointment requires matching `appointment.security.absence-secret`. Missing/invalid/wrong-peer credentials are denied. Lease claim/ACK transactions exclude HTTP; expired leases resume and delivery failures back off toward DLQ. General runtime business queries retain their tenant context.

Appointment `/api/internal/doctor-absences` accepts source-owned ID, scope, doctor, immutable interval, state/version, event and actor IDs. It processes at most ten appointments per batch, rechecks actual current doctor/time overlap and deduplicates by source absence/appointment. A source version cannot be overwritten by an older replay. Cancellation closes only that source's open exceptions; a concurrent other absence remains open. Bookings and their frozen prices survive propagation. It neither collects/refunds money nor signs/releases clinical work.

Encounter's user-facing `POST /api/clinics/{c}/branches/{b}/appointments/{a}/exceptions/{e}/resolve` is Manager/Owner-only, keyed, versioned and reasoned. Appointment verifies a cancelled source/booking or a confirmed booking moved outside the original source interval; a mere acknowledgement cannot bypass an active absence. Late acknowledgement and closed no-show tasks preserve the actual booking state. Unknown responses must replay the exact original body/key/version, including after version changed on success. Canonical authorization is still rechecked on replay.

Resolution receipt, exception state, unchanged booking status with new version, history and identifier-only `clinic.appointment.exception_resolved.v1` audit/notification outbox commit together. Notification resolves the actual Patient-owned recipient. Source ordering prevents stale exceptions from reinstating attention after a later cancellation. Reminders are eligible again only for CONFIRMED with no other open exception and existing opt-in; cancelled/no-show/checked-in/fulfilled bookings remain terminal for reminders. Preview text contains no reason or clinical content.

Reception UI exposes actual source state and explicit cancel/amend/resolve commands, freezes dependent scope during unknown outcomes, ignores late responses on scope/logout changes and requires reloading sources after acknowledgement. Patient cancellation/reschedule uses existing own-account booking APIs; staff does not impersonate the patient or invent a refund policy.
