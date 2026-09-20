# Task 06 — Notification integration contract v1 and verification

Status: **notification consumer/API implementation only; cross-service end-to-end NOT verified**. This document describes only the Task 06 worktree, not unreviewed work in Task 03/04/05/07 worktrees. No producer or frontend files are modified here.

## 1. Event contract: verified scope and security boundary

The trusted producer sends JSON with **exactly these six v1 fields** to durable direct exchange `notification.exchange`, routing key `notification.business`:

```json
{
  "version": 1,
  "eventId": "c3ed33b3-0aee-40e6-8b2c-99816bce6d5b",
  "eventType": "APPOINTMENT_CONFIRMED",
  "aggregateId": "5e3fcd34-c2d1-4240-b39b-f08f2c7e4dc3",
  "recipientUserId": "ccf7cab7-c46a-4162-b37a-722765d907c1",
  "channel": "IN_APP"
}
```

These UUIDs are illustrative. The `BusinessNotificationEvent` Java record is authoritative. **Only `IN_APP` is accepted for v1 business events**. EMAIL/SMS event channels fail closed: current Identity API lacks an authorized lookup by another user's ID to verify email/phone destination. The generic SMTP and SMS provider classes exist but are NOT connected to an authorized business event flow. No `destination`, email, phone number, patient name, clinical result, diagnosis, prescription, invoice line item, JWT, secret, payment credential or arbitrary freeform body is permitted in this envelope. Do not infer recipient contact information from broker payload or an arbitrary staff POST. Producers require separately scoped RabbitMQ publish credentials, TLS and least-privilege permissions, never frontend access to broker. Notification-service does not re-check clinical role eligibility; the owning producer must verify it **before** enqueuing.

Accepted event names (enum `BusinessNotificationType`), with fixed generic server-owned templates:

| Event name | Owner / exact trigger condition | Aggregate ID | Status in THIS worktree |
| --- | --- | --- | --- |
| `APPOINTMENT_CREATED` | Task 03 / appointment booking transaction committed | appointment UUID | Consumer recognizes; producer not connected/verified |
| `APPOINTMENT_CONFIRMED` | Task 03 / PENDING→CONFIRMED committed | appointment UUID | Consumer recognizes; producer not connected/verified |
| `APPOINTMENT_RESCHEDULED` | Task 03 / actual date/time change committed | appointment UUID | Consumer recognizes; producer not connected/verified; no reschedule endpoint in this checkout |
| `APPOINTMENT_CANCELLED` | Task 03 / actual cancellation committed | appointment UUID | Consumer recognizes; producer not connected/verified |
| `APPOINTMENT_REMINDER` | Task 03 / durable scheduled reminder for still-active appointment, unique occurrence | appointment UUID | Consumer recognizes; producer/scheduler not connected/verified |
| `LAB_RESULT_READY` | Task 04 / authorized finalized result first becomes patient-visible | released lab result UUID | Consumer recognizes; producer not connected/verified |
| `INVOICE_PAID` | Task 05 / verified payment settled, state transition durably committed; NEVER from untrusted client pay flag | invoice UUID | Consumer recognizes; producer not connected/verified |

This matrix is based on read-only inspection of appointment/medical/billing source in the Task 06 checkout. Those modules contain no RabbitMQ notification publisher or producer outbox here. Other task branches may have changes that Task 06 has not verified. This is **not proof that producer integration is complete or incomplete in another task branch**. No seven-event workflow E2E has run.

### Recipient identity / role resolution — mandatory producer requirement

`recipientUserId` = **`identity.users.id` UUID / JWT subject**, NOT `patient.patients.id`, `doctor.doctors.id`, an appointment ID, the currently logged-in receptionist's JWT user ID, or an arbitrary frontend user ID. `aggregateId` is an entity ID used for business context and **never** an identity lookup. `AppointmentResponse.patientId` and `.doctorId` are profile IDs. The patient and doctor profile response DTOs have distinct `.id` (profile) and `.userId` (Identity account) fields. Only use `.userId` from an **authorized, verified** lookup of the exact owner profile. The current patient/doctor APIs in this checkout expose `/api/patients/profile` and `/api/doctors/profile` for the *current token owner*, not a validated staff lookup for arbitrary appointment participants. Task 03/04/05 must coordinate such access through the owning service's **explicit authorized API**, using service identity or delegated authorization with least privilege. Never invent a route, cross-query another service schema, use the staff actor's subject for the patient, convert one profile ID to another by assumption, or publish if owner mapping is missing. Fail closed, retain the producer outbox item for investigation/retry, and never substitute random identifiers. Identity `/api/users/me` only resolves the current account, not arbitrary recipients.

