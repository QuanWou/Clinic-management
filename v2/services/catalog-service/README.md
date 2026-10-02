# Clinic Management V2 — Catalog Service (S0-04)

Owns clinic offerings, branch assignments and effective price versions. Supplies a price snapshot contract to future Appointment/Billing consumers.

## Authorization and price rules

- Resolve the caller through V2 IAM, authorize capability and exact clinic/branch, then set transaction-local DB clinic scope.
- Clinic-wide offering mutations require clinic-wide `CATALOG_MANAGE`. Branch assignments and prices require that capability for the exact branch, followed by source-of-truth Clinic scope verification.
- Reads require `CATALOG_READ`; object queries include clinic/branch. Guessed UUIDs and inactive offerings cannot produce valid snapshots.
- Offering and branch-assignment updates require the expected row version.
- Prices are append-only for runtime: SELECT/INSERT, without UPDATE/DELETE/TRUNCATE. Duplicate effective timestamps for the same clinic/branch/offering are rejected by PostgreSQL.
- Resolve the newest version with `effective_from <= requested time`; before the first price, return an invalid-state error. Amounts are non-negative integer VND values.
- FORCE RLS covers all three tenant tables. Missing tenant context exposes no rows; transaction-local context is cleared at transaction completion.

## API

All routes are authenticated and start with `/api/v2/clinics/{clinicId}`.

| Method | Suffix | Capability |
|---|---|---|
| POST | /offerings | CATALOG_MANAGE, clinic-wide |
| PUT | /offerings/{offeringId} | CATALOG_MANAGE, clinic-wide |
| GET | /offerings | CATALOG_READ, clinic-wide |
| POST | /branches/{branchId}/offerings | CATALOG_MANAGE |
| PUT | /branches/{branchId}/offerings/{branchOfferingId} | CATALOG_MANAGE |
| GET | /branches/{branchId}/offerings | CATALOG_READ |
| POST | /branches/{branchId}/price-versions | CATALOG_MANAGE |
| GET | /branches/{branchId}/offerings/{offeringId}/price-versions | CATALOG_READ |
| GET | /branches/{branchId}/offerings/{offeringId}/price-snapshot?at={instant} | CATALOG_READ |

Snapshot fields: priceVersionId, clinicId, branchId, offeringId, amountVnd, currency, taxPolicyCode, discountPolicyCode, effectiveFrom, resolvedAt.

Appointment/Billing must persist the returned snapshot at their approved lock point. They must not recalculate historical bill/booking amounts by resolving the current catalog. This slice returns the contract and protects existing price rows; storage of booking/bill snapshots and approved pricing/adjustment rules belong to S1/S4. Backdated inserts are currently possible for an authorized manager, so recalculating an old timestamp is not a substitute for storing its original snapshot.

## Runtime configuration

```text
CATALOG_V2_PORT=8095
CATALOG_V2_DB_URL=jdbc:postgresql://127.0.0.1:<port>/<isolated-v2-db>
CATALOG_V2_DB_USER=<runtime login inheriting clinic_v2_catalog_runtime>
CATALOG_V2_DB_PASSWORD=<runtime secret>
CATALOG_V2_MIGRATION_DB_USER=<migrator>
CATALOG_V2_MIGRATION_DB_PASSWORD=<migration secret>
CATALOG_V2_IAM_URL=http://127.0.0.1:8093
CATALOG_V2_IAM_SERVICE_SECRET=<matches IAM configured inbound secret; at least 32 bytes>
CATALOG_V2_CLINIC_URL=http://127.0.0.1:8092
CATALOG_V2_CLINIC_SERVICE_SECRET=<matches CLINIC_V2_CATALOG_SERVICE_SECRET; at least 32 bytes>
```

IAM's allowed workload issuers must include `catalog-v2-service`. Workload tokens use issuer/subject `catalog-v2-service`, audience `identity-v2-service` and scope `iam.authorize`, or audience `clinic-v2-service` and scope `clinic.scope.read`.

Flyway V1 creates offerings, branch offerings and prices with scope-bound foreign keys; V2 enables FORCE RLS; V3 grants the NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT group role. Provision a separate non-owner, non-superuser NOBYPASSRLS runtime login inheriting that role. Use isolated V2 DB resources and separate migration credentials.

## Verification

From the repository root:

```powershell
mvn.cmd -f v2/services/catalog-service/pom.xml test
mvn.cmd -f v2/services/catalog-service/pom.xml -DskipTests package
.\v2\scripts\verify-s0-04.ps1
```

Normal runs skip external PostgreSQL tests. The S0-04 script runs fresh Flyway V1–V3, all unit/external tests and packaging for Doctor/Catalog, then removes its labeled disposable PostgreSQL container. Runtime and migration credentials are generated in memory and passed through environment variables.

The opt-in Catalog test accepts only `jdbc:postgresql://127.0.0.1:<port>/clinic_v2_s004_catalog_sandbox`. Set `catalog.it.enabled=true`, `catalog.it.jdbc-url`, and `CATALOG_IT_RUNTIME_USER/PASSWORD`; `catalog.it.migrate=true` additionally requires `CATALOG_IT_MIGRATION_USER/PASSWORD`.

Evidence: [S0-04 implementation record](../../../docs/audits/clinic-v2/P05-S0-04/S0-04_Implementation_Evidence.md).
