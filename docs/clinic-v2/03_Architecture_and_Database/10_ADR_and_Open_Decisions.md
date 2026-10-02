# 10 — Architecture decision record and open decisions

**LOCKED only:** marketplace+SaaS, general clinic, outpatient, hybrid payment. Everything below is the working technical baseline and may change through review before code/migration.

| ADR | Proposed architecture | Why / alternative | Review owner |
|---|---|---|---|
| A01 | DB ownership per domain service | avoids shared mutable schema; co-deploy modules where justified | Tech lead |
| A02 | clinic row scope + RLS + app authorization | tenant defense-in-depth vs one DB per tenant; evaluate regulated deployments | Security/DBA |
| A03 | Encounter independent from Appointment | supports walk-in and work-in-progress visits | Medical/Tech |
| A04 | Appointment owns slot reservation atomically | search hint is not capacity truth | Scheduling |
| A05 | Outbox/inbox + at-least-once event bus | durable events and idempotent business effects | Platform |
| A06 | Billing immutable journal, per-collector/beneficiary | audited hybrid payment with reconciliation | Finance |
| A07 | Signed document version immutable + addendum | provenance and tamper resistance | Medical/Legal |
| A08 | Public projection of approved non-PHI data | protects private data, scalable browsing | Product/Security |
| A09 | Explicit merchant configuration, no client override | platform collection requires legal/commercial approval | Finance/Legal |
| A10 | V1 strangler with mapping and rollback | history preservation, no big-bang destructive rewrite | Release lead |

## Open dependencies carried from PRD
| OD | Blocker and interim behavior |
|---|---|
| OD-01 Merchant/beneficiary | Architect both collection modes; **do not enable platform collection-on-behalf** until contract, payout, fee, refund/legal entity approved |
| OD-02 Deposit | per-clinic policy with default no deposit until approved; slot TTL configurable |
| OD-03 Cancel/no-show/refund | model reason/history; policy thresholds are not hardcoded |
| OD-04 Doctor choice | capacity supports chosen doctor or pool; UI/clinic rule pending |
| OD-05 Medical template/signature | store version/evidence, block production signing claims until qualified review |
| OD-06 Cross-branch/cross-clinic sharing | deny cross-clinic by default and implement explicit grant later |
| OD-07 Lab/pharmacy | internal test workflow P0; adapters later |
| OD-08 Legal billing docs | internal receipt only; no assertion of tax e-invoice without integration |
| OD-09 SLO/RPO/RTO | proposed only pending production workload and restore drill |
| OD-10 Patient identity/guardian | verified matching and revocable relationship, no blind merge |
| OD-11 Publication criteria | only approved public fields; license verification process sign-off |
| OD-12 Legacy collision | unresolved source records isolated for human review, not auto-merged |

## Additional architecture decisions needed
- AD-01: host/deployment topology, network zones and exact broker technology.
- AD-02: level of tenant isolation for exceptionally high-risk tenants (dedicated DB vs pooled).
- AD-03: EMR signature provider and archival/retention implementation.
- AD-04: accounting settlement and payment service provider contractual structure.
- AD-05: exact clinical form/value sets and the test fixtures to validate them.
- AD-06: branch policy on shared charts, practice-wide reports and care assignments.

No technical baseline is an authorization to alter source, production DB or handle real patient records.
