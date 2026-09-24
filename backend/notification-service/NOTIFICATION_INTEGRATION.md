# Task 06 — Notification integration contract v1 and verification

Status: **consumer plus appointment/medical/billing producer relays are integrated**. The appointment create/confirm path has been verified end-to-end against isolated PostgreSQL 16 and RabbitMQ infrastructure. Lab-result and invoice-paid relays have automated producer tests and live schema/boot validation; their full clinical/payment workflows still require dedicated E2E coverage.

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

| Event name | Owner / exact trigger condition | Aggregate ID | Integration status |
| --- | --- | --- | --- |
| `APPOINTMENT_CREATED` | Appointment booking transaction committed | appointment UUID | Producer connected; live E2E verified |
| `APPOINTMENT_CONFIRMED` | PENDING→CONFIRMED committed | appointment UUID | Producer connected; live E2E verified |
| `APPOINTMENT_RESCHEDULED` | Reception reschedule committed | appointment UUID | Producer connected; automated tests |
| `APPOINTMENT_CANCELLED` | Actual cancellation committed | appointment UUID | Producer connected; automated tests |
| `APPOINTMENT_REMINDER` | Task 03 / durable scheduled reminder for still-active appointment, unique occurrence | appointment UUID | Consumer recognizes; producer/scheduler not connected/verified |
| `LAB_RESULT_READY` | Authorized finalized result first becomes patient-visible | released lab result UUID | Producer connected; automated relay tests and live schema/boot validation |
| `INVOICE_PAID` | Verified payment settled and durably committed; NEVER from untrusted client pay flag | invoice UUID | Producer connected; automated relay tests and live schema/boot validation |

Appointment, medical-record and billing each persist a producer-owned outbox in the same local transaction as the business transition. Scheduled relays publish the six-field contract with mandatory routing and correlated confirms. `APPOINTMENT_REMINDER` remains intentionally unimplemented; do not infer seven-event completion.

### Recipient identity / role resolution — mandatory producer requirement

`recipientUserId` = **`identity.users.id` UUID / JWT subject**, NOT `patient.patients.id`, `doctor.doctors.id`, an appointment ID, the currently logged-in receptionist's JWT user ID, or an arbitrary frontend user ID. `aggregateId` is an entity ID used for business context and **never** an identity lookup. Self-service appointment booking stores the authenticated patient's Identity UUID. Staff-created appointments use the linked `userId` returned by the patient lookup. Medical and billing resolve a patient profile through `GET /internal/patients/{patientId}/recipient`, authenticated with `X-Internal-Service-Key`; the endpoint returns only profile ID and linked Identity UUID. Walk-in profiles without an Identity link are not eligible for user notifications. Never cross-query another service schema, substitute the staff actor, or invent an identifier.

Current producer events target the patient account only. Appointment ownership/role checks happen before the state transition. Lab release verifies the clinical publication transition before resolving the patient account and never includes lab content. Invoice notification is written only after the payment state becomes `PAID`; attempted or failed payments do not publish. Future multi-recipient behavior must emit one envelope per explicitly authorized Identity account.

### Stable identity, dedup and outbox requirements for Task 03/04/05

`eventId` is generated ONCE per committed business transition and persisted in the producing service's database; re-publish with **the same eventId** on retries, including after process restarts. For multiple intended recipients and channels, dedup key is `(eventId, recipientUserId, channel)`; channel currently **IN_APP only**. Unique partial DB index `idx_notifications_event_recipient_channel` enforces this and consumer uses atomic PostgreSQL `INSERT ... ON CONFLICT ... DO NOTHING`, so parallel deliveries do not create two rows. A new real transition needs a new `eventId` even for the same aggregate; repeated HTTP commands that do NOT cause a new state transition must not produce fresh events. Reminder occurrences need a stable scheduled occurrence key and deterministic once-per-occurrence outbox guard. Disabled channel creates a `SKIPPED` dedup tombstone (hidden from personal inbox): opting in later does not replay stale events.

**Transactional outbox in EACH producer service (implementation belongs to its owning task):**

