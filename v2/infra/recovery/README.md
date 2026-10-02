# S0-05 Backup / recovery checklist

This checklist implements the P05 S0-05 foundation for FR-OPS-05 / AT-038. It is **not** a production RPO/RTO certification.

## Safety boundary

- Use a disposable Clinic V2 synthetic database only.
- Never point the drill at V1, staging copied from production, pilot or production.
- Production data must not be copied to local/dev.
- Migration and runtime credentials remain separate.
- Production backups require encryption at rest, managed secrets and immutable/offsite copies; the local synthetic drill cannot prove those controls.
- RPO <=15 minutes and RTO <=4 hours remain Phase 02 proposals / OD-09 OPEN. Record measured values; do not mark the proposal achieved from a local test.

## Before drill

- [ ] exact task/worktree/build id recorded
- [ ] source DB name matches a disposable `clinic_v2_*_sandbox`
- [ ] target restore DB is new and ends `_restore_sandbox`
- [ ] fixture registry validated as SYNTHETIC
- [ ] source service migrations and runtime-role model documented
- [ ] no real PHI, payment credential or production secret exists in source
- [ ] backup operator and evidence destination identified

## Drill

1. Capture source table list and exact row counts.
2. Create a PostgreSQL custom-format dump.
3. Record SHA-256 of the dump.
4. Restore into a **new** sandbox database; never overwrite the source.
5. Compare table inventory and row counts.
6. Run source-specific integrity checks where applicable (audit chain, signed versions, money totals in later slices).
7. Measure restore elapsed time and total drill elapsed time.
8. Record failures, differences and retry steps.
9. Keep evidence JSON; cleanup only the disposable restore DB/container after review.

## Local synthetic helper

```powershell
pwsh -File v2/infra/recovery/Invoke-SyntheticRestoreDrill.ps1 \
  -Container clinic-v2-<sandbox> \
  -SourceDatabase clinic_v2_<name>_sandbox \
  -TargetDatabase clinic_v2_<name>_restore_sandbox \
  -EvidencePath docs/audits/clinic-v2/P05-S0-05/restore-drill.json
```

The helper refuses non-sandbox DB names and existing target DBs. It records table counts, dump hash and measured restore duration. It does not claim production recovery objectives.

## Production readiness items carried forward

- approved retention and backup schedule
- encrypted backup storage and key ownership
- immutable/offsite copy
- per-service restore order/dependency map
- object-store/document backup and checksum
- broker/search projection rebuild procedures
- incident owner/escalation
- approved RPO/RTO under OD-09
- recurring restore-drill cadence and evidence retention
- migration rollback/cutover runbook
