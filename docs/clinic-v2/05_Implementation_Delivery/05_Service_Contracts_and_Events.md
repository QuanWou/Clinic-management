# 05 — Integration handoff: UI ↔ APIs ↔ events ↔ data

**Đây là bản giao việc hợp đồng.** Phase 03 `contracts/openapi.yaml` là baseline đại diện cho **28 operations**, không được hiểu là toàn bộ endpoints P0 đã định nghĩa đủ. Mỗi owner phải xuất bản full contract và test compatibility trước implementation.

## 1. Service boundary / owner
| Domain | Command source | UI/consumer | Guard cần có |
|---|---|---|---|
| Identity | User/session/membership | both websites | session live, tenant/branch membership, revoke |
| Clinic | Clinic, branch, onboarding, publication | public/owner/platform | only approved/public profiles indexed |
| Doctor | affiliation, schedule | public/manager/doctor | doctor branch assignment + schedule version |
| Catalog | service, versioned price | public/booking/medical/billing | tenant/branch price snapshot |
| Patient | global identity + clinic patient link | public/reception/portal | no blind merge, guardian verification |
| Appointment | availability, hold, appointment | booking/reception | source-of-truth capacity, TTL, idempotency |
| Encounter | check-in, queue, visit | reception/doctor | walk-in nullable appointment; assignment |
| Medical | note, order/result, prescription, signing, release | doctor/lab/portal | clinical authority, immutable signed version |
| Billing | charges, bill, payment, refund, ledger | cashier/public/portal | beneficiary, verified provider, one effect |
| Search | public projection | public | eventual; action rechecks owner |
| Notification | dispatch status | all | no PHI payload, retry/dedup |
| Audit | immutable records | internal | role/tenant/actor/object/decision |

## 2. API handoff by journey
| Step | Existing Phase 03 representative routes | Must specify fully before building |
|---|---|---|
| Public listing | `GET /public/clinics`, `GET /public/clinics/{clinicId}`, `GET /public/availability` | search filters/cursor, offerings/doctors, publication freshness, availability stale/conflict copy |
| Identity/context | `GET /me/contexts` | register/login/session/revoke, clinic patient link & guardian verification |
| Booking | `POST /appointments/holds`, `POST /appointments`, `GET /appointments/{appointmentId}`, cancel/reschedule actions | hold expiry, deposit policy, confirm idempotency, status polling/history |
| Walk-in | `POST /patients/walk-in`, `POST /visits/walk-in`, `POST /appointments/{appointmentId}/check-in`, `GET /visits/{visitId}` | patient match suggestions review, queue call/skip/transfer, doctor worklist |
| Clinical | `POST /visits/{visitId}/start`, `POST /visits/{visitId}/orders`, `POST /orders/{orderId}/results`, `/reviews`, sign/release actions | clinical note draft, prescription details, addendum, result retrieval, follow-up order, required validations |
| Billing | `GET /bills/{billId}`, `POST /payment-intents`, `POST /payments/onsite`, `POST /refunds`, `POST /webhooks/payments/{provider}` | unique charge ingestion, bill line/version, receipt, merchant-config/settlement, shifts, reconcile, error exceptions |
| Portal | `GET /me/appointments`, `GET /me/records/{visitId}/released-documents` | payment history, secure download, aftercare/follow-up, guardian authorization |

`/api/v2` prefix, UUID IDs, UTC timestamps, request `X-Clinic-Id`/`X-Branch-Id` selected from server verified contexts. Headers are **not** authorization. Patient portal determines resource owner/guardian relationship server-side. `Idempotency-Key` for retriable mutations, version preconditions where relevant. Errors distinguish `401/403/404/409/422/202/503`; UI must show pending, conflict and recovery rather than treating timeouts as success.

## 3. Events consumer map (align Phase 03 event catalog v0.9)
| Producer event | Consumer and effect | Consistency test |
|---|---|---|
| `clinic.clinic.published.v1` | Search index; Appointment allows new booking only after source recheck | delayed/replayed projection |
| `clinic.clinic.suspended.v1` | Search removal; Appointment blocks new reservations; Notification informs affected users according to policy | existing paid appointments never silently deleted |
| `clinic.doctor.schedule_changed.v1` | Appointment recalculates; Search refresh hint | booked reservations not erased |
| `clinic.catalog.price_published.v1` | Search + booking quote refresh | old booking/bill snapshot unchanged |
| `clinic.appointment.confirmed.v1` | Encounter projection, Notification | duplicate event creates no duplicate visit/ticket |
| `clinic.appointment.cancelled.v1` | Billing refund decision, Notification, Search | controlled release/financial reversal |
| `clinic.encounter.checked_in.v1` | Medical worklist, Notification | exactly one check-in effect |
| `clinic.medical.order_placed.v1` | Billing charge with source deduplication | same event 5 times = one charge |
| `clinic.medical.result_released.v1` | Doctor review queue | not clinically completed before review |
| `clinic.medical.document_released.v1` | Portal, Notification | release-only, runtime auth per download |
| `clinic.billing.payment_succeeded.v1` | Appointment/Portal | late deposit goes exception path; ledger one effect |
| `clinic.billing.refund_succeeded.v1` | Appointment/Portal | refunded amount/account reconciled |
| `clinic.identity.membership_revoked.v1` | Auth cache | permissions immediately fail-closed even before event cache catches up |

## 4. Integration invariants
- Local DB transaction records aggregate and outbox; consumer inbox deduplicates `(source,event_id)` and side effects; at-least-once transport does not promise exactly-once delivery.
- Use opaque IDs/correlation in event metadata, **not diagnosis/contact/full clinical text**. Producer identity, schema, tenant and source ownership checked by consumers.
- Public slot cache may be stale; confirmation checks Appointment. Portal projection may lag; secure file access checks Medical + relationship live. Payment browser return only queries verified Billing status.
- Each business action carries trace/correlation IDs; event replay/backfill plan and DLQ ownership described.

## 5. Contract gaps requiring review (not guessed implemented)
`CG-01` patient/guardian matching and link; `CG-02` staff invitations/revoke; `CG-03` public doctors/catalog details; `CG-04` queue management; `CG-05` clinical note drafts/prescription/addendum; `CG-06` bill creation/line detail/payment status; `CG-07` shift close/settlement/reconciliation; `CG-08` secure portal document delivery; `CG-09` follow-up appointment linkage; `CG-10` notification preferences/status; `CG-11` audit export; `CG-12` branch/clinic configuration and search projection freshness. Each gap needs endpoint schema, auth/ownership, state transition, idempotency, error, test IDs, consumer evidence.

## 6. Ambiguous failure cases that need explicit design
- Browser reload after POST confirmation: same idempotency returns same booking, no second hold.
- Broker down after commit: durable outbox, eventual replay; UI `pending sync` not false success.
- Provider callback duplicate/forged/out-of-order: provider signature + merchant/amount/order check; append-only ledger; return URL never marks paid.
- Slot hold expires while money unknown: reconcile, **never steal now-owned slot**; approved refund/manual exception.
- Appointment moved between branches: no copying record to unauthorized tenant; source appointment history and reassignment audit.
- Payment or portal temporarily down: medical workflow retains separate state; ops queue/retry with visibility.
