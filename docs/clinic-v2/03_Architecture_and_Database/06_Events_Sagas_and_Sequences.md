# 06 — Event contracts, transaction boundaries, Saga, and sequences

## Event envelope
Use CloudEvents-inspired JSON fields `specversion`, `id`, `source`, `type`, `subject`, `time`, `datacontenttype`, `data`, plus project extension fields `clinicid`, `branchid`, `correlationid`, `causationid`, `aggregateversion`. The JSON Schema in `contracts/event-envelope.schema.json` validates the envelope. Events carry **minimum required references and safe business metadata; no diagnosis, patient contact or full clinical text**. Event publisher is authenticated and event origin is authorized.

Example:
```json
{"specversion":"1.0","id":"uuid-event","source":"/services/appointment","type":"clinic.appointment.confirmed.v1","subject":"appointment/uuid","time":"2026-09-29T10:00:00Z","datacontenttype":"application/json","clinicid":"uuid-clinic","branchid":"uuid-branch","correlationid":"uuid-trace","aggregateversion":3,"data":{"appointmentId":"uuid","patientRef":"uuid","slotId":"uuid"}}
```

## Events and consumers
| Owner emits | Consumers | Business effect |
|---|---|---|
| ClinicPublished/ClinicSuspended | Search, Appointment, Notification | update public projection; block new booking if suspended |
| DoctorScheduleChanged | Appointment, Search | invalidate/recalculate slot source and public hints |
| PriceVersionPublished | Appointment, Search | refresh future quote; never overwrite snapshot |
| AppointmentConfirmed/Cancelled | Encounter, Notification, Billing, Search | prepare queue context, message, deposit/refund decision, projection update |
| PatientCheckedIn | Doctor worklist/Notification | visit shows in assigned queue |
| ClinicalOrderPlaced/ResultReleased | Billing, Medical workflow | unique charge if billable, doctor review worklist |
| ClinicalDocumentReleased | Portal, Notification | safe availability notification, not raw document content |
| PaymentSucceeded/RefundSucceeded | Appointment, Portal, Finance projection | settlement/booking progression with explicit guards |
| MembershipRevoked/GuardianRevoked | auth caches/Portal | immediate authorization invalidation, no obsolete grants |

## Transactional outbox/inbox
Inside *each service's local DB transaction*: persist changed aggregate + `outbox_event` with deterministic business id/correlation. Relay publishes; consumer persists `(source,event_id)` in inbox and side effects in the same local transaction. ACK only after commit. Retry with exponential backoff + dead-letter queue; replay idempotently. **At-least-once delivery, exactly-once business effects**, not exactly-once transport.

Consumer guards: reject invalid schema/version, validate trusted producer/clinic, check aggregate version/order where required, query source for ambiguous state, and do not assume broker ordering across aggregates. Track `event_id`, `correlationid`, attempts, last error, projection lag.

## Saga A — booking with deposit (OD-02, OD-01 OPEN)
1. Appointment atomically acquires slot reservation with TTL and returns hold.
2. Request appointment confirmation; create `pending_payment` against reservation if policy requires deposit; publish request or synchronously create Billing intent with durable pending state.
3. Billing validates clinic policy/beneficiary, creates intent, talks to provider. Return page is **not** confirmation.
4. Provider webhook verified in Billing; append payment journal and emit `PaymentSucceeded` exactly once in business terms.
5. Appointment receives outcome; under slot lock verifies reservation still active and current. If valid: consume hold, create confirmed appointment and publish. If expired/cancelled: **do not reacquire old slot**, create refund/credit/manual case according to approved policy (AT-042).
6. Timeout/unknown: persist unknown and reconcile with provider, no silent failure or false success. User sees pending rather than successful booking.
7. Compensation on booking cancel/reschedule: release reservation/slot (if allowed), request refund decision through Billing, notify after durable state change.

## Saga B — walk-in and clinical care
Receptionist resolves clinic-linked patient or records provisional profile → Encounter creates visit with nullable appointment_id, check-in, queue in one local transaction → assigned doctor starts visit → Medical stores note/order/results/review/prescription/versioned signature → Medical emits release → Portal queries owner and authorizes viewer → Billing collects unique charge events asynchronously. If billing is delayed, clinical workflow is not rewritten as completed payment; cashier sees explicit pending charge ingestion.

## Saga C — billing hybrid
Service event -> Billing validates unique `source_type/source_id/source_version` and price snapshot -> creates charge -> bill -> direct onsite or online intent. Direct collection records cashier/shift/method and posts immutable ledger; platform collection uses configured merchant/beneficiary and processor settlement ledger. Refund references original payment, approved amount, and original channel; reversal postings preserve original history. Reconciliation compares provider/bank files with local attempt+ledger and queues exceptions.

## Consistency matrix
| Data | Command-source consistency | Projection consistency |
|---|---|---|
| Slot occupancy | strong, one Appointment DB transaction | public slot hint eventual |
| Check-in/queue | strong within Encounter | doctor read model eventual but refresh on action |
| Signed document version | strong in Medical | portal release eventual; authorize live on download |
| Payment effect/ledger | strong in Billing | appointment/portal status eventual + pending UI |
| Clinic publication | strong Clinic owner | search eventual; booking rechecks source |

## Sequence diagrams
`diagrams/07_booking_sequence.mmd`, `08_walkin_sequence.mmd`, `09_payment_sequence.mmd`, `10_outbox_sequence.mmd` show positive and negative paths, including late payment and retries.
