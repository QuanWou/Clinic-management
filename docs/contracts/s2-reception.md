# S2 Reception / Encounter contract

Implementation checkpoint: 2026-10-01. This contract maps Phase 05 S2-01..04 to FR-IAM-05/06, FR-SCH-06..09 and FR-MED-01. Acceptance limits are recorded in `docs/audits/clinic-v2/P05-S2/S2_Gap_Review.md`.

## Ownership and authorization

Patient owns identity/profile, clinic link, matching suggestions and local review. Appointment owns confirmed booking, arrival claim, exception history and frozen price. Encounter owns visit/check-in, point/day queue, assignment and visit history. Clinic owns active clinic/branch. Doctor owns effective affiliation and resolves its platform doctor user through canonical IAM. Identity owns membership/grants; legacy login remains a compatibility boundary.

Every staff command resolves its bearer through Identity and checks canonical IAM capability against the requested clinic/branch. Reception requires an active `STAFF` membership with `RECEPTION` capability and a real branch in that clinic; per-branch grants are not required for the front-desk workflow. Billing, clinical, and administrative capabilities remain branch-scoped. Point configuration and doctor-absence reporting require `CLINIC_CONFIG`. Doctor start/worklist requires IAM `DOCTOR_WORK` with role `DOCTOR` and the stored assigned doctor user. Membership revocation is rechecked on the next request. Legacy roles alone cannot authorize a command.

Encounter sets transaction-local clinic AND branch and forces RLS on all business tables. Runtime login must inherit `clinic_v2_encounter_runtime` without superuser, BYPASSRLS, DDL or delete privileges. Patient reception access is clinic scoped, with branch authorization at its API; Appointment is clinic scoped with explicit branch/object checks. These are not all identical RLS boundaries.

## HTTP surfaces

All staff routes below require bearer authentication. Let `B=/api/clinics/{clinicId}/branches/{branchId}`. JSON success bodies are returned directly. Validation/auth/dependency/conflict responses use each service's API problem envelope. Reload on optimistic-version conflict; an ambiguous write must reuse its key and business payload.

| Owner | Method / path | Command or result |
|---|---|---|
| Clinic | GET `/api/clinics/{clinicId}/reception-directory` | Clinic name and only authorized active branches; no legal/contact fields |
| Patient | GET `B/patients/match-suggestions?name=&dateOfBirth=&phone=` | At most 20 clinic-local candidates; exact phone OR name+DOB; suggestions never merge identities |
| Patient | GET `B/patients/recent` | At most 20 most recently created, non-revoked clinic-local patient links for the reception table; requires RECEPTION authorization and branch context |
| Patient | POST `B/patients/walk-in` | Idempotency-Key; fullName, optional dateOfBirth/phone, reason; provisional identity/link without web account |
| Patient | POST `B/patients/{patientId}/review` | expectedVersion, identityEvidenceRef, reason; records explicit provisional→verified review; does not assign platform account |
| Encounter | GET / POST `B/service-points` | List active points / create code+name with manager capability |
| Encounter | GET `B/reception/appointments?date=` | Scoped daily Appointment read, maximum 200 items |
| Encounter | POST `B/visits/walk-in` | Idempotency-Key; patientId, doctorId, servicePointId, reason |
| Encounter | POST `B/appointments/{appointmentId}/check-in` | Idempotency-Key; patientId, servicePointId, reason |
| Encounter | GET `B/visits/{id}` | Authorized persisted visit and current active ticket |
| Encounter | GET `B/queue?servicePointId=&date=` | Tickets within branch/point/local day |
| Encounter | POST `B/queue/{id}/call`, `/skip`, `/transfer` | expectedVersion, reason; transfer also destinationPointId within branch |
| Encounter | GET `B/doctor/worklist` | Assigned doctor's own waiting/in-progress/awaiting-results visits |
| Encounter | POST `B/visits/{id}/start` | expectedVersion, reason; only assigned doctor starts called ticket |
| Encounter | GET / POST `B/appointments/{id}/exceptions` | List / keyed type LATE, NO_SHOW or DOCTOR_ABSENT + reason; proxies authoritative Appointment command |
| Encounter | GET `B/reception/arrivals?date=` | Up to 100 distinct visits with this staff actor's receipts on the selected local day; no retry keys/reasons/contact fields |
| Encounter | POST `B/reception/arrivals/{id}/recover` | expectedVersion + recovery reason; only receipt owner; completed outcome is read without new visit, pending claim resumes original IDs/point |
| Doctor | GET / POST `B/doctors/{doctorId}/absences` | List up to 100 source intervals / report startsAt, endsAt, reason with Idempotency-Key and manager capability; each interval bounded to 31 days |
| Encounter | POST `B/doctor-absences/{id}/apply` | Manager reads authoritative Doctor interval, applies next 10 confirmed impacted bookings; returns recorded count, retryRequired IDs, hasMore |

