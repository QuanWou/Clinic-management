# Notification V2 — S1 in-app delivery

Port 8100. This slice delivers safe booking confirmations, cancellations, reschedules and consented reminders inside the application. It does not send email/SMS/push or expose patient contact or clinical body.

- POST `/api/v2/internal/notifications/events`: appointment workload, `notification.consume`, audience `notification-v2-service`.
- GET `/api/v2/me/notifications`: verified current user, RLS; latest 50.
- GET/PUT `/api/v2/me/notification-preferences`: current user; reminders are opt-in, initially false.
- Local inbox deduplicates source/event ID; appointment source version prevents old confirmation/reschedule from reviving cancelled reminders.
- Background reminders are emitted once per appointment version and only while confirmed, consented, and before the start time.

Use `NOTIFICATION_V2_DB_URL/DB_USER/DB_PASSWORD`, separate `NOTIFICATION_V2_MIGRATION_DB_USER/MIGRATION_DB_PASSWORD`, `NOTIFICATION_V2_IDENTITY_URL`, `NOTIFICATION_V2_APPOINTMENT_SECRET`. Login must be NOSUPERUSER NOBYPASSRLS and inherit `clinic_v2_notification_runtime`, not own tables. Identity URL resolves the existing V2 current-user contract.

`notification.reminder-before-seconds` is configurable (default 86400; bounds 60–604800). This is a technical default for the opt-in in-app channel, not approval of payment, clinical or legal policy. Deployment must choose and validate the intended reminder interval.

Fresh PostgreSQL tests: `v2/scripts/verify-s1-local.ps1`.

