# P05-S0-01 — Risks, open decisions and change control

**Status:** audit findings and engineering recommendations; no Product/Finance/Medical/Legal/Privacy decision is made by this report. OD-01–OD-12 stay **OPEN**, technical ADRs remain **PROPOSED** until signed. Evidence scope: current repo static at `e6ab0d4f45e0779dff82e555f990ab043614a5c6`; live DB/runtime not verified.

## 1. Source-grounded risk register

| Risk | Source signal and consequence | Severity / affected slice | Mitigation and pass condition / owner |
|---|---|---|---|
| R01 Cross-tenant data exposure | Every scanned V1 Java/SQL/YAML is missing clinic/branch fields/RLS; global admin and staff endpoints operate without tenant owner. `identity/V1__create_identity_tables.sql:20-25`, `appointment/V1__create_appointment_tables.sql:1-16`, `frontend/src/utils/roles.ts:5-36` | **CRITICAL**, S0/A0 | Define Clinic/IAM owner, server-verified context, least-privilege DB and RLS, object+assignment checks; demonstrate AT-004/026/036/043/049 and ARCH-01..03 (Security/DBA) |
| R02 No authoritative Clinic publishing | No clinic/branch/licence owner exists; V1 doctor directory is not approval-controlled marketplace data; draft/suspended must never be bookable | **HIGH**, S0→S1 | NEW Clinic publication workflow, legal public-field list OD-11; AT-001/002/003/050 (PO/Platform/Legal) |
| R03 Incompatible walk-in linkage | `reception_visits.appointment_id NOT NULL UNIQUE`, medical and billing likewise appointment-bound; walk-in patient alone is not walk-in visit | **CRITICAL** for S2–S4 | Own distinct Encounter and nullable appointment, preserve legacy ref; AT-009/010/ARCH-06 (Tech/Clinic) |
| R04 Stale identity permission | V1 current-role recheck in some services does not confer clinic-scoped membership/revoke guarantee | **HIGH**, S0 | Contract for live membership/version/branch + authenticated owner; invalidation tests AT-035/043/046/049 (IAM/Security) |
| R05 Doctor/capacity across locations | `doctors.user_id UNIQUE` and doctor/day uniqueness cannot safely express shared practitioner with branch-specific shifts and independent clinic scope | **HIGH**, S0→S1 | Affiliation/schedule model with approved OD-04; AT-005/006 (Clinic/Medical/Appointment) |
| R06 Price/charge ownership | Global catalog prices and appointment-only invoice; no clinic/branch beneficiary; price and charge can be wrongly attributed during migration | **HIGH**, S0→S4 | Branch/version mapping, charge-source uniqueness, separate collector ledger; AT-016/017/021/045 (Catalog/Finance) |
| R07 Signature vs release conflation | `medical_records` has DRAFT/FINAL, but no independent signed version/release; patient `getMyRecords` returns FINAL without a release predicate (`MedicalRecordServiceImpl.java:247-261`) | **CRITICAL** for S3/S5 | Build immutable version/signature and explicit release/grant; block draft/unreleased; AT-014/015/022/034/041 (Medical/Privacy) |
| R08 Order-result review gap | V1 LabOrder ends at RELEASED, no doctor-reviewed result state; clinical record finalized from same appointment context | **HIGH**, S3 | Separate order result/doctor review and overnight waiting; AT-012/013/023 (Medical) |
| R09 Money effect misrepresentation | V1 payment_transactions only cash and one capture per invoice; no verified online webhook/partial payment/merchant ledger; historical payments quarantined | **CRITICAL** for S4 | Signed provider contract, exact-once effects, immutable ledger, partial and refund references, reconciliation; AT-018/029..033/064 (Finance/Legal/Payments) |
| R10 Pooled DB privileges | Compose shares `clinic_db` and common DB credential across services; RLS proof absent | **HIGH**, S0 | Separate service runtime roles and no BYPASSRLS, isolated DB access, force RLS, schema dry-run; ARCH-03 (DBA/Security) |
| R11 Broker event trust / PHI | Present notification event accepts minimal V1 `IN_APP` event, lacking validated producer tenant context; new V2 event schema has clinic/branch and no PHI | **HIGH**, S0→S1 | Versioned authenticated envelope, outbox/inbox replay, cross-tenant/forged event tests; AT-037/039/066 (Platform/Security) |
| R12 Accidental V1 data loss | Legacy records lack clinic ownership; deleting V1 or direct P03 sample SQL migration could lose clinical/payment history | **CRITICAL**, S0/S6 | Isolated snapshots + immutable old→new ID mapping, quarantine unknown, row/hash/amount reconcile and rollback drill AT-038/040 (Data/Clinic/Finance/Medical) |
| R13 Unverified integration | Source/test files exist, but this task ran no DB, broker, backend/frontend build or E2E; cannot infer system readiness | **HIGH**, all gates | Evidence index, synthetic isolated tests, owner signoff, no false PASS (QA/Tech) |
| R14 Source/docs drift | P01 and P03 explicitly pre-audit; V1 billing README mentions blockers while current publisher classes exist; current branch is not live DB state | **MEDIUM**, all | Treat source revision as evidence, refresh after parallel edits, code/contract/run comparison and CR for mismatches (Tech) |
| R15 Credential/operational posture | Local Compose includes dev convenience credentials and exposes internal service ports; no production secret management/restore verified | **HIGH**, S0/S6 | Separated synthetic sandbox and managed secrets/least privilege before pilot, do not reuse sample credentials (SRE/Security) |

