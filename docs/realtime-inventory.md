# Realtime synchronization inventory (before implementation)

Audit date: 2026-10-07. This inventory was written before synchronization code changes. The checkout already contains Reception SSE and unrelated in-progress changes; those are preserved.

## Architecture discovered

One React/Vite application provides PublicShell (public site, booking, patient portal), WorkspaceShell (doctor, lab, reception, cashier, admin, configuration, platform review), and CustomerPaymentDisplay. Data is held in component state; there is no TanStack Query/SWR/RTK Query cache. Five Java core services host domain modules behind a streaming HTTP gateway. Reception streams use authenticated streaming fetch, Spring SSE, and PostgreSQL LISTEN/NOTIFY. Transactional outbox inserts trigger notifications delivered by PostgreSQL only after commit. Existing stream hints contain `refetch`, not medical/payment records. Branch streams currently authorize Reception, excluding doctor and patient consumers. Existing projection outboxes handle clinic/doctor/catalog publication separately.

## Screen map

Latency targets below are engineering targets, not measurements. A = immediate operational push; B = event invalidation/fast authoritative refresh; C = focus/navigation revalidation; D = preserve until explicit user action. All writes still require backend validation.

| Screen / data | Authoritative source | Current update method | Stale risk | Target latency | Recommended strategy |
|---|---|---|---|---|---|
| Public homepage, introduction, contact, biographies | Clinic / Doctor public projections | Mount fetch; retained across navigation | Low | Focus/navigation | C: refetch public sources without resetting booking inputs |
| Public doctor visibility, booking eligibility, services/prices | Doctor / Catalog -> Appointment projection | Initial booking options fetch | High while booking | <=30s + confirmation validation | B/C: active booking options revalidation; authoritative holds/confirmation |
| Booking slots | Appointment capacity / scheduling projection | Selection-triggered evaluate | High, concurrent reservations | <=15s while choosing | B: scoped visible-page refresh, preserve valid selection; hold/confirm rejects obsolete capacity |
| Patient upcoming appointments/status | Appointment patient-authorized API | Login/mutation/manual fetch | High | Push / recovery <=30s | A: patient stream invalidates own appointment list |
| Patient history, released notes, lab results, prescriptions | Medical patient record API + Encounter release gate | Initial/manual fetch | Medium/high release visibility | Push + focus | B: patient-authorized invalidation; refetch release-filtered REST |
| Patient follow-up suggestions | Encounter patient API | Explicit load only | Medium | Focus / <=30s while open | B/C: background refetch selected clinic/branch |
| Patient bills, payments, receipts | Billing patient API | Initial/manual fetch; intent polls 5s for 60 tries | High | Push + bounded fallback | A: own Billing invalidation; preserve payment input and intent state |
| Patient notification badge/list | Notification inbox | Explicit inbox fetch | High | Push + focus | A: user-scoped notification stream; replace authoritative list/count |
| Doctor worklist, call state, completion, resumed queue | Encounter doctor worklist | 30s polling/focus; stops during medical edit | High | Push | A: doctor-authorized operational invalidation; preserve selected encounter/drafts |
| Doctor `Có kết quả mới` summary | Medical worklist summaries | Fetched with worklist | High | Push | A: Medical result invalidation -> authorized summary REST |
| Active clinical note / lab orders | Medical draft/orders | Mount/mutation/manual fetch | High | Push for server-owned fields | A/D: refresh orders; compare newer note versions without overwriting draft |
| Lab pending orders/results | Medical lab API | Branch/mutation/manual fetch | High | Push | A: Medical invalidation; defer edited result reconciliation |
| Reception check-in, queue, waiting/doctor/payment state | Appointment + Encounter + Billing | Existing three SSE streams + focus | High | Push | A: retain scoped SSE; add reliable retry after refetch failure |
| Reception exception center, walk-in routing, arrival/overnight recovery | Encounter / Appointment | Parent or explicit reload; child lists can remain stale | High | Push | A/B: invalidate relevant child source, preserve requests/reason inputs |
| Cashier payable bills/receipts/shift totals | Billing + Encounter | Existing SSE and selected receipts refetch | High | Push | A/B: retain authoritative invalidation; do not remount edited payment form |
| Cashier online intents | Billing | 15s polling | High | Push | A: Billing events + reconnect/focus; scoped fallback |
| Cashier notification delivery / charge reconciliation | Notification / Billing / Medical / Encounter | Manual inspection; mutation reload | Medium/high | Push or <=30s | B: narrow revalidation; retry/reconcile buttons remain explicit commands |
| Customer payment display | Billing capability-scoped display API | 2.5s perpetual polling; error retry uses location.reload | High | Push + fallback | A: capability-authorized Billing stream; stop terminal fallback, request-only retry |
| Admin operational KPIs, trends, monitoring | Encounter / Billing / Appointment + config APIs | Mount/date/manual reload | High | Push for current counters | B: operational stream invalidation; avoid refetching historical trend for every event |
| Admin finance, shifts, reconciliation | Billing summaries / shifts | Mount/date/manual reload | High | Push | A/B: authorized per-branch Billing invalidation; defer approval form refresh |
| Admin exception center | Encounter + Appointment | Mount/manual reload | High | Push | A: scoped events; retain resolution reason |
| Admin staff/session permissions | Identity canonical contexts / Auth | Table mount/manual; session verifies 45s + focus | Medium/high | <=45s / focus | C: retain canonical session check; refresh table on focus, preserve edit |
| Admin clinic, doctor status/publication/schedule, catalog/service/prices | Clinic / Doctor / Catalog | Mutation revision + manual source reload | Medium | Focus; booking <=30s | C/D: focus revalidate sources when no dirty form; projection-backed booking rechecks |
| Admin audit history / archived data | Audit API | Mount/manual explicit pagination | Low | User action | D: no continuous stream for historical logs |
| Platform clinic review | Clinic review owner | Mount/manual/mutation reload | Medium | Focus | C/D: revalidate clean worklist, preserve decision reason |
| Account settings/security | Auth / Identity | Session recovery + explicit permission reload | Medium | Focus / existing 45s | C/D: canonical auth checks; security commands remain explicit |

