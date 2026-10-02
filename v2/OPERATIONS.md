# Local operational baseline

The Product Owner authorized no-deposit booking, unsigned internal care, onsite collection and own patient history. Signing, clinical release and online collection are unavailable. This repository is not a production release approval.

## Reproduce verification

Use PowerShell 7, Java 21, Maven, Node and PostgreSQL 17 client/server binaries. From the V2 worktree run:

```powershell
& ./v2/scripts/verify-authenticated-local.ps1
```

The script creates a fresh loopback-only PostgreSQL cluster below ignored `v2/.sandbox`, separate databases and bounded runtime logins, then runs real PostgreSQL tests and packages. It starts unchanged legacy Identity plus twelve V2 applications, registers synthetic accounts, drives real Public browser registration/booking and the operational API journey, tests failure/replay paths, and restores into new synthetic database names. It also drives five actual operational browser read views and restarts five applications against the restored clone with migrations/relays disabled, preserving revoked access. Its own application and database children stop afterward. Sandboxes are retained. It refuses arbitrary production integration-test database names. Never point these fixtures at existing databases or use deletion to work around a blocked cleanup action.

Frontend verification from `v2/apps/web-shell`:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:browser
```

The default browser suite uses declared synthetic HTTP responses. The authenticated harness uses a separate real-browser configuration and dynamic loopback proxies. Passwords/tokens exist only in memory and an owned ignored sandbox configuration, not evidence files or browser persistent storage. Do not copy that configuration into reports.

`-VerifiedPackageSummary` is a harness-only retry option: it requires matching package hashes, source timestamps and a prior zero-failure/error/skip test result for each module. It does not rerun tests. A source or package change requires fresh verification.

## Access and configuration

Migrations use a dedicated privileged migrator; applications use their service runtime login with neither superuser nor RLS bypass. Runtime groups and inheritance must match the SQL migrations. Never run business APIs with the migration account. Canonical V2 IAM decisions and active Identity sessions determine clinic/branch authority; a legacy role alone grants no tenant access. Workload credentials are separate by peer, audience and scope.

Owner Workspace manages one clinic. Branch remains the operational scope for reception, queues, care and billing. Publication requires independent platform review and its disabled-by-default publication capability; synthetic licenses and evidence references in tests are not professional approval. Clinical templates remain a proposed draft baseline.

## Recover uncertain outcomes

| Situation | Operational action | Invariant |
|---|---|---|
| Hold/confirmation response lost | Inspect own pending holds/appointments; replay the original key/body | One reservation/booking; frozen price |
| Arrival response lost | Reload the actor's server receipt and resume its existing visit | One claim/check-in/ticket; never create another walk-in to replace it |
| Employee left with pending arrival | Manager loads branch-scoped pending arrivals and recovers the original visit with reason/version/key | Original staff receipt, one check-in and one ticket remain |
| Prior-day waiting ticket | Confirm patient return; roll the old WAITING/CALLED/SKIPPED ticket into today on the same visit | One check-in; old ticket TRANSFERRED, new ticket linked; no silent completion |
| Doctor absent | Report source interval, inspect affected bookings and contact patient; amend by cancelling old source and appending a replacement | No silent deletion, new price or automatic refund |
| Exception open | Resolve the source or let the patient cancel/reschedule; manager closes only after source checks | Acknowledgement cannot bypass an active absence |
| Source charge delivery fails | Inspect Medical, Encounter and Billing statuses independently; manager retries DLQ with reason and original key | Same source event, unique frozen charge, no auto-issued bill |
| Onsite payment response lost | Keep exact original request; reconcile bill/payment receipt before another collection | No overpayment or duplicate external reference |
| Financial notification fails | Manager retries the delivery, independently from payment/audit ACK | Safe preview and verified Patient-owned recipient |
| Clinic unpublished | Read historical own bookings/visits/receipts; deny new public holds | Publication is separate from private historical ownership |
| Membership revoked | Reauthenticate/reload authority; investigate with authorized manager | The existing token cannot bypass the next-request decision |

For unresolved source mismatch, keep the item pending and investigate identifiers privately. Do not modify source snapshots, mark payment successful without its receipt, or close medical work to balance money.

## Backup and rollback

The authenticated restore drill dumps only its owned synthetic databases and restores into new names in the same isolated cluster. It compares table counts/content fingerprints and RLS, checks bounded runtime privilege and balanced journals, then starts restored applications to verify actual login, data reads and preserved revocation. Clinical/financial reads use the clone; authentication login may update clone authentication state. It keeps hashes/paths in evidence. Never use this as an automatic live restore command.

Before a production cutover, obtain the approved source inventory, mapping and exception decisions; rehearse migration on an authorized isolated copy and reconcile identifiers, statuses, amounts, document versions and orphan/collision cases. Freeze writes when an integrity/access incident occurs. Choose application traffic rollback versus data forward repair with the accountable owners. Restoring an older live database after new writes can discard legitimate clinical or monetary records and requires reconciliation and approval.

## Monitor and escalate

Laptop Workspace supports 1280×800, 1366×768 and 1440×900. Doctor uses a scrollable assigned worklist alongside the note; `Tải thêm lượt khám` continues beyond 200 loaded rows. The loaded count is not the total. See [paging contract](contracts/doctor-worklist-paging.md). Reload after authoritative scope/cursor rejection; a transient read can retry the same cursor.

Reception quick links move focus between verification, arrival, queue and prior receipts without unmounting forms or changing scope. A closed visit without a live ticket is labeled closed, not pending check-in. Draft Medical/LAB edits and unknown clinical/money/reception outcomes lock scope-changing navigation. Save/review/retry the existing request before leaving; beforeunload warns for these active locks. This does not persist clinical contents or credentials in browser storage. Browser/OS termination cannot guarantee recovery of an unsaved in-memory draft.

Monitor database/app health, outbox lag, expired worker leases, DLQ count, pending arrivals, open absence exceptions, stale source projections, appointment contention, unreviewed results, outstanding bill balances and shift variance. Counters from a failed source must remain unavailable in the UI. Alert thresholds and on-call contacts require environment-specific approval; tests do not invent them.

An unauthorized scope read, wrong patient link, duplicate monetary effect, unbalanced ledger or premature clinical release blocks rollout. Preserve event/command IDs and scoped diagnostics without patient names, clinical content, tokens, passwords or bank references in general logs. Clinical, financial, privacy/security and PO release sign-offs remain separate from implementation PASS.

