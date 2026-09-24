# Appointment lifecycle event contract — draft for Task 06

**Status:** Contract proposal only. No producer, outbox migration, event publisher, or RabbitMQ call has been implemented by Task 03. Task 01 owns the legacy create/confirm/cancel flows and Task 06 owns the notification consumer. Do not claim that an event is delivered until those tasks agree on the outbox implementation and integration tests pass.

## Envelope (JSON v1)

```json
{
  "eventId": "4aabfb78-f8ce-45ed-9cbf-c63ce18133b5",
  "eventType": "clinic.appointment.rescheduled.v1",
  "eventVersion": 1,
  "aggregateId": "9d8e254f-d9c2-4f6a-b894-084e01f2e63c",
  "aggregateVersion": 3,
  "occurredAt": "2026-09-20T01:00:00Z",
  "actorUserId": "da45992e-fbc8-4f84-bc13-42a19ff48061",
  "payload": {
    "appointmentId": "9d8e254f-d9c2-4f6a-b894-084e01f2e63c",
    "patientId": "7ec74bdf-3450-46aa-b1b5-a1d41b65a2fb",
    "doctorId": "ce691eeb-b983-4817-a3f5-2d194f2b91b4",
    "appointmentDate": "2026-09-21",
    "startTime": "10:00:00",
    "endTime": "10:30:00",
    "status": "PENDING",
    "previousSchedule": {
      "doctorId": "ce691eeb-b983-4817-a3f5-2d194f2b91b4",
      "appointmentDate": "2026-09-21",
      "startTime": "09:00:00",
      "endTime": "09:30:00"
    }
  }
}
```

| Event type | Source transition | Extra contract |
| --- | --- | --- |
| `clinic.appointment.created.v1` | Successful patient/staff booking to `PENDING` | `previousSchedule = null` |
| `clinic.appointment.confirmed.v1` | `PENDING → CONFIRMED` | `previousSchedule = null` |
| `clinic.appointment.rescheduled.v1` | Allowed pending/confirmed booking → new `PENDING` slot | `previousSchedule` required, containing the old doctor/date/time |
| `clinic.appointment.cancelled.v1` | Allowed booking → `CANCELLED` | `previousSchedule = null` |

- `eventId` is generated once at the appointment state transition; it is **stable across retries**. The notification consumer deduplicates on `(eventId, consumerName)`, not appointmentId (one appointment has multiple transitions).
- `aggregateId = payload.appointmentId`. `aggregateVersion` is a positive, strictly increasing integer for one appointment; Task 01/outbox implementation must establish an atomic version allocation policy before enabling publication. Consumers handle duplicates and stale/out-of-order versions.
- `occurredAt` is UTC ISO-8601. Appointment `appointmentDate`, `startTime`, and `endTime` are clinic-local (`Asia/Ho_Chi_Minh`) and must not be interpreted as UTC. Include the clinic time zone in the consumer's rendering configuration.
- `actorUserId` comes from the authenticated JWT principal, never from the client request. `patientId` is a patient profile ID, including walk-in patients with no linked identity user. No contact details, reason for visit, diagnoses, bearer tokens or medical data are included. Notification service must resolve recipient details via an authorized agreed contract; a walk-in patient may have no electronic notification destination.
- The producer must insert the event into an **appointment-service-owned transactional outbox in the same DB transaction as the appointment update**, commit, and only then asynchronously publish through a relay. No direct RabbitMQ call during the transaction. Failed transactions must not leave committed events. A relay marks delivery/retries independently; the consumer must still deduplicate.
- Successful reschedules must not emit a separate `created` event. Repeated rejected/unchanged transitions and repeated check-in must not emit appointment lifecycle events. A cancellation after check-in is forbidden.
- `ReceptionVisit.COMPLETED` and `Appointment.COMPLETED` are synchronized in the same appointment-service transaction. Completion notification is **outside this four-event contract** until Medical, Billing and Notification agree on the lifecycle and publication owner.

**Integration blockers:** no outbox schema/producer, no aggregate version storage, no consumer acknowledgement, and no tested event delivery. This document alone does not enable notifications.