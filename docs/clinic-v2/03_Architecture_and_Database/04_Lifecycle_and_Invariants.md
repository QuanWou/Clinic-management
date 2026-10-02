# 04 — Lifecycle and invariants

State labels are `[PROPOSED]` implementation vocabulary mapped to Phase 02 PRD. All transitions are persisted with actor/reason/version and governed by an explicit owner service; state changes from an external event are idempotent.

## Onboarding (Clinic owner)
`draft → submitted → needs_changes → submitted → approved → published`; alternative `rejected`, `unpublished`, `suspended`. Publish requires valid verification and operator action. Suspend blocks new bookings but must not delete existing clinical records, paid appointments or claims.

## Slot / Appointment (Appointment owner)
- `slot_reservation: active → consumed | expired | released` (exclusive terminal outcomes; atomic counters).
- `appointment: pending_payment | pending_confirmation → confirmed → checked_in → fulfilled`; `cancelled`, `no_show`, `rescheduled` transitions with reason/policy. Reschedule uses an **atomic new hold/slot swap** or compensating saga; never drops the old confirmed slot before new one is safely acquired.
- If no deposit is required, confirm directly within reservation transaction. For deposit-required appointments, keep reservation until payment verification or explicit expiry; **late success cannot take a now-reassigned slot** and enters refund/manual exception workflow (AT-042).
- Slot availability is never inferred from Search/Redis alone.

## Check-in / Queue / Encounter (Encounter owner)
- `visit: waiting → in_progress → awaiting_results → in_progress → clinically_completed → closed`; exceptions: cancelled/interrupted/transferred. `appointment_id = null` for walk-in.
- `queue_ticket: waiting → called → serving → done`; skipped/transferred/cancelled require reason.
- `check_in` and active ticket idempotent per visit; clinical completion is independent from payment, document sign and document release.
- Overnight jobs do not auto-close encounters awaiting results.

## Clinical order and record (Medical owner)
- `order: ordered → accepted → processing → resulted → reviewed`; reject/cancel with reason. Result author and doctor review are distinct events.
- `document: draft → validated → signed → released` with versions; signed version is immutable. Corrections use addendum and reference superseded version, not a silent update.
- Prescription is a clinical artifact with doctor approval; payment or pharmacy status does not sign it.
- File release to portal requires approved version + patient/guardian authorization. Access to draft or URL guessing denied.

## Billing (Billing owner)
- `bill: draft → issued → partially_paid → paid`; special conditions disputed/voided via journal/reversal, never destructive update of payment history.
- `payment_intent: initiated → pending → succeeded | failed | cancelled | unknown`; unknown reconciled against provider. Online return URL does not mark success.
- `refund: requested → approved → processing → succeeded | failed`; repeated provider notification does not duplicate refund effect.
- `settlement: open → reconciled → approved → settled`; distinct for clinic direct receipts and platform-held funds where legally authorized.

## Invariants checklist
I-01: Any tenant-owned state-changing operation has verified clinic/branch and object authorization. I-02: At most capacity active holds + confirmed bookings per slot. I-03: At most one current check-in and queue ticket for visit. I-04: Walk-in has encounter without appointment. I-05: A doctor may not sign an unassigned encounter. I-06: An order cannot be reviewed before result is authenticated. I-07: Signed document version is append-only. I-08: Bill derives from unique source charge with frozen price. I-09: Payment allocation cannot exceed verified payment or legally adjusted remaining bill. I-10: Posted ledger is balanced and append-only. I-11: No cross-tenant PHI projection. I-12: External duplicate message effects are deduplicated by inbox/idempotency. I-13: Refund cannot exceed refundable original payment net of previous refunds. I-14: `appointment.fulfilled`, `encounter.clinically_completed`, `document.signed`, `bill.paid` are not the same boolean.

Visual state diagrams: `diagrams/06_lifecycle.mmd`.
