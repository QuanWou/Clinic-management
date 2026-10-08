# Receptionist Workspace V2 — implementation and verification

Verified 6 October 2026 against the current working tree. The reception and cashier changes are implemented and the operational gateway workflow passes. The whole frontend suite is **not green**: 10 existing selector/heading expectations still fail, as detailed below.

## 1. Existing reception architecture discovered

React `ReceptionPanel` and `CashierPanel` run inside `WorkspaceShell`. The canonical STAFF membership combines reception and cashier work. Five Spring Boot cores host independently secured domain modules behind the `/s1/{module}` gateway. Modules retain separate PostgreSQL runtime roles and tenant/branch RLS.

Patient owns identity/clinic links and provisional registration; Appointment owns bookings, capacity, holds and arrival claims; Doctor owns affiliations, schedules and absences; Encounter owns arrivals, visits, check-ins and queue tickets; Medical owns clinical drafts, orders/results and validation; Billing owns bills, collection shifts, payments, receipts and journals. The redesign uses these owners.

## 2. Existing queue lifecycle discovered

Visits use `ARRIVAL_PENDING`, `WAITING`, `IN_PROGRESS`, `AWAITING_RESULTS`, `CLINICALLY_COMPLETED`, `CLOSED`, `CANCELLED`, and `INTERRUPTED`. Tickets separately use `WAITING`, `CALLED`, `SERVING`, `DONE`, `SKIPPED`, `TRANSFERRED`, and `CANCELLED`; this change adds `ABSENT`.

Online arrival reserves one pending encounter, asks Appointment to claim that encounter, and activates one check-in/ticket after the acknowledgement. Doctor care commands control professional states. Returning from results and advancing an overnight ticket preserve the encounter. No clinical priority/triage ordering was introduced.

## 3. Existing billing/payment lifecycle discovered

The approved payment timing was already enforced by the backend. A bill needs a clinically completed/closed encounter and the matching validated Medical version. Prices come from booked snapshots, confirmed performed walk-in consultation, and performed Medical services. Completion creates durable charge delivery work.

Cashier explicitly verifies and issues a bill from these sources, then collects inside their open shift. Bill locking/version checks, payment command receipts, persisted receipts, journal entries and reference uniqueness protect money effects. Professional completion and financial settlement remain separate.

## 4. Existing realtime capability discovered

There was no browser SSE/WebSocket subscription. Reception and cashier used 15-second polling. Durable domain outboxes and PostgreSQL were already present, so the implementation adds small SSE invalidation endpoints backed by commit-time PostgreSQL `LISTEN/NOTIFY`; it adds no broker or parallel business-state store.

## 5. Root UX/workflow problems found

Reception used passive summary cards, an actor-only recovery/history list, manual walk-in doctor selection, a selected-point queue, generic operational forms, and direct staff transfer. Queue rows lacked useful waiting information. Historical states competed with current work. Pre-check-in changes had no staff-authorized capacity workflow. Realtime status described polling. Structural blue and inconsistent surfaces separated the workspace from Public Web.

## 6. Files/services changed

The principal changes are:

| Area | Files |
|---|---|
| Reception UI | `frontend/src/components/ReceptionPanel.tsx`, new `ReceptionAppointmentChange.tsx`, new `ReceptionExceptionCenter.tsx` |
| Cashier/shell | `frontend/src/components/CashierPanel.tsx`, `frontend/src/shells/WorkspaceShell.tsx` |
| Browser realtime | new `frontend/src/api/realtime.ts`, new `frontend/src/components/useReceptionRealtime.tsx`, `frontend/src/api/reception.ts` |
| Styling | new `frontend/src/styles/fresh-tokens.css`, new `reception-workspace.css`, import ordering, extraction of the existing Public token declarations |
| Encounter | controller/DTO/service/source client/patient enrichment; new SSE controller; V13 reception operations and V14 realtime migrations |
| Appointment | staff read/hold/change controller, capability authorization, source exception list, appointment encounter mapping, SSE controller, V13 realtime migration |
| Doctor | authoritative reception-candidate query/controller using affiliation, specialty, schedule, IAM and absence checks |
| Billing/gateway | canonical billing authorization for SSE, SSE controller, V9 realtime migration, gateway stream flushing |
| Runtime/testing | Catalog URL in peer environment; PostgreSQL tests and corrected module migration locations; frontend reception/realtime tests; isolated verification scripts |