For appointment updates Task 03 resolves the patient account and assigned doctor account separately from their respective profile IDs and checks appointment participation; notify only role-authorized participants, one envelope per intended recipient. A receptionist/admin notification requires an explicitly selected staff Identity UUID authorized for that clinic/assignment, not a blanket broadcast. For lab release Task 04 verifies patient ownership and clinical publication before resolving the patient account; never include or reveal lab content in notification. For invoice paid Task 05 verifies durable real payment and invoice ownership before resolving the account; never publish on attempted/failed payment. If an event should reach multiple roles, emit a separate message for each authorized Identity account.

### Stable identity, dedup and outbox requirements for Task 03/04/05

`eventId` is generated ONCE per committed business transition and persisted in the producing service's database; re-publish with **the same eventId** on retries, including after process restarts. For multiple intended recipients and channels, dedup key is `(eventId, recipientUserId, channel)`; channel currently **IN_APP only**. Unique partial DB index `idx_notifications_event_recipient_channel` enforces this and consumer uses atomic PostgreSQL `INSERT ... ON CONFLICT ... DO NOTHING`, so parallel deliveries do not create two rows. A new real transition needs a new `eventId` even for the same aggregate; repeated HTTP commands that do NOT cause a new state transition must not produce fresh events. Reminder occurrences need a stable scheduled occurrence key and deterministic once-per-occurrence outbox guard. Disabled channel creates a `SKIPPED` dedup tombstone (hidden from personal inbox): opting in later does not replay stale events.

**Transactional outbox in EACH producer service (implementation belongs to its owning task):**

1. In one local DB transaction, lock/check the business aggregate and authorization; apply the actual transition; resolve/validate recipient Identity user UUID(s) from authorized business context; insert immutable event envelope(s) to a producer-owned outbox table with UUID PK, stable `event_id`, event type, aggregate ID, recipient UUID, channel, `PENDING`, attempt count, next attempt time, and timestamps. Constrain uniqueness for the transition + intended recipient + channel. If any validation fails, roll back both state and outbox. No HTTP request, Rabbit publish, `@TransactionalEventListener` without persistent outbox, or provider call inside the DB transaction substitutes for this.
2. After transaction **commits**, a separate scheduled relay transaction claims due outbox rows (e.g. `FOR UPDATE SKIP LOCKED`, with durable lease/timeout if multiple workers); publish with JSON content type to exchange/routing above, AMQP mandatory routing and correlated broker confirms. Accept only ACK **and no unroutable returned message**; then mark producer outbox published. Broker ACK proves broker routing, NOT user delivery. On NACK, returned/unroutable message, timeout or connection loss, persist bounded backoff and diagnostic code only, without logging payload, contact, medical text or credentials. Alert on exhaustion; do not silently discard.
3. Crash before publish: pending row is retried. Crash after broker ACK but before outbox `PUBLISHED`: relay may send duplicate; consumer DB unique key absorbs it. Crash after consumer commit but before Rabbit ACK: redelivery is ignored. Crash between external provider accepting and DB `SENT` commit: SMS/email may be duplicated; only vendor-level idempotency can close that gap, and it has NOT been verified. Never regenerate `eventId` on retry.
4. Outbox must retain redaction-safe failures, delivery attempts, retention/repair policy and operator visibility; no destructive queue/database cleanup. Test rollback (no outbox row), concurrent repeat command (one event), publish NACK/return/timeout, restart replay, and mismatched profile/user IDs before declaring integration. The producer service may expose an internal authenticated mapping API only after approval with the owning task; Task 06 does not add such APIs.

Illustrative producer-owned schema pattern, **not a migration applied to Task 03/04/05**: `producer_outbox(id uuid primary key, event_id uuid not null, aggregate_id uuid not null, recipient_user_id uuid not null, event_type varchar not null, channel varchar not null, payload jsonb not null, status varchar not null, attempts int not null default 0, next_attempt_at timestamptz not null, created_at timestamptz not null, updated_at timestamptz not null, unique(event_id, recipient_user_id, channel))`. Do not write medical text, contact fields or authorization headers to payload. The producer must design its *business transition* uniqueness separately (e.g. invoice payment ID/appointment status version/reminder occurrence), because the notification consumer cannot determine whether two different event IDs represent the same business transition.

