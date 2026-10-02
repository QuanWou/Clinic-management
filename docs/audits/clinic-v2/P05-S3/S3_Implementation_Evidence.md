# S3-01 continuation evidence — 2026-10-01

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`, branch `local-coder/clinic-management-v2-6820c6b7`. [A0](../A0_Foundation_Gate_Decision.md) authorizes this implementation. [Contract](../../../../v2/contracts/s3-care.md), [gap review](S3_Gap_Review.md). S3/A3 is not accepted by these results.

Added assigned doctor UI, care directory/points, keyed start/await-results/return-queue commands, Encounter V5 care receipts and strict Audit consumers. Waiting results retires the serving ticket atomically while preserving the encounter. Return uses a fresh current-day ticket and reception call before assigned doctor resumes. Overnight care is retained; ticket DONE does not mean clinical completion.

## Backend, migration and HTTP evidence

[Summary](verification/summary.json): isolated PostgreSQL 17.6 run **2026-10-01 13:12:00–13:18:01 Asia/Bangkok**, eight fresh databases, separate NOSUPERUSER/NOBYPASSRLS runtime logins, **109 selected tests**, zero failures/errors/skips and eight Maven packages PASS. Each package SHA-256 is recorded. This is a selected suite, not all tests in every service.

| Module | PASS tests |
|---|---:|
| Patient | 6 |
| Appointment | 21 |
| Clinic | 25 |
| Doctor | 13 |
| Encounter | 13 |
| Identity | 16 |
| Notification | 5 |
| Audit | 10 |
| **Total** | **109** |

[Encounter tests](verification/com.clinic.v2.encounter.EncounterPostgresTest.txt) add four database scenarios: serving ticket retirement permits the next patient, returned encounter waits behind queue order, same visit/check-in preserved; age/date manipulation proves overnight awaiting-results remains assigned and new ticket uses today's date, old CALLED ticket denied; twelve concurrent same-key wait requests have one effect, return replay preserves one ticket and changed payload conflicts; assignment/branch/role/version/revoke denial, invalid-point rollback and append-only receipt permissions. Source mocks in PostgreSQL tests do not prove Medical result correctness.

[Audit tests](verification/com.clinic.v2.audit.AppointmentAuditPostgresTest.txt) add care-event inbox/hash-chain replay and rejection of completion states and private reasons. [Encounter database](verification/encounter-database.txt) records fresh V1–V5 migration success and runtime-role flags.

[Care HTTP flow](verification/care-flow-summary.json) starts eight actual packaged services with real V2 IAM and workload authorization: doctor directory exposes only its granted branch, doctor points/worklist, wait/replay frees point for the other visit, return/replay keeps same encounter with a new ticket, reception call and assigned resume/replay, twelve exact audit effects including the S2 regression flow, next-request doctor membership revoke 403. [Reception regression](verification/reception-flow-summary.json) also covers prior S2 behavior. Its six-event field describes the pre-care checkpoint; the care summary records final twelve-event count.

Limits: legacy current-user/token source is `SyntheticLegacyIdentityFixture.java`; V2 IAM is real. Appointment arrival is a seeded confirmed booking. This is not real signup/login or the full public booking→lab→medical completion journey.

## UI and source evidence

[22 UI tests](verification/ui-tests.txt), [TypeScript/Vite build](verification/ui-build.txt), [three Edge browser workflows](verification/browser-tests.txt) PASS. Doctor tests cover required reason, versioned start/wait/return, no start before reception call, frozen uncertain payload/key even after refresh, authoritative conflict reload, failed branch read hides old visits, and non-doctor login rejection.

Doctor browser workflow reloads/signs in during awaiting-results, recovers the same assigned encounter, returns it to queue and resumes after a fixture reception call. Public booking and Reception regressions also pass. All browser routes are fixtures; the separate HTTP flow above exercises the real packaged services.

[Desktop](verification/doctor-desktop.png) and [mobile](verification/doctor-mobile.png) screenshots visually reviewed: original green/white design, readable controls, no topbar overlap. Browser asserts no document overflow at 320/375/768/1024 pixels; desktop capture is 1440 pixels. This is automated layout evidence, not manual keyboard/screen-reader/zoom sign-off.

[Source manifest](verification/source-manifest.json) captures source/config/test/harness/docs after final UI and documentation edits; backend package hashes identify tested binaries. No backend source changed during the verification run. Browser retry storage contains opaque UUID/time under a digest; tokens/reasons remain in memory.

## Runtime and remaining work

This new PostgreSQL sandbox `v2/.sandbox/33dd0b504e924d4993ff4c0ffb4596b2` was stopped and retained with `KeepSandbox`; cleanup is **RETAINED_BY_CONFIGURATION**, not cleanup PASS. Loopback port 28604 has no listener after verification. This run stops only its own service children. Previously rejected cleanup targets remain untouched; see [S2 limits](../P05-S2/S2_Implementation_Evidence.md).

Run from repository root with PowerShell 7: `pwsh -NoProfile -File v2/scripts/verify-s3-local.ps1`. No existing database reset, V1 edits, commit, merge or push. Medical drafts/orders/results/review/completion/sign/release and production gates remain incomplete.