The workspace was already dirty and changed concurrently. Doctor/Medical/Patient/Public component edits and canonical-data/image work present in the working tree are not attributed to this task. No unrelated page redesign was performed here.

## 7. Reception UI changes

The sidebar keeps reception, cashier and account settings. Reception prioritizes **Tiếp nhận**, **Hàng đợi**, and **Ngoại lệ**; **Lịch sử** is secondary. Workload counters come from server appointments, tickets and exceptions. One work-date control sits beside connection status.

The queue defaults to all active points, with point/doctor/state/search filters. Rows show patient identity, appointment/walk-in source when verified, actual arrival time, elapsed waiting time, specialty/doctor, ticket/clinical status and permitted actions. Clinical work is also visible in a separate read-only group. Completed/historical tickets are excluded from the actionable queue. Empty, loading, failure, denied and reconnecting states have explicit messages.

## 8. Shared Public/Workspace design tokens reused

The exact approved Public palette is shared: Lime `#b5ee45`, Forest `#102417` through `#2f5c39`, soft surface `#f7faf4`, charcoal `#172019`, and green-neutral borders. Public retains its existing token values and layouts.

Reception/cashier styles are scoped. They use Be Vietnam Pro, compact forms, restrained 8px geometry, soft-lime selected navigation, lime primary actions, forest text, and distinct amber/information/absence states. The desktop header measures 65px including its border; smaller widths stack context controls. Row/background transitions use 180ms and respect reduced motion.

## 9. Online appointment intake behavior

Daily appointments use the existing source list and patient summaries. Reception selects and verifies a real appointment, reads its booked doctor/service/price, and checks in the verified patient. Source status and shared encounter workload prevent a second intake action. Supported lookup remains grounded in existing patient/name/DOB/phone and appointment-list contracts.

The successful Appointment arrival acknowledgement freezes the assignment used for queue activation. A race with an authorized pre-arrival doctor change cannot activate the stale doctor from the earlier reservation snapshot.

## 10. Walk-in auto-routing behavior

The default form selects specialty/service, not a doctor. The backend verifies the active branch offering and price, then obtains eligible doctors from Doctor: active/effective affiliation, matching specialty, current working schedule, canonical DOCTOR permission and no active absence. A branch routing lock selects least current open workload with a stable UUID tie-break. The selected point must be active in the same branch.

The encounter has `appointment_id = null`. Automatic intake locks the patient and rejects another open visit; command replay returns the original visit. No candidate returns structured `NO_ELIGIBLE_DOCTOR` with recovery guidance to choose another valid service or request management help.

## 11. Pre-check-in reassignment behavior

Staff uses dedicated RECEPTION-authorized Appointment endpoints. Replacement choices and capacity come from the existing booking APIs. Holds and final change revalidate affiliation, specialty/service compatibility, schedule, availability, source versions, patient/clinic/branch and the original confirmed appointment. Original capacity is released by the existing reschedule workflow.

Checked-in/source-bound appointments are rejected. Unknown replies retain the original hold, version, reason and request key for retry; the UI explains the uncertainty and locks navigation until resolved.

## 12. Post-check-in Admin restriction

Staff cannot call queue transfer even manually: the backend requires canonical ADMIN scope. The UI explains that the visit has entered the queue and provides a persisted exception request instead of direct doctor/specialty/point controls. Staff also cannot resolve those requests. Reception cannot call doctor-owned clinical commands.

## 13. Queue absence/skip/recall behavior

`recall` records another call for a `CALLED` ticket; `skip` persists `SKIPPED`; `absent` persists `ABSENT`. `requeue` closes the old skipped/absent ticket as `TRANSFERRED` and issues a new `WAITING` number at the same point, preserving the encounter and original check-in.

Each action validates permission, current work date, ticket version and visit state, and records history/outbox events. Command receipts support identical retries. Replays read committed ticket state after the command lock. The database permits independent doctor queues at a shared point while retaining one called/serving ticket per doctor/point/day and one active ticket per visit.

