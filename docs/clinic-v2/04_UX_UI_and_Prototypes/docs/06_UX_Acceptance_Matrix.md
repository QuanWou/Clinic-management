# CMV2 — Phase 04 UX Acceptance Matrix

`[PROTOTYPE]` means manually clickable with synthetic data; `[SPEC]` means behavior specified for production but cannot be proven without backend. Status initially **NOT USER-TESTED**. No usability study or WCAG certification is claimed.

| UX ID | Related FR | Given / When | Expected outcome | Layer |
|---|---|---|---|---|
| UX-A01 | FR-PUB-01/02 | Search public clinic by specialty/name | Approved profiles only; no private clinic in results | Prototype + API SPEC |
| UX-A02 | FR-PUB-02/03 | Open profile | Branch, doctor, hours, indicative price and public status have labels | Prototype |
| UX-A03 | FR-PUB-04/05 | Pick date/doctor/slot | Booking stepper and visible summary; disabled occupied slot | Prototype |
| UX-A04 | FR-SCH-02/04 | Slot no longer available at confirmation | Explain conflict, retain entered details, return to slot selection | SPEC + simulated check |
| UX-A05 | FR-PUB-05 | Booking completed | Distinct appointment code and next step, never imply payment | Prototype |
| UX-A06 | FR-PUB-06 | Patient cancels | Show state; actual refund follows policy, not silent | Prototype + SPEC |
| UX-A07 | FR-PUB-07 | Record draft/not released | Never show it in patient portal | Prototype + API SPEC |
| UX-A08 | FR-IAM-07 | Guardian not verified | No automatic access to dependent record | SPEC |
| UX-A09 | FR-ORG-02/07 | Owner submits clinic | Publication requires platform approval | Prototype + SPEC |
| UX-A10 | FR-IAM-02/03 | Staff changes clinic/branch | Current context is obvious; data must be reauthorized | Prototype labels + API SPEC |
| UX-A11 | FR-SCH-05/07 | Reception check-in booked patient | Create encounter and separate queue ticket; show distinct codes | Prototype |
| UX-A12 | FR-SCH-06 | Reception creates walk-in | Encounter exists with no appointment | Prototype |
| UX-A13 | FR-SCH-08 | Call queue ticket | State changes; original identifiers remain | Prototype |
| UX-A14 | FR-MED-03/09 | Doctor saves note | Shows draft; not signed and not released | Prototype |
| UX-A15 | FR-MED-05/07 | Doctor orders test | Encounter pending results; lab returns then doctor reviews | Prototype |
| UX-A16 | FR-MED-09/10 | Doctor signs | Required draft, diagnosis, prescription/review preconditions; separate release | Prototype baseline, medical criteria SPEC |
| UX-A17 | FR-MED-09 | Try edit signed note | Readonly; new addendum/version required | Prototype + API SPEC |
| UX-A18 | FR-BIL-01/02 | Create charge | Snapshot and link to actual service/order; no fee without order | Prototype |
| UX-A19 | FR-BIL-03/07 | Record partial onsite payment | Paid increments once, remainder decreases; overpay rejected | Prototype |
| UX-A20 | FR-BIL-04/05/11 | Start online payment | Pending not counted as paid; verified demo event required | Prototype state demo + real gateway SPEC |
| UX-A21 | FR-BIL-08/10 | Refund/shift close | Separate approval/audit/reconcile UX described, not fake provider operation | SPEC |
| UX-A22 | FR-OPS-03 | Small viewport | Core flow legible; no necessary action hidden; mobile clinic cards | Static CSS, browser review required |
| UX-A23 | FR-IAM-03 | Cross-tenant request | Backend denies without leaking record | API/Security SPEC, not prototype |
| UX-A24 | FR-OPS-04 | Sensitive action | Production audit actor/object/tenant/time/reason | API/Security SPEC |
| UX-A25 | FR-OPS-03 | Loading/empty/error/denied/partial | Recovery text, proper focus, no raw 403 as sole guidance | Spec and UI gallery |

## Manual UX review scorecard (record observations, do not invent scores)
For each scenario capture participant role, device width, successful completion Y/N, hesitation point, wrong mental model, accessibility issue, time, suggested fix, severity and owner. Distinguish **design validation** from **actual API/security/E2E test**. The prototype's role switch is not security evidence.