## 2. Notification-owned persistence, broker handling and limits

V2 Flyway migration adds `recipient_user_id`, `event_id`, `event_type`, `read_at`, retry/outbox timestamps and unique dedup index to `notification.notifications`. V3 creates `notification.notification_preferences`. Existing rows lacking recipient UUID are not in a user's inbox. `ddl-auto=validate` remains. The notification row itself is its delivery outbox: commit first, scheduled `NotificationDispatchJob` publishes only `notificationId` to the queue; **not** address, message body or token. `NotificationOutboxPublisher` uses correlated publisher confirms and mandatory returns; on publish error tries at most five times with backoff, then DB `FAILED`. On successful broker ACK the row stays `PENDING` and may be re-enqueued after 60 seconds; provider success changes to `SENT` under pessimistic DB row lock; repeated redelivery then does not invoke provider again. Delivery failure backs off 30/60 seconds, terminal `FAILED` at three attempts. Opt-out before actual provider call marks `SKIPPED`. DB `SENT` means accepted by SMTP/vendor, not delivered to a person's inbox. Terminal `FAILED` requires an explicitly authorized, audited operator repair/reconciliation procedure; no automatic reset endpoint is implemented.

Current default RabbitMQ topology (declared in `RabbitMqConfig`; **not integration-tested on a live broker**):

| Purpose | Name / routing |
| --- | --- |
| Direct exchange | `notification.exchange` |
| Business event route | `notification.business` → `notification.events.v2.queue` |
| Business event dead letter | `notification.exchange.dead` / `notification.business.dead` → `notification.events.v2.queue.dead` |
| Delivery ID route | `notification.delivery.v2` → `notification.delivery.v2.queue` |
| Delivery dead letter | `notification.exchange.dead` / `notification.delivery.v2.dead` → `notification.delivery.v2.queue.dead` |

Both new v2 queues declare their own DLX arguments; listener is configured with `defaultRequeueRejected(false)`. Invalid/poison events and rejected malformed delivery messages should dead-letter at broker level; **handled provider failures do not dead-letter**, they persist as `PENDING` retries or `FAILED`. Tests verify topology arguments, not live RabbitMQ behavior. Legacy `notification.delivery.queue` and `notification.events.queue` must NOT be deleted or redeclared with changed arguments: deployment operators must check/drain any pending/in-flight messages from the old queues, switch listeners/publishers and verify backlog under coordinated maintenance. Existing custom env overrides pointing at old queues can cause `PRECONDITION_FAILED`; remove/update them only after broker inventory. Do not claim live migration done.

**Limits:** PostgreSQL atomic dedup (including concurrent insert) is designed but not yet integration-tested. SMTP does not guarantee exactly once after provider-accepted/process-crash window. SMS uses `Idempotency-Key: <notification UUID>` in the generic client, but vendor support unverified. Provider exceptions are logged by class only (never exception body); no recipient email/phone, clinical details, JWT or secrets in normal logs. Broker producer credentials and privilege separation remain deployment responsibilities.

## 3. Task 07 — frontend API contract (gateway route `/api/notifications/**`)

All operations use access JWT `Authorization: Bearer <token>`, subject = current **Identity UUID**. Never send userId/patientId as an inbox query parameter or read ID from local storage to override subject. Success uses the common `ApiResponse<T>` wrapper `{ "success": true, "message": "...", "data": ..., "timestamp": "..." }`.