1. In one local DB transaction, lock/check the business aggregate and authorization; apply the actual transition; resolve/validate recipient Identity user UUID(s) from authorized business context; insert immutable event envelope(s) to a producer-owned outbox table with UUID PK, stable `event_id`, event type, aggregate ID, recipient UUID, channel, `PENDING`, attempt count, next attempt time, and timestamps. Constrain uniqueness for the transition + intended recipient + channel. If any validation fails, roll back both state and outbox. No HTTP request, Rabbit publish, `@TransactionalEventListener` without persistent outbox, or provider call inside the DB transaction substitutes for this.
2. After transaction **commits**, a separate scheduled relay transaction claims due outbox rows (e.g. `FOR UPDATE SKIP LOCKED`, with durable lease/timeout if multiple workers); publish with JSON content type to exchange/routing above, AMQP mandatory routing and correlated broker confirms. Accept only ACK **and no unroutable returned message**; then mark producer outbox published. Broker ACK proves broker routing, NOT user delivery. On NACK, returned/unroutable message, timeout or connection loss, persist bounded backoff and diagnostic code only, without logging payload, contact, medical text or credentials. Alert on exhaustion; do not silently discard.
3. Crash before publish: pending row is retried. Crash after broker ACK but before outbox `PUBLISHED`: relay may send duplicate; consumer DB unique key absorbs it. Crash after consumer commit but before Rabbit ACK: redelivery is ignored. Crash between external provider accepting and DB `SENT` commit: SMS/email may be duplicated; only vendor-level idempotency can close that gap, and it has NOT been verified. Never regenerate `eventId` on retry.
4. Outbox must retain redaction-safe failures, delivery attempts, retention/repair policy and operator visibility; no destructive queue/database cleanup. Test rollback (no outbox row), concurrent repeat command (one event), publish NACK/return/timeout, restart replay, and mismatched profile/user IDs before declaring integration. The patient service's internal recipient lookup is deliberately narrow and requires the shared internal service key; rotate and scope that key in deployed environments.

Applied producer storage is `appointment.appointment_notification_outbox` (V5), `medical_record.lab_event_outbox` enhanced by V5, and `billing.invoice_paid_outbox` enhanced by V6. Each row carries a stable event UUID, aggregate reference, recipient Identity UUID, status, attempts, retry time, publish timestamp and a redaction-safe last error. No medical text, contact field, authorization header or payment detail is published.

## 2. Notification-owned persistence, broker handling and limits

V2 Flyway migration adds `recipient_user_id`, `event_id`, `event_type`, `read_at`, retry/outbox timestamps and unique dedup index to `notification.notifications`. V3 creates `notification.notification_preferences`. Existing rows lacking recipient UUID are not in a user's inbox. `ddl-auto=validate` remains. The notification row itself is its delivery outbox: commit first, scheduled `NotificationDispatchJob` publishes only `notificationId` to the queue; **not** address, message body or token. `NotificationOutboxPublisher` uses correlated publisher confirms and mandatory returns; on publish error tries at most five times with backoff, then DB `FAILED`. On successful broker ACK the row stays `PENDING` and may be re-enqueued after 60 seconds; provider success changes to `SENT` under pessimistic DB row lock; repeated redelivery then does not invoke provider again. Delivery failure backs off 30/60 seconds, terminal `FAILED` at three attempts. Opt-out before actual provider call marks `SKIPPED`. DB `SENT` means accepted by SMTP/vendor, not delivered to a person's inbox. Terminal `FAILED` requires an explicitly authorized, audited operator repair/reconciliation procedure; no automatic reset endpoint is implemented.

Current default RabbitMQ topology (declared in `RabbitMqConfig` and exercised on a live isolated RabbitMQ broker):

| Purpose | Name / routing |
| --- | --- |
| Direct exchange | `notification.exchange` |
| Business event route | `notification.business` → `notification.events.v2.queue` |
| Business event dead letter | `notification.exchange.dead` / `notification.business.dead` → `notification.events.v2.queue.dead` |
| Delivery ID route | `notification.delivery.v2` → `notification.delivery.v2.queue` |
| Delivery dead letter | `notification.exchange.dead` / `notification.delivery.v2.dead` → `notification.delivery.v2.queue.dead` |