Global display order uses authoritative **ticket issuance time**, then queue number. Arrival time is retained for elapsed waiting; it no longer incorrectly places a requeued patient ahead of later arrivals.

## 14. Exception Center implementation

The center brings together actual appointment exceptions, uncertain arrivals, skipped/absent tickets and persisted reception requests. Request types cover doctor/specialty changes, unavailable doctors, routing/no-candidate failures, wrong service and suspected duplicate intake. Requests carry a reason and optional verified visit/patient linkage, with scoped RLS, retry keys, audit history for linked visits and resolution attribution.

Staff sees the affected case and the next permitted action. Existing management recovery/absence controls appear only for authorized management. Requests do not silently reassign a clinician or mark care completed.

## 15. Realtime implementation and reconnect behavior

Encounter, Appointment and Billing expose authenticated branch-scoped SSE. Bearer tokens stay in headers. Notifications contain only `changed`/`refetch` hints, no patient data. Listen subscriptions are cleaned up; connection/heartbeat authorization rechecks canonical access. Gateway responses flush SSE chunks.

Streaming fetch parses split frames, reconnects with capped backoff, and refetches authoritative state on `ready` and `changed`. The hook coalesces bursts, defers refresh while an operation is unresolved or the page hidden, resumes on visibility/focus, and cancels on scope change. Scope/generation checks prevent stale responses from restoring cleared data. Permission denial clears relevant lists. Cash collection is blocked while balances are stale.

Operational 15-second polling is removed. The local 30-second waiting-duration timer does not fetch. The existing shared session permission refresh is separate from reception data synchronization.

## 16. Professional-completion → billing behavior

The existing completion proof and durable charge workflow are preserved. Cashier receives newly completed unbilled visits in realtime, verifies performed services and issues the authoritative bill. Existing source checks continue to block premature billing. This retains the explicit bill-issuance step rather than inventing an automatic parallel financial flow.

## 17. Cash collection behavior

Cashier summarizes issued outstanding bills, remaining balance and their open shift. It supports actual partial/full payment states, source details, confirmation, immutable retry, persisted receipt lookup/printing and separate shift reconciliation. Successful payment does not mutate clinical completion.

Amounts and payment success come from Billing responses; frontend totals are display summaries, not settlement authority.

## 18. Concurrency protections verified

PostgreSQL and real gateway checks verify two different STAFF collectors check in one appointment into one encounter/ticket; concurrent same-key requeue yields one new ticket and no additional check-in; concurrent collection retries yield one payment receipt and one balance effect. Locks, versions, unique indexes and command receipts remain authoritative.

The added arrival test verifies a changed doctor in the acknowledged source claim overrides the stale pre-change reservation snapshot. Patient/ticket enrichment preserves the acknowledged doctor, arrival time and issuance time.

## 19. Permission tests

Verified canonical STAFF reception/cashier access, denial of staff post-check-in transfer, denial of staff exception resolution, denial of staff clinical mutation, authorized Admin request resolution, patient SSE denial and wrong-branch SSE denial. Backend tests additionally exercise branch/tenant RLS and revoked access. Financial tests retain collector-owned shifts and independent approval rules.

## 20. E2E tests executed — actual results

Tests used a copied current project database, five real cores, the actual gateway and real role logins. Only the copy was mutated. Three copied in-progress visits were interrupted to release QA clinical work; copied doctor accounts received local QA password hashes for login. Production rows/passwords were not changed. The final runtime was built cleanly because incremental repackaging had retained older embedded dependencies.

| Scenario | Actual result |
|---|---|
| A — online arrival | PASS: verified source booking → one check-in/ticket |
| B — pre-check-in change | PASS: valid replacement; replay retains the same appointment/version |
| C/N — post-entry change/Admin action | PASS: staff change/transfer/resolution denied; request persisted; Admin resolution succeeds |
| D — walk-in | PASS: automatic eligible doctor; null appointment; replay unique |
| E — two receptionists | PASS: different STAFF actors receive the same encounter/ticket |
| F — temporary absence/recall | PASS: versioned recall and skip persisted |
| G — absence | PASS: `ABSENT` persisted |
| H — return to tail | PASS: six same-key retries yield one new waiting ticket on the original visit |
| I — doctor calls | PASS: `CALLED` plus gateway SSE invalidation |
| J — examination begins | PASS: `IN_PROGRESS` plus SSE; staff clinical mutation denied |
| K — completion/billing | PASS: validated professional completion and authoritative payable bill plus SSE |
| L — collection | PASS: six payment retries, one persisted receipt, `PAID`, zero remaining balance |
| M — reconnect | PASS: dropped subscription reconnects with `ready`; authoritative visit refetch matches completion |

