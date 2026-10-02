# 07 — Gates, release readiness, pilot & rollback (kế hoạch)

## 1. Gate theo slice
| Gate | Điều kiện đo bằng evidence | Người duyệt chính |
|---|---|---|
| A0 (S0) | tenant/branch auth, revoke, source ownership, audit; no cross-tenant read/write | Security + Tech + QA |
| A1 (S1) | public only, atomic booking, TTL, correct status and deposit exception if enabled | PO + Reception + QA |
| A2 (S2) | walk-in without appointment, no duplicate check-in/ticket, correct worklist | Reception + Doctor + QA |
| A3 (S3) | prescribed medical forms, order-result-review, sign/version/addendum/release | Medical Lead + Compliance + QA |
| A4 (S4) | unique charge, direct/online verified, beneficiary, partial/refund/settlement and close shift | Finance/Legal + QA |
| A5 (S5) | patient/guardian access, release-only, follow-up linked, safe notify | Medical + Privacy + QA |
| Release | Phase 02 GATE-A–E and Phase 03 ARCH-01–16, both E2Es, migration/restore, performance criteria signed | PO + Tech + QA + Medical + Finance + Privacy/Legal |

## 2. Do not release if any of these holds
- OD-01 merchant/collector/settlement legal owner remains OPEN for deployed online payment path.
- OD-05 signature/forms/record lifecycle not approved for deployed clinical functions; OD-06 sharing or OD-10 guardian identification not approved for deployed access.
- Critical/High unresolved authorization, money, data loss, signed-record integrity issues.
- Unverified payment state treated as paid, stale slot overbook, document draft exposed, clinical record cross-tenant access.
- Lacking backup/restore drill, rollback strategy, migration reconciliation evidence, or verified legal sign-off.

## 3. Evidence pack required
`release_manifest` lists build+service versions; migrations + reversible/forward-fix classification; OpenAPI/event schema versions; environment config without secrets; AT/ARCH/E2E/UX test run IDs; defect log; baseline snapshots/reconciliation; on-call rota; alert/dashboard; change approvals; rollback trigger/owner.

## 4. Staged rollout
1. **Design approved:** FR/UX/API/clinical/finance owners sign document baseline.
2. **Integrated sandbox:** synthetic end-to-end and error handling; no real patients/money.
3. **Staging release candidate:** freeze contract; security/performance/recovery, payment sandbox and E2E gates.
4. **Controlled pilot:** only selected consenting organization(s), approved cutover plan and support; no implied go-live before legal/security approvals.
5. **Broader rollout:** progressive traffic/tenants, monitoring and alert thresholds; stop if invariant violation.

## 5. V1→V2 migration and rollback (plan only)
- Read-only source audit, inventory old identifiers and dependencies; create ID mapping old→new for clinic/branch/patient/doctor/booking/encounter/document/bill; collisions and orphan handling documented.
- Database backup and restore test; dry-run **on isolated authorized copy**, compare counts, status distributions, outstanding balances, signed document versions and totals; exception approval required.
- Establish cutover boundary and dual-write/CDC policy if needed, but no dual-write assumed safe without idempotent reconciliation design.
- Keep V1 read-only reference during controlled migration where legally/operationally acceptable; never delete history to satisfy new schema.
- Rollback triggers: unauthorized exposure, payment ledger mismatch, wrong patient/encounter link, missing signed record, sustained critical failure, failed reconciliation.
- Decide rollback mode before launch: app traffic back, data forward-fix vs restore, read-only freeze, transaction compensation; **DB restore after V2 receives new writes can discard legitimate transactions**, so require accounting/clinical reconciliation and owner approval, not unconditional restore.

## 6. Operational readiness
- Monitoring: request traces, outbox lag/DLQ, queue delay, hold expiry, appointment conflict, payment unknown, reconciliation variance, failed document release, auth denied spikes, unreviewed results.
- Runbooks: provider outage; wrong-tenant access alert; suspicious signed document alteration; doctor absent; lost event; backup restore; late payment; clinic suspension with paid appointments.
- Day-end report reconciles cash/direct transfer/online/platform-held/refunds; pending medical encounters are not silently closed.

## 7. Go / No-Go record
| Date | Build/Env | Slice / E2E scope | Evidence links | Open blockers | Medical | Finance/Legal | Security/Privacy | QA | PO decision |
|---|---|---|---|---|---|---|---|---|---|
| TBD | TBD | Phase 05 planning only | None | OD-01…OD-12 | Pending | Pending | Pending | NOT RUN | NOT READY |