Both new v2 queues declare their own DLX arguments; listener is configured with `defaultRequeueRejected(false)`. Invalid/poison events and rejected malformed delivery messages should dead-letter at broker level; **handled provider failures do not dead-letter**, they persist as `PENDING` retries or `FAILED`. Tests verify topology arguments, not live RabbitMQ behavior. Legacy `notification.delivery.queue` and `notification.events.queue` must NOT be deleted or redeclared with changed arguments: deployment operators must check/drain any pending/in-flight messages from the old queues, switch listeners/publishers and verify backlog under coordinated maintenance. Existing custom env overrides pointing at old queues can cause `PRECONDITION_FAILED`; remove/update them only after broker inventory. Do not claim live migration done.

**Limits:** The live E2E verified broker routing, producer publication and consumer persistence, but did not inject broker crashes or prove concurrent PostgreSQL dedup. SMTP does not guarantee exactly once after the provider-accepted/process-crash window. SMS uses `Idempotency-Key: <notification UUID>` in the generic client, but vendor support is unverified. Provider exceptions are logged by class only; broker credential separation remains a deployment responsibility.

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

The frontend-visible notification JSON fields are **`id`, `subject`, `content`, `type`, `status`, `sentAt`, `readAt`, `createdAt`**. The Java DTO also has internal `recipient` and `recipientUserId` accessors, but both have `@JsonIgnore`; neither email nor phone nor target UUID is serialized to browser responses. `subject`/`content` are always server-owned generic templates even for legacy stored rows. `sentAt` and `readAt` may be null. Relevant statuses: `PENDING`, `SENT`, `FAILED`; `SKIPPED` is excluded from `/my`. Expected status codes: unauthenticated 401, forbidden staff action 403, missing/cross-user notification 404, invalid body/type 400, opted-out manual channel 409. There is **no SSE, WebSocket, device PUSH or auto-refresh endpoint**; the frontend uses authenticated polling when the explicit notification feature flag is enabled. Frontend tests verify that all integration flags default to disabled.

## 4. Provider / deployment truth

`APP_SECURITY_JWT_SECRET` (required) must exactly match secure identity-service signing configuration. Keep datasource, RabbitMQ, SMTP and vendor credentials in deployment environment/secret manager; production broker/SMTP require authenticated TLS, network controls, and secret rotation. `APP_NOTIFICATION_EMAIL_ENABLED=false` and `APP_NOTIFICATION_SMS_ENABLED=false` by default. `mailpit:1025` / UI `:8025` in compose are **DEV CAPTURE ONLY**; even enabling email locally proves SMTP capture, not real user delivery. A production sender requires verified host, from-address, SMTP credentials, auth/TLS. Generic SMS adapter expects HTTPS Bearer endpoint accepting `{from,to,message}`; `http://sms-provider:9091/messages` in compose has no actual provider service and cannot pass HTTPS validation; DO NOT set enabled without contract/credentials tested against a real provider. `PUSH` legacy enum is explicitly unsupported, never advertised as an active provider. EMAIL/SMS business events remain fail-closed even if toggles are switched on, pending approved recipient-contact lookup and provider integration. Preferences do not imply a provider is operational.

## 5. Verification report / blockers

Verification on 2026-09-20 used an isolated Compose project so an existing developer stack remained untouched. All nine application images built successfully. Eight PostgreSQL schemas completed Flyway with no failed migration: identity V3, patient V2, doctor V3, catalog V2, appointment V5, medical-record V5, billing V6 and notification V3. All application services booted; authenticated smoke tests passed for ADMIN, RECEPTIONIST, DOCTOR and PATIENT. Access tokens succeeded while refresh tokens were rejected by patient, medical, billing and notification APIs. A patient-created appointment and receptionist confirmation produced two `PUBLISHED` appointment outbox rows and two deduplicated `SENT` in-app notifications through live RabbitMQ.

**Completion gates remaining:** run full lab-result-release and invoice-payment E2E scenarios, concurrent dedup and broker failure-injection tests; implement the reminder scheduler if that event remains required; validate real SMTP/SMS providers only when approved credentials and contact-resolution policy exist. Frontend integrations remain explicit opt-in (`VITE_FEATURE_*='true'`) until their environment is deliberately enabled.
