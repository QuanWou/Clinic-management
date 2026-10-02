# P05-S0-01 — Test and evidence index

**Evidence cut:** 2026-09-29, source revision `e6ab0d4f45e0779dff82e555f990ab043614a5c6`.  
**STATUS MODEL:** `SOURCE_INSPECTED` = code/doc observed; `TEST_EXISTS_NOT_RUN` = test file present only; `NOT_RUN` = no executed evidence; `BLOCKED` = requires approved decisions/isolated environment; `PASS` is prohibited without a recorded run. No live V1 test or data migration was executed by this task.

## 1. Audit provenance

| Evidence ID | Artifact / actual observation | Status |
|---|---|---|
| SRC-00 | Workbench `verification.matches=true`, exact task ID; branch checkout HEAD as above | SOURCE_INSPECTED |
| SRC-01 | Original P01–P05 under `docs/clinic-v2/`; 92 files, 91 SHA256 lines verified at initial import; `MANIFEST_SHA256.txt` belongs only to original package | SOURCE_INSPECTED |
| SRC-02 | Maven modules, service Java/controllers/tests and Flyway file inventory: `S0-01_V1_Inventory.md` sections 2–5 | SOURCE_INSPECTED |
| SRC-03 | Route families and auth checks: controller and `SecurityConfig`/`JwtAuthenticationFilter` source | SOURCE_INSPECTED |
| SRC-04 | V1 DB migrations, `Entity` files and absence of scanned `clinic_id/branch_id/RLS` tokens | SOURCE_INSPECTED |
| SRC-05 | Frontend `App.tsx`, `roles.ts`, API endpoints, role workspaces and patient portal | SOURCE_INSPECTED |
| SRC-06 | Event outbox publishers/consumer and V1 notification persistence | SOURCE_INSPECTED |
| SRC-07 | Source-to-PRD gap disposition CSV/MD and dependency/risk documents in this directory | SOURCE_INSPECTED |
| RUN-01 | Backend `mvn test` or module tests in this exact checkout | NOT_RUN |
| RUN-02 | Frontend `npm test`, `npm run build` or browser E2E in this exact checkout | NOT_RUN |
| RUN-03 | Docker compose availability/health, live API, PostgreSQL/Flyway, DB constraints/RLS | NOT_RUN |
| RUN-04 | RabbitMQ replay/consumer, payment provider, backup/restore/migration rehearsal | NOT_RUN |
| RUN-05 | Security negative tests / two journey E2E / A0 signed evidence | NOT_RUN |

**Reason for NOT_RUN:** explicit read-only V1 audit, shared task/workspace safety, no disposable DB/environment or owner-approved test boundary supplied. We inspected test source, not executed. This prevents unintentional target/build/volume mutation or interference with another task.

## 2. Existing V1 test-file coverage — inspection only

| Area | Examples of current test source | What they can help verify after isolated run |
|---|---|---|
| Identity | `identity-service/src/test/java/com/clinic/identity/security/{JwtTokenTypeTest,JwtPurposeFilterIntegrationTest,AccountStateSecurityTest}.java`, `service/{AuthServiceRefreshTest,AuthRefreshConcurrencyIntegrationTest}.java` | Token purpose, refresh concurrency/account validity; **not** multi-clinic grants |
| Doctor | `doctor-service/src/test/java/com/clinic/doctor/{controller/DoctorProfileAuthorizationTest.java,service/DoctorServiceTest.java}` | Existing role/profile scope, schedule logic; **not** tenant affiliation |
| Appointment | `appointment-service/src/test/java/com/clinic/appointment/service/impl/{AppointmentConcurrencyIntegrationTest,AppointmentAvailabilityTest,AppointmentAuthorizationTest}.java`, `service/{ReceptionQueueServiceTest,ReceptionSchedulingServiceTest}.java` | V1 doctor/time overlap, queue and auth; **not** V2 hold TTL/walk-in independent visit |
| Medical | `medical-record-service/src/test/java/com/clinic/medicalrecord/controller/LabOrderControllerTest.java`, `security/JwtAuthenticationFilterTest.java` | V1 lab endpoints/auth; **not** immutable released document and full review |
| Billing | `billing-service/src/test/java/com/clinic/billing/service/impl/BillingServiceImplTest.java`, `controller/BillingControllerRouteTest.java`, `client/LabBillingClientTest.java` | V1 cash/finalization contracts; **not** partial/online/beneficiary |
| Notification | `notification-service/src/test/java/`, `appointment-service/src/test/java/com/clinic/appointment/service/AppointmentNotificationPublisherTest.java` | V1 delivery/relay if run; **not** cross-tenant event validation |
| Gateway | `api-gateway/src/test/java/com/clinic/gateway/{controller/GatewayCorsTest.java,service/DashboardAggregationServiceTest.java}` | V1 gateway CORS and aggregator; **not** V2 context BFF |
| Frontend | `frontend/src/api/{client,auth,clinic,staffDashboard}.test.ts`, role pages tests under `frontend/src/pages/`, role utilities tests under `frontend/src/utils/` | V1 rendering/API shape, not independent public/clinic/platform routes |

