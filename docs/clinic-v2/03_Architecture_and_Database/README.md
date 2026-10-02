# Clinic Management V2 — Phase 03 Architecture Package

**Document:** CMV2-ARCH-001 · **Version:** 0.9 architecture candidate · **Date:** 2026-09-29

**Locked product scope:** Marketplace + SaaS; general clinics (multiple branches); outpatient; hybrid payments (clinic direct and online). This is a proposed target architecture, **not** a representation of the current V1 repository and **not** approval to deploy or migrate patient data.

## Contents

| File | Purpose |
|---|---|
| `01_System_Architecture.md` | Context, bounded contexts, deployment view, ownership, ADRs |
| `02_Multi_Tenancy_and_Authorization.md` | Verified tenant context, memberships, RLS, object authorization, cross-clinic access |
| `03_Data_Model_and_ERD.md` | Per-service entity catalog, relationships, identifiers, ERD diagrams |
| `04_Lifecycle_and_Invariants.md` | State machines, transition guards and business invariants |
| `05_API_Contracts.md` | API conventions, ownership, endpoint index, request/response examples |
| `06_Events_Sagas_and_Sequences.md` | Events, outbox/inbox, booking/payment workflows, failure recovery |
| `07_Security_Operations.md` | Audit, sensitive records, availability, backups, observability |
| `08_V1_Migration_Strategy.md` | Source audit, mapping, strangler, dry-run, reconciliation, rollback |
| `09_Architecture_Acceptance.md` | Architecture test gates mapped to PRD acceptance IDs |
| `10_ADR_and_Open_Decisions.md` | Locked vs proposed architecture decisions and launch blockers |
| `diagrams/*.mmd` | Editable Mermaid architecture, ERD, state and sequence diagrams |
| `contracts/openapi.yaml` | Valid OpenAPI 3.1.1 **representative contract baseline**, not every P0 route |
| `contracts/event-envelope.schema.json` | JSON Schema for non-PHI event envelope |
| `sql/*.sql` | **Reference DDL patterns** (non-production, non-migration) |

## Reading order
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10. Render `.mmd` using any Mermaid-compatible viewer. SQL files are design examples, not executed against any database.

## Source of truth and caveats
- Built from Phase 01 discovery and Phase 02 PRD v0.9, whose 4 scope choices are LOCKED. Corresponding Phase 02 decision items OD-01–OD-12 remain OPEN unless explicitly changed by the Product Owner.
- `[PROPOSED]` technical baseline; `[OPEN]` approval/input needed; `[LOCKED]` explicit product choice; `[GATE]` release prerequisite.
- Existing V1 service names/routes/schemas and actual repository implementation are **not audited**. No source, workspace, database, or patient records modified.
- Legally compliant EMR, electronic signatures, merchant/collect-on-behalf arrangements, formal invoicing and record retention require professional sign-off and system verification.

## Public technical references
- OWASP multi-tenant security: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- PostgreSQL RLS: https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- OpenAPI 3.1.1: https://spec.openapis.org/oas/v3.1.1.html
- CloudEvents 1.0: https://github.com/cloudevents/spec/tree/v1.0.2
- Microsoft idempotent consumer: https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer
- Phase 02 PRD includes Vietnamese legal references; confirm applicability before production.
