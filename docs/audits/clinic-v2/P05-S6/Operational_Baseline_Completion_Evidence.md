# Operational baseline — implementation and verification, 2026-10-02

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`; branch `local-coder/clinic-management-v2-6820c6b7`. Scope follows the [explicit PO instruction](../Delivery_Scope_No_Deposit_Unsigned.md). This is repository implementation evidence, not A1–A6 or production acceptance.

## Delivered scope

No-deposit public registration/profile/discovery/booking/cancel/reschedule; reception provisional/matching review/check-in/walk-in; queue/care; unsigned Medical drafts/internal order/result/review/immutable validation; explicit onsite collection/internal receipts/shift approval; own historical appointments/paid receipts/follow-up; safe in-app notification; Owner configuration/scoped source aggregates.

This continuation adds source-owned absence cancellation/amendment/background propagation/exception resolution; manager handoff of pending arrival; same-visit overnight queue continuation; queue keyset paging; clinical access/denial audit; restored application startup; actual operational browser reads. A stale or revoked clinic explicitly requested by a Workspace URL cannot silently fall back to another permitted clinic.

## Passing evidence

| Verification | Result and provenance |
|---|---|
| Backend packages | [Checkpoint 09](authenticated-checkpoint-09/summary.json): 208 selected tests across 12 exact SHA256-verified packages, zero failure/error/skip in their source runs. This final HTTP run reused packages, not 206 rerun tests. [Package input](worklist-verified-packages.json) names the prior runs; Encounter 28 came from [paging subset](worklist-paging-verification/summary.json), Audit 18 from [44-test subset](clinical-access-verification/summary.json), Medical 10 from [earlier subset](clinical-access-attempt-01/summary.json). Other packages retain prior checkpoint provenance. |
| Frontend | 65 Vitest tests, build PASS, 20 default browser fixtures PASS, recorded in [frontend verification](frontend-verification.json). Browser fixtures test declared HTTP shapes/failures separately from actual servers. |
| Actual Public browser | [Two real tests](authenticated-checkpoint-09/actual-browser-tests.txt): registration/profile with Tab/Enter, real login/Search/source booking, frozen 100,000 VND, no deposit, replay/memory-only credentials and mobile capture. |
| Actual operational browser | [Five real tests](authenticated-checkpoint-09/actual-operational-browser-tests.txt), [summary](authenticated-checkpoint-09/operational-browser-summary.json): Patient history/paid receipts while clinic is unpublished, Cashier existing bill/internal receipt, Reception queue/receipt, assigned Doctor/Medical draft and Owner actual aggregates. No intercepted responses, no new money/clinical mutation in these read tests, no page errors/API denial, mobile overflow checked. |
| Continuous business API | Same real Public booking reaches actual reception/care/LAB/review/unsigned completion/closure/FULFILLED, frozen source charges, explicit partial onsite payment/receipt/approved reduction/separate shift approver, notification, history and distinct 120,000 VND follow-up. Full staff mutation UI has separate fixtures; the five actual staff/Patient browser tests are reads, not a claim of complete browser-driven clinical E2E. |
| Recovery | [Absence](authenticated-checkpoint-09/absence-lifecycle-summary.json), [arrival/overnight/paging](authenticated-checkpoint-09/reception-operations-summary.json), [charge retry](authenticated-checkpoint-09/charge-recovery-summary.json): preserved source/key/body/version, exact effects, wrong-role/revoke/payload rejection, no automatic charge-to-bill conversion or price rewrite. |
| Clinical privacy/audit | [Actual proof](authenticated-checkpoint-09/clinical-access-summary.json): unassigned Doctor in same branch and Reception receive 403; assigned Doctor reads 200; validated record unchanged; identifiers-only independent source outbox/SECURITY chain. PostgreSQL verifies denial audit survives business rollback, no PHI body, bounded RLS runtime, forged producer/PHI/freeform operation rejection and dedup. |
| Data restore | [13 database drill](authenticated-checkpoint-09/restore-drill-summary.json): row counts/content fingerprints and RLS equal before application startup, bounded runtime, zero unscoped bills, balanced ledger. |
| Application recovery | [Five restored applications](authenticated-checkpoint-09/restored-applications-summary.json): schema validate only, migration/relay disabled, actual password login, same Patient, canonical Owner, two paid bills/receipts, staff 403 and revoked Patient link 404 preserved. Login may write authentication state only on the restored synthetic clone. No traffic rollback or production migration. |

Actual mobile captures were visually inspected: [cashier](authenticated-checkpoint-09/actual-cashier-read-mobile.png), [doctor](authenticated-checkpoint-09/actual-doctor-read-mobile.png), [patient history](authenticated-checkpoint-09/actual-patient-history-mobile.png). These contain synthetic data only.

## Limits and remaining release work

Signing, clinical document release, online collection, automatic refunds, tax invoice and guardian access stay disabled. Qualified medical/prescription templates and online merchant/provider/deposit/refund decisions remain OPEN. Proposed Medical draft fields are not professionally approved forms.

A0 remains PO ACCEPTED; A1–A6 and medical/finance/privacy/security/QA release sign-offs are not accepted by these tests. Manual screen-reader/zoom assessment, agreed environment performance/load baseline, production gateway/secrets/alerts/retention, authorized V1-copy migration/reconciliation and traffic rollback rehearsal remain release work. Receipt lists (100), LAB lists (100) and other bounded history endpoints need a larger-volume strategy if those limits are exceeded; queue, Doctor worklist and supervisor pending lists now paginate.

Final owned sandbox `6627d7d40eff4875a7df1a47d1c92d64`, PostgreSQL port 16346, is stopped and retained. Earlier failed attempts are retained with their failures. The operational-browser failure was premature cashier revocation in the harness; the corrected ordering still tests final revocation. The fallback clinic UI defect found during that investigation is fixed and covered by a component test. No blocked deletion is retried and cleanup deletion is not PASS.

Source/build/migration/evidence hashes are recorded by [candidate manifest](operational-candidate-manifest.json). Source is uncommitted; no commit/merge/push/deployment or existing production DB reset. See [runbook](../../../../v2/OPERATIONS.md).



## 03:00 audit continuation

[Scheduled functional/laptop audit](Scheduled_0300_Functional_Laptop_Audit.md) ran immediately because the specified time had passed. This adds laptop/keyboard layout, scope/draft/pending navigation protection, responsive failure states, Reception focus shortcuts and correct closed-arrival labels; Doctor keyset continuation/index/audit/permission tests cover more than 200 visits. Five actual operational reads were checked at 1280×800, 1366×768 and 1440×900 as well as 375 px. The audit and implementation do not grant production acceptance.
