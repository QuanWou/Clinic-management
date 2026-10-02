# S2 implementation / verification — 2026-10-01

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`; branch `local-coder/clinic-management-v2-6820c6b7`. [Gap review](S2_Gap_Review.md), [contract](../../../../v2/contracts/s2-reception.md), [runbook](../../../../v2/apps/web-shell/S2_RUNBOOK.md). A0 accepted; A1/A2 have not been accepted by this verification.

## Backend and package evidence

[Summary](verification/summary.json) records an isolated PostgreSQL 17.6 run ending **2026-10-01 12:14:32 Asia/Bangkok**: eight fresh databases/migrations, separate runtime logins with no superuser/BYPASSRLS, 104 selected tests, zero failures/errors/skips, all eight Maven packages PASS with SHA-256. Database logs record Flyway history and role flags. These are selected relevant suites, not every test of every V2 service.

| Module | PASS tests | Main evidence |
|---|---:|---|
| Patient | 6 | S1 profile/link regressions; scoped matching/provisional/review, peer JWT |
| Appointment | 21 | S1 capacity/hold/snapshot/retry regressions; source arrival claim, absence/no-show history/price preservation, source windows block stale hold/confirm, locked stale-impact rejection and cross-manager dedup, peer JWT |
| Clinic | 25 | Onboarding/auth/projection regressions; used as real reception directory/source in HTTP flow |
| Doctor | 13 | Affiliation/schedule/projection regressions, Encounter peer JWT; real effective assignment, keyed interval/concurrency/RLS/revoke and non-private window in HTTP/PG flows |
| Encounter | 9 | 20 concurrent same-key walk-ins; different-key booking arrivals converge; lost-claim response recovery; queue order/skip/transfer; assigned start; branch/RLS/revoke; actor-owned server recovery; batch partial-failure reporting; audit relay retry stable ID |
| Identity | 16 | Membership/session/security regressions, workload scope restrictions, PostgreSQL canonical branch grant/revoke |
| Notification | 5 | Dedup/order/consent/reminder regressions; staff exception targets patient account, suppresses reminder, manual-contact ACK |
| Audit | 9 | Envelope/JWT regressions; Appointment/Encounter inbox dedup and hash-chain, PHI rejection |
| **Total** | **104** | All selected tests and packages PASS |

[Reception HTTP flow](verification/reception-flow-summary.json) starts eight actual packaged services (Clinic, Doctor, Patient, Appointment, Encounter, Identity, Notification, Audit) on loopback using runtime logins. It verifies scoped directory, provisional profile replay/suggestions, walk-in with no appointment and one check-in/ticket, call and assigned doctor start, booked arrival replay, a late exception with manual-contact mode, source absence interval/replay, bulk impacted booking exception without removing booking, actor-owned completed outcome recovery and wrong-actor denial, six exact persisted audit events, ungranted branch 403 and immediate canonical membership-revoke 403 using the existing token.

Boundaries: legacy current-user/token issuing uses `SyntheticLegacyIdentityFixture.java`; V2 Identity/IAM is real. The confirmed appointment for arrival is seeded explicitly; this flow does not create it through public booking. The independent S1 checkpoint covers real booking/source/outbox paths. Patient account delivery and doctor-absence/no-show are also PG tests, not claims that every variant ran in this HTTP sequence.

## UI evidence

[18 UI tests](verification/ui-tests.txt), [TypeScript/Vite build](verification/ui-build.txt), and [two Edge browser workflows](verification/browser-tests.txt) PASS. Public S1 regression and Reception explicit matching→walk-in→queue call use browser HTTP fixtures. PostgreSQL and real service HTTP results above are separate evidence.

Reception recovery freezes the original ambiguous walk-in request and retry key; a confirmed visit survives a queue-refresh error. A deliberately new visit needs the explicit new-walk-in action after success. Tokens remain in memory; browser persistence stores UUID/time under a digest, without raw patient/contact fields. Reload recovery uses this actor's server receipts and the original visit. Pending recovery validates and claims the same stored IDs/point; original reason is retained. It is bounded to 100 visits/day and does not implement supervisor handoff. Browser workflow reloads, signs in, reads receipt and recovers the old visit without a second walk-in. Source absence retry freezes interval/reason, and partial affected-booking work stays visible.

[Desktop screenshot](verification/reception-desktop.png) and [mobile screenshot](verification/reception-mobile.png) were visually inspected at 1440px / 375px: controls readable, existing green/white style retained, topbar does not cover mobile fields. [Layout evidence](verification/reception-layout.json) confirms no document horizontal overflow at 375px; the sidebar navigation scrolls within its own container. Manual screen-reader/keyboard/zoom sign-off is still pending.

The browser workflow also reports a Vietnam-time absence window, applies a batch with an explicit failed item, and checks the visible retry count. [Expanded mobile absence controls](verification/reception-absence-mobile.png) record this form at 375px; fixture timestamps verify conversion to UTC. These fixture checks do not prove production manager authorization; the real HTTP owner/IAM flow above covers the peer boundary.

[Source manifest](verification/source-manifest.json) captures current source/config/test/harness/document hashes after this checkpoint, separately from backend run timestamps. Package hashes identify the backend binaries exercised. It is not a retrospective claim that documentation/UI changes existed when the backend run began.

## Limits and cleanup

S2-04 remains PARTIAL: source absence intervals now block overlapping new availability/hold/confirmation, and managers propagate existing-booking exceptions in batches of 10 with per-source dedup and a locked doctor/time recheck. Propagation is explicitly staff-driven; background propagation, interval amendment/cancellation, exception resolution and policy-governed reassignment/rebooking/money remediation are missing. Exceptions remain OPEN. IN_APP is consumer delivery, not proof of patient read. MANUAL_CONTACT_REQUIRED is visible and does not fabricate a notification. No price/payment/refund is silently changed. The first doctor worklist/start commands are present; clinical completion/sign/release and full S3–S6 are not complete. [Gap review](S2_Gap_Review.md) records these boundaries.

The successful run stopped its own Java children and PostgreSQL. Its directory is retained with `cleanup=RETAINED_BY_CONFIGURATION` using `-KeepSandbox`. The earlier successful continuation directory `v2/.sandbox/640e729696e2436c9eda281de9c304ef` is likewise stopped/retained; current retained path is in summary.json. This is not cleanup=PASS.

**Residual cleanup remains BLOCKED:** automatic approval review previously rejected deletion of `v2/.sandbox/b93e8241547d4acdbc061789cd36e005`, `v2/.sandbox/baecb0f0e1ba4bc29bbb0efe457b4447` and two stop logs. It also rejected this turn's cleanup command for failed-start directory `v2/.sandbox/fe8689ddb13046bbb005553ebdf15679`, returning only `blocked by policy`; no specific reason was supplied. Those denied targets were not retried through another tool/command. [Failed-start evidence](verification/failed-start-20261001/summary.json) records a PowerShell 5 null-exit-code failure after pg_ctl startup; the cleanup attempt made partial changes before hitting a file lock. That disposable instance exited; the denied residue remains. Harness now caches the process handle, checks startup PID when stopping, and the successful runs use PowerShell 7 with directory retention.

V1 source untouched; no existing database reset, commit, merge or push. No production or later gate acceptance is asserted.
