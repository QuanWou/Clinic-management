# S0-05 Synthetic A/B environment

This directory implements the Phase 05 synthetic fixture baseline from `06_Synthetic_Test_Data_and_Environments.md`.

## Rules

- Every fixture is synthetic. Do not insert copied production patient/staff/license/payment/medical data.
- Clinic A has A-B1/A-B2; Clinic B has B-B1; draft and suspended clinics are represented separately.
- Cross-clinic staff, revoked staff, doctors and branch-specific price versions are explicit fixtures.
- Future Patient/Encounter/Billing/Notification fixtures are named now for traceability but are not claimed implemented before those slices exist.
- Sandbox secrets stay outside the registry/source. Use environment variables or local secret storage.
- Test evidence should record build id, fixture key, actor, clinic/branch, correlation id, expected/actual and outcome.
- Cleanup may remove only disposable sandbox databases/containers. Audit evidence is retained according to the test run policy.

## Validate

```powershell
pwsh -File v2/infra/synthetic/Validate-SyntheticFixtures.ps1
```

The validator rejects real-data-shaped fields such as email/phone/address/license/diagnosis in the registry and requires every display name to start with `SYNTHETIC`.

The registry is a deterministic test contract, not a production seed and not a substitute for domain-service APIs.