**Test source inventory:** Backend 69 Java tests (2 gateway + 10 identity + 6 patient + 8 doctor + 2 catalog + 15 appointment + 9 medical + 8 billing + 9 notification); frontend 36 `.test.*` source files. Counts do not imply all code paths are covered, nor any PASS.

## 3. Required S0/A0 validation plan and evidence slots

| Test / gate | FR / AT / UX / ARCH | Expected evidence and negative path | Current status |
|---|---|---|---|
| T-A0-01 Clinic onboarding | FR-ORG-01/02/07; AT-001/002/003/050; UX-A09 | Clinic source/API preview: reject incomplete submit, only platform approver publish, never expose draft/suspended, no deletion of old bookings; full Search AT-050 completion in S1 | NOT_RUN |
| T-A0-02 Branch owner scope | FR-ORG-03; AT-048 | Valid clinic+branch linkage; cross-clinic branch reference rejected | NOT_RUN |
| T-A0-03 Unauthorized clinic ID | FR-IAM-02/03; AT-004/026; ARCH-01 | A user guesses B object by GET/PUT; no B read/write; audit actor/object/outcome | NOT_RUN |
| T-A0-04 Revoke with stale JWT | FR-IAM-01/02/03; AT-035/046/049; ARCH-02 | Revoked membership's next request fails even when JWT remains unexpired | NOT_RUN |
| T-A0-05 Context switch/cache | AT-043; UX-A10/25 | A→B→A clears cache, worklist and private URL; UI shows active branch/denied state | NOT_RUN |
| T-A0-06 RLS/connection pool | ARCH-03, AT-026 | Missing/wrong GUC and reused pooled connection fail closed, service account no BYPASSRLS | NOT_RUN |
| T-A0-07 Doctor affiliation | FR-ORG-06; AT-005 | Change A schedule does not modify B; unauthorized branch access denied | NOT_RUN |
| T-A0-08 Price history | FR-ORG-04; AT-016/045 | Branch price scoped; old snapshot immutable after new effective price | NOT_RUN |
| T-A0-09 Audit/trace/event | FR-OPS-04; AT-039/068; ARCH-16, UX-A24 | Actor+clinic+branch+object+outcome+UTC+correlation; replay one effect; non-PHI payload | NOT_RUN |
| T-A0-10 Restore rehearsal | FR-OPS-05; AT-038; ARCH-15 | Synthetic backup/restore integrity, measured RPO/RTO; no live medical dataset | NOT_RUN |
| T-A0-11 Shell/accessibility | UX-A09/10/23/24/25 | Public guest accessible; clinic context visible; platform distinct; keyboard focus; no raw 403 as only guidance | NOT_RUN |
| T-A0-12 Contract/version | ARCH-16; P05 contract handoff | Owner's full API/event schema; tolerant consumer, deny unverified header, endpoint and error compatibility | NOT_RUN |

**Later-slice contract tests to plan now (NOT S0 implementation):** AT-006/007/042 for hold/deposit, AT-009/010 for walk-in/queue, AT-013/023 for unreviewed results, AT-014/015/034/041 for signed/released, AT-017..021/029..033 for money, two E2E journeys, and AT-040 for migration. No result from an existing V1 test may be substituted for them.

## 4. Future authorized isolated test procedure (not executed)

1. Obtain owner-approved isolated checkout, container names/ports/DBs that do not collide with other tasks. Confirm Workbench exact task again; record HEAD/dirty tree and branch. Use synthetic A/B clinic, branch and identity fixtures; no real patient records.
2. Confirm separately provisioned dev/staging credentials and backup target. Never run `docker compose down -v`, drop/reset/stash/clean shared V1, or execute P03 reference DDL as migration.
3. Run module tests/build on isolated environment; capture command, exit, timestamp, surefire/Vitest results and dependency versions (e.g. `mvn -pl <module> -am test`, `npm test`, `npm run build`), then integration/contract/negative cases. Only safe commands approved for the assigned checkout.
4. For each test: run ID, source commit, environment, synthetic fixture, FR/AT/ARCH/UX, expected/actual, redacted evidence/log, defect and owner. Label BLOCKED rather than PASS if an OD or source contract is missing.
5. QA/Security/PO review A0 package. `IMPLEMENTED` is code present; `INTEGRATED` is connected owner contracts; `VERIFIED` is executed evidence; `ACCEPTED` is signed gate.

## 5. Sign-off register

| Reviewer | Artifact | Status |
|---|---|---|
| Tech Lead | Source revision/disposition, bounded-context owner and ADR | PENDING |
| Clinic/Platform Lead | Publication/branch and OD-11 | PENDING |
| Security/Privacy/DBA | Tenant/branch/RLS/revoke, OD-06/10 | PENDING |
| Medical Lead | Encounter/clinical record assumptions and OD-05/07 | PENDING |
| Finance/Legal | OD-01/02/03/08, cash/online migration policy | PENDING |
| UX Lead | Public/workspace/platform shell acceptance | PENDING |
| QA Lead | Evidence protocol, isolated A0 run plan | PENDING |
| PO | S0 planning scope and go/no-go for implementation | PENDING |

**Current conclusion:** S0-01 static source audit report delivered for review; no claims that V2 implementation has started, A0 is satisfied, full V1 runtime audited or tests passed.