## Existing refresh and polling audit

- Existing operational SSE: `api/realtime.ts`, `useReceptionRealtime.tsx`, ReceptionPanel and CashierPanel; three domain controllers and transactional migration triggers.
- Manual source refresh/inspection occurs in PublicShell, DoctorPanel, MedicalPanel, LabPanel, PatientHistoryPanel, PatientFeesPanel, PatientFollowUpPanel, OperationsPanel, AdminFinancePanel, AdminExceptionPanel, AdminSystemPanel, configuration sources, platform review, arrival/overnight tools, charge sync and CashierNotificationPanel. Retry/uncertain-operation resolution, pagination, explicit provider reconciliation and discarding unsaved drafts are valid user actions and must remain.
- Network polling: Doctor 30s; customer display 2.5s; selected cashier intent 15s; patient pending intent 5s capped at 5 minutes; canonical session permissions 45s. Reception 30s and patient intent 1s timers only update clocks, not network data.
- Full reload: CustomerPaymentDisplay error retry calls `location.reload()`. No normal `window.location.reload()`, `history.go(0)` or route reload found. App keys isolate session/user state; they must not become the synchronization mechanism.

## Implementation boundary

Reuse SSE/fetch and PostgreSQL notifications. Events are hints, never authoritative entities. Scope hints by authenticated branch/user/capability on the server; use REST authorization and patient publication gates for refetch. Add lifecycle recovery, coalescing, serialized refetch, dirty-form deferral and stale-request generation guards. Use scoped visible-page polling only where push has no safe owner channel (booking/projections), and focus recovery for static configuration. Record actual test outcomes separately in the final report; do not label unexecuted E2E scenarios PASS.
