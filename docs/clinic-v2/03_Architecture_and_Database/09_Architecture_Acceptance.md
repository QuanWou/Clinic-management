# 09 — Architecture acceptance and traceability

Technical gates supplement (do not replace) Phase 02 `Acceptance_Test_Matrix.md` with 68 business cases. All below are **planned**, no tests run against Clinic V1/V2.

| Gate | Technical exercise | Phase 02 mapping | Pass evidence |
|---|---|---|---|
| ARCH-01 | Clinic A token guesses clinic B ID, writes and reads | AT-004,026,036,043,047 | 0 unauthorized disclosure/mutation; audit |
| ARCH-02 | Revoked staff/guardian stale token and cached BFF data | AT-025,035,043,049 | immediately denied; old workspace cache cleared |
| ARCH-03 | Pooled DB connection without/mismatched tenant context | AT-026 | fail closed, no cross-tenant rows |
| ARCH-04 | 50 concurrent attempts for capacity 1 + TTL expiry | AT-006,007 | at most one confirmed, no leaked hold count |
| ARCH-05 | Hold expires then successful late payment | AT-042 | no occupied slot theft; refund/exception case |
| ARCH-06 | Walk-in without account or appointment | AT-009,010,E2E-WALKIN | encounter and queue, nullable appointment |
| ARCH-07 | Doctor unauthorized and signed document edit | AT-028,034,041 | denied or addendum with linked version/audit |
| ARCH-08 | Result exists but not reviewed; overnight close | AT-013,023 | encounter awaits review and remains open |
| ARCH-09 | Duplicate source charge/price change | AT-016,017,045 | one charge, immutable snapshot |
| ARCH-10 | Duplicate webhook, wrong signature/merchant/amount | AT-029,030,031 | exactly one ledger effect or rejected event |
| ARCH-11 | Concurrent partial payments and repeated refund | AT-018,032,033 | money reconciles with no silent overpayment |
| ARCH-12 | Broker unavailable right after DB commit | AT-039 | outbox replays, inbox dedupes side effect |
| ARCH-13 | Published document vs draft public exposure | AT-014,022,034,037 | release-only and safe notification |
| ARCH-14 | Platform vs clinic merchant settlement | AT-021,064,065 | distinct collector/beneficiary/currency journal |
| ARCH-15 | Offline restore, migration dry-run reconciliation | AT-038,040,061 | measured restore and migration exception log |
| ARCH-16 | Endpoint schema version + event replay compatibility | FR-OPS-04,NFR-08 | generated schema checks and consumer contract tests |

## Model-level checks
- Parse all contract YAML/JSON; validate example requests against schemas.
- Static scan OpenAPI for `security` on sensitive routes, tenant/branch requirements, idempotency headers.
- Validate local FK/unique/index and RLS with a disposable PostgreSQL container **when engineering implementation begins**; no database is touched by these design documents.
- Enforce in CI: migrations reviewed, OpenAPI diff, JSON Schema event compatibility, tenant auth tests, dependency security scan.

## Release gate
Phase 02 Gates A–E still apply. Also require signed OD-01/05/06/08 and V1 migration ownership, evidence for each architecture gate, no unresolved critical/high vulnerability, traceability to FR and AT IDs. Design artifacts alone never equal QA PASS or legal compliance.
