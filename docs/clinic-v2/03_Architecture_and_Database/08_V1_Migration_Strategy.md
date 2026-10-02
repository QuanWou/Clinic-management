# 08 — V1 to V2 migration without data loss

**Status:** No V1 source/schema/runtime audited in this conversation. This is a migration plan, not an assertion about current code or completed changes. No delete/reset/restore/commit.

## Inventory before touching data
Collect service inventory, owner/schema/DB version, migrations, API routes, event consumers, roles/permission checks, appointment and encounter relation, payment tables, medical document shapes, seed/test records, operational backup and deployment topology. Check unknown status and evidence against `Phase02/Decision_Log.md` and all FR IDs.

## Migration mapping artifacts
Create immutable `legacy_id_map` per entity (`source_system`, `legacy_type`, `legacy_id`, `new_uuid`, `clinic_id`, `migration_batch`, `hash`, `status`) with unique source tuple. Never derive globally unique patient identity from a local display code. Establish clinic/branch ownership before carrying a record; ambiguous ownership enters quarantine/review. Preserve original timestamps, author, signed state, corrections, payment processor IDs and source data hash.

## Target order / strategy
1. Restore V1 snapshot into isolated test environment, inventory data quality and permissions.
2. S0 provision Clinic/Identity/Patient links (without automatic blind patient merge).
3. Migrate reference/catalog/doctor structures and effective price history.
4. Migrate appointment/encounter/queue links; walk-ins have null appointment.
5. Migrate medical documents/versions/orders/results/prescriptions with provenance and original status; signed evidence is not fabricated.
6. Migrate charges, bills, payment/refund/settlement with original IDs and reconciliation. Never invent successful payment if source is incomplete.
7. Backfill search public projection from approved source only; run authorization/security QA.
8. Strangler routing: one explicit owner for every write per entity; read shadow/diff, then canary, then switch. No indefinite concurrent dual-write to independent systems.

## Controls
- `migration_batch` idempotent, resumable; retry does not duplicate entities/events/ledger.
- Reconcile total rows by type and clinic, checksums, appointment/encounter links, signed versions, sum of charges/payments/refunds/settlements per clinic and per beneficiary; investigate all exceptions.
- Read-only cutover window and backed-up rollback snapshot; rollback routing/DBs only after evaluating writes created since cutover. A rolled-back legacy system cannot silently discard new V2 clinical/payment events; define forward-reconciliation before go-live.
- Test cross-tenant access after backfill, including records formerly unscoped. Do not grant broad owner access just to make legacy screens work.
- Never delete legacy medical/payment history merely because V2 replaces frontend.

## Go/no-go
Dry-run succeeds with evidence; all discrepancies triaged; synthetic two E2E flows pass; security/finance/clinical legal sign-off; rollback rehearsal; monitored canary; post-cutover reconciliation. If any gate fails, continue V1 and do not migrate live traffic.
