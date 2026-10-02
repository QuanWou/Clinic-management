# A0 — Foundation Gate Decision

**Date:** 2026-10-01  
**Task:** `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`  
**Decision:** **ACCEPTED BY PRODUCT OWNER**  
**Scope:** S0 Foundation → authorize implementation of S1–S6 according to Phase 05 backlog.

## Evidence considered

- S0-01 V1 read-only inventory and disposition package.
- S0-02 Clinic onboarding/review/publish/suspend foundation.
- S0-03 canonical Identity/IAM membership, revoke, tenant/branch authorization and RLS.
- S0-04 Doctor/Catalog affiliation, schedule, offering, immutable price versions/snapshots.
- S0-05 Audit/event envelope, synthetic environment, restore drill and local outbox reference.
- S0-06 Public/Workspace/Platform shells, state UX and API contract layer.
- Owner visually reviewed the running S0-06 Workspace and requested/approved a single-clinic Workspace UX before accepting the gate.

## Product-owner decision

The Product Owner has explicitly instructed the implementation team to **close A0 and proceed with full coding**.

The Clinic Workspace product UX is locked to **one clinic managed by the owner**. Backend branch entities remain available for domain records/authorization because the architectural model and later scheduling/encounter/billing invariants still carry `branch_id`; however branch is not a top-level Workspace tenant switch.

## Residuals carried forward

A0 acceptance is a product gate to continue implementation, not a production-release certification.

The following are still required at their normal downstream gates:
- S1–S5 business slices and their negative/integration tests.
- Manual keyboard/screen-reader/zoom accessibility review.
- Whole-platform producer adoption of local outbox/inbox and security audit patterns.
- OD-01/02/03 before any real deposit branch; until approved, S1 booking is **no-deposit only**.
- Medical/legal OD-05 and related clinical sign/release decisions before clinical release.
- Finance/legal decisions before full online payment/refund/settlement release.
- S6 full QA/Security/SRE/data-migration/go-no-go evidence.

## Authorized next implementation order

`S1 Find & Book → S2 Reception/Queue → S3 Clinical → S4 Revenue → S5 Portal/Aftercare → S6 Validation`

No later slice may silently treat an OPEN policy as approved.