Validation totals:

- PostgreSQL module suite: **140 passed, zero failures/errors/skips** — Encounter 38, Appointment 40, Doctor 20, Billing 42.
- Focused frontend: **32 passed** — reception 15, cashier 14, streaming/reconnect/denial 3.
- Real gateway workflow: **21 assertions passed**.
- Edge browser against the copy: **PASS** at 1440, 1024, 768, 375 and 320px; no document overflow/page errors; reception and cashier SSE active. Intake, queue, exceptions and cashier captured and visually inspected.
- TypeScript/Vite build and isolated Java clean packaging: **PASS**.
- Full frontend suite: **136 passed, 10 failed, 146 total**. Failures expect removed manual-load helper buttons in absence lifecycle (2), reception operations (2), charge synchronization (2), financial notification (3), and the previous Doctor heading (1). The helper implementations were not edited here; the Doctor workspace is being edited concurrently. These failures remain unresolved and are not claimed as passes.
- Whitespace/diff checks: **PASS**.

Evidence remains under `.runtime/reception-verification/` and `.runtime/reception-e2e/`; sanitized summaries are in `docs/reception-v2-evidence/`. The review copy is running at [Reception sandbox](http://127.0.0.1:4276/workspace?view=reception).

Reproducible commands, from the repository root:

```powershell
pwsh -NoProfile -File scripts/verify-reception-workspace.ps1
pwsh -NoProfile -File scripts/start-reception-sandbox.ps1
node scripts/prepare-reception-sandbox.mjs --sandbox
node scripts/verify-reception-workflow.mjs --sandbox
npm --prefix frontend run build
```

The sandbox launcher refuses replacement of its live recorded processes. Preparing fixtures and the gateway workflow refuse a non-sandbox database name. Logs/configuration/snapshots containing private runtime data stay in the ignored runtime directory.

## 21. Remaining gaps / product decisions

- The 10 full-frontend-suite expectations above require alignment with the current helper and concurrently edited Doctor UI. The focused reception/cashier suite passes.
- Explicit bill verification/issuance is retained. If the product requires automatic bill issuance on completion, that requires a Billing-owned policy decision; this implementation does not invent it.
- Management requests are persisted and auditable. Resolving a request records management acknowledgement; it does not itself implement a new post-check-in doctor reassignment API or redesign the Admin workspace.
- Existing cashier APIs return the latest 100 bills; the UI states this limit. Full financial search/pagination and expanded patient-code/receptionist-name lookup need source-owner contract work.
- Eligibility is checked against authoritative services at request time. A later doctor/schedule change is an operational exception; it is not a distributed reservation of a walk-in doctor's future capacity.
- Each SSE subscription occupies one module database connection. The tested 1–2-receptionist model fits current pools; larger deployment concurrency needs pool/subscription sizing. Streams rotate and refetch; they are not a durable event replay log.
- The existing Billing proof path reports a premature bill attempt as a source-unavailable error in the live gateway test; it safely rejects issuance, but a more specific not-ready error would improve API semantics.
- The main clinic runtime was not restarted or migrated during sandbox testing. After explicit user authorization on 2026-10-06, the current source was built cleanly in isolation, the main database and previous application JARs were backed up, and the main runtime was restarted at [port 4176](http://127.0.0.1:4176/workspace?view=reception). Appointment V13, Encounter V12–V14 and Billing V9 migrated successfully. All 13 module health checks passed; the main browser smoke passed at five viewport widths with reception/cashier realtime and no page errors. Patient, appointment, visit, check-in, ticket, bill and payment record counts were unchanged. No clinical or financial QA mutations were performed against the main database. Deployment evidence is in `docs/reception-v2-evidence/main-deployment.json`; private backups/logs are under `.runtime/main/backups/reception-20261006-174150/`.
