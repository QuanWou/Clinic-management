# 01 — System architecture, data ownership, and ADR baseline

## Architectural drivers
1. Isolation between Clinic A/B (including staff with multiple memberships), branch and record-level access.
2. Booking and walk-in converge at **Encounter**; never fabricate appointment for walk-in.
3. A clinical signature, encounter completion, appointment fulfillment, payment and document release are **independent** facts.
4. Clinic's local collection and platform collection-on-behalf must be distinguishable; merchant/legal relationship remains OD-01 `[OPEN]`.
5. Online search uses a public projection; booking never trusts index/cache availability.
6. All write-side state transitions and financial effects withstand retries, concurrency and partial failures.

## Logical topology
See `diagrams/01_context.mmd`. Public Web/Patient Portal, Clinic Workspace and Platform Console each use an API Gateway/BFF. The gateway authenticates and routes; domain services make final authorization decisions. Internal events flow over a broker with transactional outbox/inbox. Each service owns its schema/database and credentials; no cross-service SQL joins or foreign keys. Denormalization is explicit and provenance/versioned.

## Bounded contexts and source-of-truth
| Context | Owns | Publishes/validates | NOT owner of |
|---|---|---|---|
| Identity | platform user, session, membership and grant | MembershipChanged, revocation epoch | clinical record |
| Clinic | clinic, branch, license evidence, approval/publication | ClinicPublished, BranchChanged | staff login secrets |
| Patient | patient identity, clinic-patient link, guardian authority | PatientLinked, GuardianRevoked | foreign clinic medical record |
| Doctor | practitioner, affiliation, schedule, leave | ScheduleChanged | appointment confirmation |
| Catalog | offering, branch price version, policy snapshot | OfferingPublished, PriceVersionChanged | bill item after issuance |
| Appointment | slot inventory, slot hold, appointment, reschedule history | AppointmentConfirmed/Cancelled | encounter note/queue |
| Encounter (`[PROPOSED]` independent context) | visit, check-in, queue, practitioner assignment, visit state | PatientCheckedIn, EncounterStarted | clinical record and payment |
| Medical Record | notes, documents/versions, clinical orders/results, prescriptions, signature/release | OrderCreated, ResultReleased, DocumentReleased | payment journal |
| Billing | charge, bill, payment attempt, payment journal, refund, reconciliation/settlement | ChargePosted, PaymentSucceeded, RefundSucceeded | appointment availability |
| Notification | preference, template, delivery/attempt | delivery status | clinical truth |
| Search | approved public projection only | no command authority | clinical/financial data |
| Audit | append-only security and domain access audit (also domain-local audit) | retention/monitoring | mutable business source |

**Identity vs Clinic:** membership is authoritative in Identity, constrained by clinic/branch existence verified from Clinic. Doctor affiliation/schedule is authoritative in Doctor; using a valid membership is not sufficient to access a particular patient's record. Encounter is a *bounded context*, not necessarily a new deployable service on day one: a modular implementation may co-deploy it while retaining independent API/table ownership.

## Data stores and infrastructure `[PROPOSED]`
- PostgreSQL service-owned logical databases (or strict separate schemas/users during local development). For tenant tables, pooled rows with `clinic_id`, branch scope and RLS as defense-in-depth. Identity/approved public projection have separate global rules.
- Redis **only** for safe ephemeral cache, rate limits and advisory presentation; reservation truth and financial truth stay in PostgreSQL transactions.
- Object storage encrypted, tenant-separated object keys and private access through short-lived authorized downloads; only metadata and checksums in medical database.
- Broker (RabbitMQ/Kafka-like, decision OPEN) transports integration events with at-least-once semantics. Outbox relay + consumer inbox.
- Search initially PostgreSQL read model; dedicated search engine only after workload/quality evidence, no requirement to deploy Elasticsearch in P0.
- Centralized OpenTelemetry-like trace context, metrics, structured logs without PHI; alerts on DLQ, payment unknowns, projection lag.

## Interaction rules
1. **Synchronous** for user-facing commands and current checks: booking owner validates slot and clinic status; encounter validates patient/assignment; billing validates amount and beneficiary.
2. **Asynchronous** for public projection, notifications, downstream billing charge creation, analytical updates and permitted care workflow messages.
3. **No distributed DB transaction.** Small local ACID transactions, explicit Sagas for long-running flows, idempotent compensation.
4. One transaction cannot presume that an event has already reached another service; UI presents pending state where necessary.
5. Webhooks enter Billing through a dedicated verified endpoint; frontend return page is not payment proof.
6. Versioned contracts and consumer-driven tests precede breaking changes.

## Slices and ownership rollout
- S0: IAM+Clinic+audit, tenant scope and RLS.
- S1: Doctor+Catalog+Appointment+Search, booking and no-double-book.
- S2: Patient+Encounter+queue, walk-in/check-in.
- S3: Medical, orders/results/prescription/signature/release.
- S4: Billing direct/online, refund/reconcile, beneficiary/settlement.
- S5: Portal, notification, migration/release gates.

## ADR summary
A01 database per service; A02 tenant row scope + RLS; A03 Encounter separated semantically; A04 source of slot truth is Appointment; A05 event bus + outbox/inbox; A06 immutable financial postings; A07 versioned signed clinical documents; A08 public projection only; A09 hybrid payments separate collector/beneficiary; A10 gradual V1→V2 strangler. All are `[PROPOSED]` until signed architecture review; details in `10_ADR_and_Open_Decisions.md`.