No exploit, loss of money or PHI disclosure has been demonstrated by this static review; risk descriptions are architectural exposure and missing verification, not incident claims.

## 2. Product decision register — statuses carried forward unchanged from P02

| OD | Decision still OPEN | Owner from P02 | Gate / approved interim behavior |
|---|---|---|---|
| OD-01 | Online merchant/beneficiary/collect-on-behalf | Finance/Legal | Blocks real platform-collected payments/deposits; distinguish collectors in architecture |
| OD-02 | Deposit, amount/TTL and handling | PO/Clinic | Blocks deposit branch S1-05; sandbox no-deposit is proposed fallback, not a policy vote |
| OD-03 | Cancel/no-show/refund actor and threshold | PO/Clinic/Finance | Blocks financial exceptions and production cancel/refund mechanics |
| OD-04 | Choose exact doctor vs specialty pool | Clinic/Medical | Affects S0 affiliation/capacity contract and S1 slot, S2 assignment |
| OD-05 | Outpatient forms, mandatory fields and lawful signing | Medical/Compliance | Blocks production clinical signing/release claims; signed evidence design only |
| OD-06 | Cross-branch/cross-clinic chart sharing | Privacy/Medical | Default deny; explicit purpose/consent/grant later |
| OD-07 | Internal vs partner lab/pharmacy | Clinic | P0 internal workflow baseline proposed; external adapters deferred |
| OD-08 | Receipt/tax invoice and issuer | Accounting/Legal | Internal receipt label only until legally approved |
| OD-09 | Workload/SLA/RPO/RTO | PO/Tech | Prepare metrics/drill; performance/recovery number is not achieved/guaranteed |
| OD-10 | Matching, patient link, guardian evidence/revoke | Privacy/Clinic | No blind merge or guardian access until verified |
| OD-11 | Clinic license and approved public field list | Legal/Platform Ops | Needed for S0 publish acceptance and S1 public index |
| OD-12 | Legacy duplicate/unowned source mapping | Tech/Clinic | Quarantine ambiguities; migration on copy only; S6 cutover gate |

Ground truth: `docs/clinic-v2/02_Product_Requirements/Decision_Log.md:11-22`; P03 `10_ADR_and_Open_Decisions.md:18-32`; P05 `08_Risks_Decisions_and_Dependency.md:6-21`.

## 3. Engineering ADR queue (still not approved)

| ADR / decision | Needed before | Alternatives to record | Owner |
|---|---|---|---|
| A01/A02 — service data ownership, per-service runtime credential, pooled tenant+RLS | S0-02/03 schema implementation | Separate logical DB versus strict schema isolation for local dev; FORCE RLS and safe connection context | Tech/DBA/Security |
| A03 — Encounter deployment | S2 interface and early S0 owner contract | Deployable encounter-service versus co-deployed module with independent semantics/data/API | Tech/Medical |
| A04 — slot truth and capacity source | S0 Doctor scheduling schema and S1 hold | Per doctor or shared specialty resource; concurrency model | Appointment/Clinic |
| A05 — event bus, envelope and owner | S0-05 contracts | Broker and publisher/consumer identities, outbox/inbox versions | Platform/Security |
| A06/A09 — ledger/merchant | S1 deposit conditional, S4 money model | Clinic merchant or approved platform collection-on-behalf, refund/settlement legal split | Finance/Legal |
| A07 — signed version/retention | S3 | Qualified signature/evidence/archival/legal mapping | Medical/Legal |
| A08 — public search read model | S1 | PostgreSQL projection first vs dedicated index only after metrics | Product/Tech/Security |
| A10 — strangler/migration/cutover | S0 migration contract, S6 | V2 parallel deploy, source owner per write, read shadow/diff/canary/rollback | Data/Release |
| UI topology / `/api/v2` contract | S0-06 / S1 | Proposed `v2/` separate apps/BFF or repository-specific approved boundary | UX/Tech/PO |

## 4. Change-request trigger and consequences

Any conflict between actual V1 source and product rule P02, or between P02 and P03/P04/P05, must be recorded as `CR ID → source/rule → alternatives → impact on schema/API/event/UI/test/data/privacy/legal → owner signoff → version → rollback`. Examples to explicitly raise:

- **CR candidate C01:** choice of Encounter deployment and how V1 `reception_visits` maps to `visit` without fake appointments.
- **CR candidate C02:** reconciliation of global `ROLE_ADMIN` into clinic owner/manager versus separate platform operator; no automatic tenant grant.
- **CR candidate C03:** historical V1 `FINAL` vs signed/released clinical evidence. Do not promote old rows to legally signed/released by backfill.
- **CR candidate C04:** historic global catalog price and appointment-bound cash invoice mapping to branch/beneficiary/charge source.
- **CR candidate C05:** V1 source lacking clinic owner; quarantine and clinic lead verification before migration.
- **CR candidate C06:** phase 3 spec mentions `sql/tenancy_reference.sql` whereas ZIP has `sql/01_tenancy_reference.sql`; documentation link only, not executable migration.
- **CR candidate C07:** `backend/billing-service/README.md` integration status may predate current notification publisher. Verify present branch + runtime tests before changing status.

**Do not:** decide an OD from implementation convenience, access real patient data to infer tenant, use hardcoded deployment credentials, auto-merge by phone, claim a payment from return URL, or mark a UX prototype as working API.
