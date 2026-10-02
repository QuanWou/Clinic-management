# CMV2 — Design handoff & implementation backlog

## Before implementation
- PO/clinic lead approves sitemap and wording.
- Receptionist rehearses walk-in and booked check-in on desktop and at 390 px.
- Medical lead signs off required clinical fields, orders/results, prescription, signed-note addendum, release criteria (OD-05).
- Finance/legal decide merchant beneficiary, deposit/cancellation/refund/settlement, receipt vs tax invoice (OD-01/02/03/08).
- Privacy lead approves patient matching/guardian/cross-clinic policy (OD-06/10).
- Accessibility manual audit + keyboard/screen reader + color contrast and zoom, with issues logged.

## Frontend slices / implementation order
| Slice | Screen/component deliverable | API dependencies | Required failure state |
|---|---|---|---|
| UI-00 | Tokens, app shells, shared forms, states, context switcher | Identity, Clinic | Auth expired / branch denied |
| UI-01 | Search + clinic detail + doctor/slots | Search read model, Clinic, Catalog, Doctor, Appointment | Unpublished, stale slot, empty results |
| UI-02 | Booking + confirmation + portal appointments | Appointment, Patient, Identity, Billing if deposit | Conflict, timeout, pending verification |
| UI-03 | Reception + walk-in + queue | Patient, Appointment, Encounter | Duplicate patient suggestion, check-in conflict |
| UI-04 | Doctor + lab workflow + signed record | Encounter, Medical, Catalog | Save draft partial, pending result, invalid sign |
| UI-05 | Charges, partial onsite, online verification, refund | Billing, Catalog | Webhook delayed/replayed, variance, refund pending |
| UI-06 | Portal release, notification, onboarding approval | Medical, Notification, Clinic | Unreleased document, rejected clinic, revoked guardian |

## Component contract annotations
- Every screen displays `[view role, clinic id, branch id]` if staff-facing; server resolves permissions.
- Every mutation declares request idempotency, loading disable, success confirmation, error recovery, and audit reason where needed.
- Show prices as snapshot/current reference with effective date where applicable; do not compute authoritative totals in UI.
- Content must not expose PHI in URL/query/search logs/notification preview.
- Do not use `status='completed'` for appointment, encounter, record, and payment interchangeably.

## Artifact states
`docs/` = product/design specs; `diagrams/` = editable Mermaid; `wireframes.html` = visual low-fi; `design-system.html` = visual component gallery; `prototype/public.html`, `prototype/workspace.html` = high fidelity click-through. Real API mapping and V1 reuse require source audit; there is no claim of implementation complete.