| Method and path | Who can call | Semantics / result |
| --- | --- | --- |
| `GET /api/notifications/my` | Any authenticated role | Sorted own messages by `createdAt DESC`; excludes `SKIPPED`; array of `NotificationResponse` |
| `GET /api/notifications/my/preferences` | Any authenticated role | Array `{ "type": "IN_APP|EMAIL|SMS|PUSH", "enabled": boolean }`; defaults IN_APP true, others false |
| `PUT /api/notifications/my/preferences/{type}` | Own JWT account | JSON `{ "enabled": true }` or false; returns same preference DTO; PUSH rejected 400, though shown false in GET |
| `PATCH /api/notifications/{id}/read` | Only recipient Identity account | No request body; idempotent; returns updated response, sets `readAt` once; inaccessible 404 |
| `GET /api/notifications/{id}` | Owner or `ROLE_ADMIN`/`ROLE_RECEPTIONIST` | Sanitized response; other users receive 404, including suppressed items (except admin audit) |
| `GET /api/notifications` | `ROLE_ADMIN`/`ROLE_RECEPTIONIST` | Admin/reception list for operational purposes; generic template only, no destination/contact fields |
| `POST /api/notifications` | `ROLE_ADMIN`/`ROLE_RECEPTIONIST` | Manual `IN_APP` ONLY, generic fixed content; JSON fields `recipient: "in-app"`, `subject`, `content`, `type:"IN_APP"`, `recipientUserId:<verified Identity UUID>`; untrusted supplied text is discarded; external/PUSH rejected 400 |

The frontend-visible notification JSON fields are **`id`, `subject`, `content`, `type`, `status`, `sentAt`, `readAt`, `createdAt`**. The Java DTO also has internal `recipient` and `recipientUserId` accessors, but both have `@JsonIgnore`; neither email nor phone nor target UUID is serialized to browser responses. `subject`/`content` are always server-owned generic templates even for legacy stored rows. `sentAt` and `readAt` may be null. Relevant statuses: `PENDING`, `SENT`, `FAILED`; `SKIPPED` is excluded from `/my`. Expected status codes: unauthenticated 401, forbidden staff action 403, missing/cross-user notification 404, invalid body/type 400, opted-out manual channel 409. There is **no SSE, WebSocket, device PUSH or auto-refresh endpoint**; Task 07 should use normal authenticated polling if needed. No frontend edits or integration tests were made here.

## 4. Provider / deployment truth

`APP_SECURITY_JWT_SECRET` (required) must exactly match secure identity-service signing configuration. Keep datasource, RabbitMQ, SMTP and vendor credentials in deployment environment/secret manager; production broker/SMTP require authenticated TLS, network controls, and secret rotation. `APP_NOTIFICATION_EMAIL_ENABLED=false` and `APP_NOTIFICATION_SMS_ENABLED=false` by default. `mailpit:1025` / UI `:8025` in compose are **DEV CAPTURE ONLY**; even enabling email locally proves SMTP capture, not real user delivery. A production sender requires verified host, from-address, SMTP credentials, auth/TLS. Generic SMS adapter expects HTTPS Bearer endpoint accepting `{from,to,message}`; `http://sms-provider:9091/messages` in compose has no actual provider service and cannot pass HTTPS validation; DO NOT set enabled without contract/credentials tested against a real provider. `PUSH` legacy enum is explicitly unsupported, never advertised as an active provider. EMAIL/SMS business events remain fail-closed even if toggles are switched on, pending approved recipient-contact lookup and provider integration. Preferences do not imply a provider is operational.

## 5. Verification report / blockers

Run from worktree's `backend`: `mvn -pl notification-service -am test` (no `clean`, no destructive database operations). Tests cover real JWT in Spring Security filter, refresh token rejection, role checks, JWT subject-scoped inbox/read/preferences, cross-user 404, duplicate redelivery/dedup method, opt-out and tombstone, bounded broker/provider retry, provider disabled guard, queue DLX declarations, and JSON PII filtering. Mocked broker/provider tests are **NOT** PostgreSQL/RabbitMQ integration tests; the atomic native insert, actual Flyway validation, broker confirm/returns, queue declaration and real redelivery must be validated against isolated test infrastructure. On 2026-09-20, `docker info` could not connect to Docker Desktop Linux daemon; local TCP ports 5432 (PostgreSQL), 5672 (RabbitMQ) and 1025 (Mailpit) were all unreachable. No real integration or producer-to-frontend E2E result can be claimed. No production credentials or provider tests are available.

**Completion gates remaining:** Task 03/04/05 implement and test their own transactional producer outboxes and authorized account mappings; reconcile six-field v1 contract; approve any new identity/contact API before external channels; Test team runs PostgreSQL Flyway V2/V3, concurrent insert, Rabbit queue DLX and consumer E2E against disposable infrastructure; Task 07 consumes the documented API. Keep Task 06 OPEN and do not merge/claim E2E until verified.
