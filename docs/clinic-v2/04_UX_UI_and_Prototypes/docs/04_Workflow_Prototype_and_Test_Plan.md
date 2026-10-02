# CMV2 — Interactive Prototype & UX Acceptance

## How to run
Open `prototype/public.html` and `prototype/workspace.html` in the same browser. No server/build/API/login required. Synthetic sample records only. Both pages use localStorage key `cmv2-phase04-demo-v1`, so simulated bookings/walk-ins can appear in both. Use *Đặt lại dữ liệu demo* to restore baseline; do not enter real patient data. Offline links use relative paths.

## Click-through scenarios
| ID | Roles | Steps | Visual/behavioral evidence to collect |
|---|---|---|---|
| UX-01 | Guest | Home → Search/filter → Clinic details → Book | Public profile only; labels and visible fees |
| UX-02 | Patient | Select slot → details → review terms → confirm | Stepper, validation, explicit booking code |
| UX-03 | Patient | Portal → appointment → records → payments | Only released synthetic document; distinct statuses |
| UX-04 | Receptionist | Today → find booked appointment → Check-in → Queue | Appt/Patient/Queue identifiers separated |
| UX-05 | Receptionist | Walk-in form → create encounter → Queue | No appointment required; optional contact |
| UX-06 | Doctor | Worklist → encounter → note → add lab order → result → review → prescription → sign | Draft ≠ signed; awaiting result not auto-finish |
| UX-07 | Cashier | Open bill → record partial onsite payment → verify remaining | Deposit, paid, remainder explicit; no fake provider callback |
| UX-08 | Manager | Branch/staff/services/price setup and preview | Active clinic and branch visible; publication as a separate approval |
| UX-09 | Platform Ops | Review submitted clinic with reason | Clinical data not displayed |
| UX-10 | Exception | Trigger simulated slot conflict / API error / unauthorized sample | Actionable explanation, data retained where applicable |

## Review method
Moderated walkthrough with 2 receptionists, 2 doctors, clinic manager/owner, 3–5 patients and privacy/finance reviewers. Observe task completion, recovery after error, time to key task, misunderstandings about identifiers and financial state. Do not claim usability test passed until sessions are conducted.

## Release gates for phase 04
- Sitemap and screen inventory trace to PRD FR; no hidden essential task or duplicate clinic scope.
- Two E2E prototype journeys navigable without backend; tested desktop/mobile keyboard.
- All P0 screens specify empty, loading, error, denied and partial states; staff workflow avoids excessive scroll.
- Sign/clinical edit, payment refund, tenant switch and patient-document release patterns approved by medical, finance and privacy reviewers.
- Legal/finance OPEN decisions remain tagged, rather than encoded as final policy.
- No production copy or PHI appears in demo assets.

## Explicit limits
This clickable prototype does **not** reserve real slots, authorize users, sign EMRs, charge cards, create invoices, or certify WCAG/clinical/legal compliance. In production, all statuses originate from the owner services. UI state and localStorage are for demonstration only.