Internal Patient link, Doctor assignment and Appointment read/claim/exception routes accept only bounded workload JWTs for their audience and required scope. Encounter issuer/subject is `encounter-service`; keys are configured explicitly in each target. These routes are not exposed as anonymous public business APIs.

## Atomicity and recoverable states

Walk-in creates visit with `appointment_id=null`, one check-in, a numbered ticket, history and outbox in one local transaction. Same clinic/branch/actor/operation/key serializes and binds the payload hash. A changed payload under an existing key conflicts. Ticket number counter is atomic per clinic/branch/point/local day (`Asia/Ho_Chi_Minh`); queue code differs from patient/appointment/visit identifiers.

Booking check-in verifies booking scope/patient/link/date and active doctor. Local creation stores `ARRIVAL_PENDING` and one visit per appointment. The Appointment claim runs outside the Encounter transaction. Appointment atomically claims the confirmed booking for that encounter; another encounter cannot claim it. A lost response leaves no active queue ticket, and retry resumes the same local visit. Only successful claim activates the check-in/ticket. This is a recoverable two-service operation, not a distributed transaction.

Server recovery lists persisted actor-owned receipts within exact authorized clinic/branch/date. After browser reload, the staff member selects the known visit; no patient payload or original key must be stored in the browser. Pending recovery validates current source IDs/status, claims the same visit and serializes activation. If the source already claimed it, that acknowledgement can resume after midnight; a still-confirmed booking must satisfy Appointment's scheduled-day claim rule. Original reception reason is retained in new receipts; historical null reason uses the explicit recovery reason. Other authorized staff cannot use this owner-recovery endpoint. Supervisor handoff/abandonment and operational reconciliation remain separate work.

Call requires the first waiting ticket, with at most one CALLED/SERVING ticket per point/day. Skip keeps history; transfer closes the old ticket and creates a new one for the same visit. Already in-care visits reject reception transitions. Start moves CALLED→SERVING and WAITING→IN_PROGRESS; no clinical sign/release or financial completion is implied.

Late and no-show require the scheduled start to have passed. No-show sets NO_SHOW; late and doctor-absence keep CONFIRMED and create an OPEN exception. Open DOCTOR_ABSENT blocks the booking's arrival claim. All preserve price snapshot/payment data.

Doctor owns immutable keyed absence intervals with actor/reason. Public doctor source exposes only unavailable windows, never reason/actor. Appointment excludes overlapping windows from availability and revalidates them for new holds/confirmation/reschedule; half-open adjacent boundaries remain usable. Internal current-time assignment rejects an absent doctor. Source read/command concurrency remains a cross-service boundary; this does not claim a distributed lock spanning Doctor and Appointment.

Reporting an interval does not automatically process historical bookings. Manager explicitly applies batches of 10 via Encounter, which retrieves the source interval and current impacted confirmed bookings. Appointment locks each booking and rechecks doctor and slot overlap inside the exception transaction, rejects a stale/rescheduled impact, and uniquely deduplicates `(appointment, source_absence_id)` across managers/retries. Each successful item persists history/outbox; partial failure is visible and retryable, not an atomic all-or-nothing batch. Process remaining batches and contact affected patients. Background propagation, absence amendment/cancellation, exception resolution, assignment/rebooking and approved money remediation are still unfinished; AT-057 remains partial.

## Audit and notification delivery

Encounter emits `clinic.encounter.checked_in.v1`, `clinic.encounter.queue_changed.v1`, `clinic.encounter.started.v1`. Stable outbox event ID, source `/services/encounter`, subject `encounter/{id}`, clinic/branch, aggregate version and identifiers are persisted locally. Free-text reason/name/contact/clinical fields stay out of the event. Audit verifies workload, envelope, canonical type/source and identifiers, deduplicates inbox and appends its chain atomically. Relay uses persisted event ID, bounded HTTP timeouts, backoff and DLQ after five unsuccessful deliveries. Operational DLQ replay tooling remains a rollout requirement.

Appointment emits `clinic.appointment.exception_recorded.v1` via its existing independent Notification/Audit targets. Staff actor and patient recipient are distinct. A verified account receives generic in-app ACTION_REQUIRED; exception stops ordinary reminders. If no account is resolved, `MANUAL_CONTACT_REQUIRED` is persisted and acknowledged without fabricating delivery. Notification ACK is consumer persistence, not proof the patient read a message or received SMS/email. Reasons are retained only in source history.

See verification commands and configured peer keys in `frontend/S2_RUNBOOK.md`.
