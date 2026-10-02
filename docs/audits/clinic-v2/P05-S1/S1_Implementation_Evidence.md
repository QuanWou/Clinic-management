# S1 implementation and verification — 2026-10-01

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`; branch `local-coder/clinic-management-v2-6820c6b7`. A0 authorizes implementation; A1 is not marked accepted.

The no-deposit slice includes public discovery from transactional producer outboxes, owned Patient profile, capacity/hold/confirm/cancel/reschedule, in-app notification and consented reminders, and Appointment delivery into Audit. See [gap review](S1_Gap_Review.md) and [delivery contract](../../../../v2/contracts/s1-delivery.md).

## Verified source and packages

Fresh isolated PostgreSQL 17.6, separate migrator and runtime logins, Flyway history and `rolsuper=false/rolbypassrls=false` recorded for eight databases. Every selected test ran; zero skips, failures or errors. [Summary and package SHA-256](verification/summary.json) records the run ending **2026-10-01 07:01:49 Asia/Bangkok**. [Source manifest](verification/source-manifest.json) identifies source at this S1 checkpoint.

| Service | Passing tests | Evidence |
|---|---:|---|
| Search | 5 | version/concurrency, scope, suspend/revive, snapshot inbox/removal/rollback |
| Patient | 3 | own profile, no contact merge, concurrent clinic link, RLS, workload JWT |
| Appointment | 15 | unit + PG capacity 2/50 contenders, same-key replay, held price, overlap, TTL, midnight, suspend/stale sources, cancel/reschedule, recovery ownership, independent consumer ACK/retry |
| Clinic | 25 | existing onboarding/auth units + transactional projection/retry |
| Doctor | 10 | domain units + transactional projection/retry |
| Catalog | 8 | domain units + transactional projection/retry |
| Notification | 4 | consent, monotonic inbox, cancellation, PHI rejection, JWT |
| Audit | 8 | envelope/workload units + Appointment inbox/hash-chain and rejection |
| **Total** | **78** | all eight packages PASS |

[HTTP projection flow](verification/projection-flow-summary.json) starts eight packaged services against fresh runtime databases: publication, effective price refresh, suspension in Search and direct public APIs. [Booking flow](verification/booking-flow-summary.json) creates an owned profile, holds/confirms/replays/cancels a real Appointment and verifies real HTTP Notification/Audit delivery. [Transport state](verification/booking-transport-state.txt) records both targets acknowledged. Identity current-user resolution uses the explicit synthetic Java fixture; this is not real signup/login E2E evidence.

UI [13 tests](verification/ui-tests.txt), [TypeScript/Vite build](verification/ui-build.txt) and [one Edge workflow](verification/browser-tests.txt) PASS. Browser workflow includes uncertain confirmation, reload, sign-in, active server hold recovery and retry with the same key. Desktop 1440px and mobile 375px screenshots are recorded; mobile has no horizontal overflow. Authentication stays in memory; sessionStorage contains only opaque retry keys/timestamps indexed by operation/payload digest, never profile fields or tokens.

## Acceptance limits and cleanup

- Deposit remains conditional/BLOCKED by OPEN OD-01/02/03. No payment outcome is fabricated.
- Real Identity signup/login/revoke E2E, manual keyboard/screen-reader/zoom review, production routing/secrets/observability, provider channels and whole-platform producer coverage remain downstream requirements. Notification delivers in-app only.
- Doctor overlap is enforced across offerings within one clinic. Cross-clinic doctor policy remains OD-04.
- Snapshot bounds each clinic to 2,000 child items; larger populations require paging before rollout.
- This is source/package/synthetic verification, not A1 acceptance or production certification.

The final run stopped and removed its own fresh sandbox successfully. **Overall residual cleanup remains BLOCKED:** automatic approval review rejected cleanup of prior failed-start directories `v2/.sandbox/b93e8241547d4acdbc061789cd36e005` and `v2/.sandbox/baecb0f0e1ba4bc29bbb0efe457b4447`, together with two temporary stop log files. Response was only `blocked by policy`; no specific reason was supplied. That action was not retried using another command/tool. Old targets are retained and are not represented by the final run's `cleanup=PASS`.

No V1 source changes, database reset, commit, merge or push were performed.
