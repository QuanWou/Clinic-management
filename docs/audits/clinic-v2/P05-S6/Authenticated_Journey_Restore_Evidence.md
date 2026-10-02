# Authenticated operational journey and synthetic restore — 2026-10-02

Scope follows the [Product Owner decision](../Delivery_Scope_No_Deposit_Unsigned.md). Implementation verification does not approve A1–A6 or production release.

The [final HTTP summary](authenticated-checkpoint-01/summary.json) is PASS. Twelve exact SHA256-verified V2 packages reuse the prior [190-test, zero-failure/error/skip run](authenticated-attempt-03/summary.json); those tests were not rerun during the final harness-only correction. Every V2 package migrates a fresh database at actual application startup with separate migration/runtime credentials. Runtime roles preserve their migration-defined inheritance and have no superuser/RLS-bypass privileges.

Legacy Identity source is unchanged. Four synthetic users register and password-login through its actual endpoints. Refresh tokens are rejected as API access tokens. Canonical V2 IAM supplies clinic/branch roles independently of the legacy patient role. Credentials stay in the retained ignored sandbox, outside evidence logs.

The [Public browser test](authenticated-checkpoint-01/actual-browser-tests.txt) uses actual Search, Doctor, Catalog, Patient, Appointment and Identity APIs without intercepted responses. The patient saves their own profile and confirms a no-deposit appointment with a frozen 100,000 VND Catalog version. Exact hold/confirm replay returns the same identifiers. The [mobile capture](authenticated-checkpoint-01/actual-public-booking-mobile.png) was visually inspected; the test also checks horizontal overflow.

The same booking continues through actual API reception, Doctor care, internal orders/result/review, immutable unsigned completion, source charge ingestion, explicit onsite collection, independent financial notification, own operational history and a distinct 120,000 VND follow-up booking. The old booking remains FULFILLED with its original price. Staff screens have separate browser fixtures; this checkpoint does not claim all staff UI steps were driven by the real browser.

The [charge recovery summary](authenticated-checkpoint-01/charge-recovery-summary.json) verifies synthetic lost ACK in the three owned delivery queues. Manager retry preserves original events and frozen charges; wrong-role requests return 403, changed-key payloads return 409, and exactly three recovery receipts/audit effects result. No bill or journal is created by ingestion/retry alone.

The [restore drill](authenticated-checkpoint-01/restore-drill-summary.json) backs up/restores twelve V2 databases plus legacy authentication into fresh isolated database names. Sorted row-content fingerprints/counts and table RLS flags match. Runtime privileges remain bounded, an unscoped runtime reads zero bills, and the restored ledger is balanced. This is synthetic data recovery, not live V1 migration, application rollback or qualified clinical-document import.

Attempts 01–04 and their failures remain recorded. The final owned PostgreSQL/Java children are stopped; sandbox `c71a31e8cb9447e39aa7a5743db4da5e` is retained by configuration. No deletion/cleanup success, commit, merge, push, deployment or production reset is claimed. The source manifest records this checkpoint before later absence-lifecycle edits.

Remaining implementation work includes Doctor absence amendment/cancellation, background propagation and source-validated exception resolution; queue recovery/pagination and the remaining S6 operational release checks. Signing, clinical release and online collection remain disabled by the Product Owner's explicit instruction.


Continuation 2026-10-02: remaining absence lifecycle, supervisor arrival/overnight/paging, clinical read/deny audit and restored application startup have been implemented and verified. See Operational_Baseline_Completion_Evidence.md and authenticated-checkpoint-06/summary.json (206 selected tests/12 exact packages, 2 real Public + 5 real operational-read browser tests). Earlier paragraphs describe checkpoint 01 only; none grants A1–A6 or production acceptance.
