# P05-S0-03 — IAM / tenancy implementation & evidence

Date: 2026-09-30
Task: 6820c6b7-522a-4a2c-9f1b-b05d2184fb36 — Clinic Management V2
Branch: local-coder/clinic-management-v2-6820c6b7
Status: IMPLEMENTED for the S0-03 source scope. Unit/security and isolated PostgreSQL cases listed below are VERIFIED. A0 ACCEPTANCE remains pending because S0-04/05/06 and Security + Tech + QA sign-off are separate requirements.

## 1. Scope delivered

S0-03 backlog target: multi-clinic/branch membership, revoke, object authorization and fail-closed tenant connection for FR-IAM-01/02/03 and the relevant A0 negative cases.

Delivered:
- V2 Identity/IAM runtime at v2/services/identity-service.
- Membership lifecycle with multiple clinics per user and roles CLINIC_OWNER, CLINIC_MANAGER, RECEPTIONIST, CASHIER, DOCTOR, NURSE and LAB.
- All-branch membership or explicit branch grants.
- Invite, self-activate, branch grant/revoke and membership revoke with membership security events.
- Session cutoff through user_security_state.invalid_before; POST /api/v2/sessions/logout invalidates older access tokens.
- GET /api/v2/me/contexts returns ACTIVE membership contexts and branch grants.
- Internal authorization/check and user context endpoints protected by scoped workload JWTs.
- Clinic owner membership bootstrap is verified in both directions: Clinic asks IAM, and IAM independently checks Clinic source-of-truth before creating CLINIC_OWNER.
- Platform review permission is a separate IAM global capability instead of the old Clinic-local static operator allowlist.
- Clinic Service authentication and tenant decisions now delegate to V2 IAM.
- Clinic branch mutation authorizes the exact branch before DB tenant context is set.
- FORCE RLS and least-privileged runtime roles for Identity and Clinic tenant tables.
- Transaction-local tenant context so pooled DB connections do not retain prior clinic scope.
- S0-03 Identity README and updated Clinic README document runtime contract, environment and limitations.

## 2. Authorization invariants implemented

1. A client-supplied clinic or branch UUID is never authorization evidence.
2. IAM first sets user-only RLS and resolves an ACTIVE membership.
3. Branch-scoped membership works only for an explicitly granted branch.
4. Only after membership/capability verification does IAM set app.clinic_id.
5. Once clinic context is selected, Identity RLS does not continue exposing the same user's rows from another clinic.
6. Clinic Service then resolves the actual Clinic/Branch object from its own source DB under FORCE RLS.
7. Revoked memberships disappear from subsequent authorization/context queries; this slice keeps no permission cache.
8. Branch-grant changes cause the membership authorization version to change.
9. Workload calls validate issuer/subject, audience, token type, scopes, iat, exp and jti.
10. IAM/Clinic dependency failures are fail-closed.

## 3. Traceability

| Requirement / case | Source evidence | Result / boundary |
|---|---|---|
| FR-IAM-01 | TokenVerifier, LegacyIdentityClient, SessionSecurityService, /sessions/logout | Current access token + current account + local session cutoff; old token denied after logout |
| FR-IAM-02 | Membership, BranchGrant, /me/contexts, internal authorization | Multi-clinic contexts and backend-verified branch scope |
| FR-IAM-03 | Capability, MembershipService.authorize, Clinic IamAuthorizationClient, Clinic RLS | Role + tenant + branch enforced server-side; source service still enforces object/assignment/lifecycle |
| FR-ORG-05 | invite/activate/grant/revoke APIs | Staff scope can be granted/revoked without trusting JWT role alone |
| AT-004 | IamExternalPostgresTest cross-tenant case | Clinic A actor cannot authorize clinic B |
| AT-026 | ClinicTenancyExternalPostgresTest | Guessed clinic B object is denied and guessed tenant is not retained |
| AT-035 | external DB membership revoke case | Subsequent authorization denied after revoke even with an existing token actor |
| AT-043 | transaction-local RLS + dual-clinic test | Selected clinic hides same-user rows from other clinic; no backend stale tenant cache |
| AT-049 | external DB branch grant/revoke case | Only granted branch works; revoke has immediate effect |
| AT-025 guardian revoke | Not owned by S0-03 model | NOT CLAIMED; Patient/Guardian owner is a later slice |
| AT-028 / AT-036 clinical assignment/order branch | Medical/Encounter owners not present yet | NOT CLAIMED; IAM provides the tenant/role foundation only |

## 4. Database isolation and RLS

Identity migration V1__membership_tenancy.sql creates memberships, membership_branch_grants, user_security_state, platform_operators and membership_events plus the NOLOGIN role clinic_v2_iam_runtime with NOSUPERUSER, NOBYPASSRLS and NOINHERIT.

FORCE RLS behavior:
- missing user/clinic context exposes no tenant rows;
- user-only mode may see the current user's memberships across clinics for context discovery;
- after app.clinic_id is set, membership/grant/event visibility is restricted to that clinic;
- SET LOCAL context disappears after transaction commit/rollback;
- runtime credentials are separate from migration credentials.

Clinic retains the S0-02 FORCE RLS model. TenantDbContext uses transaction-local set_config(..., true), and authenticated object methods set tenant only after IAM approves the requested context.

No production/V1 DB or volume was used.

## 5. Verification record

### Normal suites after final edits

~~~powershell
mvn -q -f v2/services/identity-service/pom.xml test
mvn -q -f v2/services/clinic-service/pom.xml test
~~~

Observed:
- Identity unit/security: 15 passed, 0 failure/error.
  - SecurityTokenTest: 3
  - SessionSecurityServiceTest: 3
  - MembershipSecurityTest: 5
  - MembershipServiceTest: 4
- Clinic unit/security: 23 passed, 0 failure/error.
  - ClinicOnboardingServiceTest: 20
  - isolated legacy TokenVerifierTest: 3
- Opt-in external DB suites are skipped in a normal run by design.
- Existing Clinic Testcontainers suites also skip when Java Testcontainers cannot connect to Docker Desktop; skipped is not counted as PASS.

### Explicit Identity PostgreSQL test

A uniquely named PostgreSQL 16 disposable DB named exactly clinic_v2_s003_sandbox was used earlier in this task with a separate migrator and a non-superuser NOBYPASSRLS runtime login.

Observed after RLS hardening: 5 passed, 0 failure/error.

Covered:
- missing tenant context fails closed and runtime cannot bypass RLS;
- cross-tenant context denial;
- branch grant/revoke and full membership revoke immediate effect;
- session cutoff;
- same user with two clinics sees only the selected clinic after clinic context is set;
- branch-scoped manager cannot acquire clinic-wide configuration without an allowed branch context.

### Explicit Clinic PostgreSQL tenancy test

A separate PostgreSQL 16 disposable DB named exactly clinic_v2_s003_clinic_sandbox was migrated through Clinic V1/V2/V3 migrations with a non-bypass runtime login.

Observed: 1 passed, 0 failure/error.

Covered:
- missing tenant context returns zero Clinic rows;
- runtime is not superuser and cannot BYPASSRLS;
- transaction-local tenant scope disappears after transaction;
- owner A cannot read guessed clinic B;
- denied object lookup does not leave guessed tenant state in the pool.

### Final build

~~~powershell
mvn -q -f v2/services/identity-service/pom.xml -DskipTests package
mvn -q -f v2/services/clinic-service/pom.xml -DskipTests package
~~~

PASS, exit 0 for both modules after the final edits.

At the final rerun time Docker Desktop's Linux npipe was unavailable, so the external PostgreSQL containers could not be recreated once more. The successful external runs above were already completed in this task. The later changes were branch-specific Clinic authorization, a server-derived owner-index guard for owner-membership retry, logout route alias, documentation/config cleanup and their unit tests; normal suites and package builds passed after those edits.

## 6. Carry-forward limits

1. Legacy credential bridge: V2 IAM verifies the legacy HMAC access token and rechecks the account/role state against V1 Identity. V1 access tokens currently do not carry issuer/audience, so those claims cannot be retroactively required without changing the issuer. V2 workload JWTs do enforce issuer/audience/scope.
2. Patient/Guardian: guardian relationship, patient link and guardian revoke are not fabricated into clinic staff membership. Their source-owning services must add object/consent checks later.
3. Clinical assignment: Doctor/Encounter/Medical services must check assignment and lifecycle in addition to IAM role/tenant; IAM role alone never authorizes a chart.
4. Platform capability provisioning: the capability is separate from clinic roles and no user-facing route can self-grant it. Administrative/bootstrap provisioning remains controlled until Platform operations workflow is approved.
5. Unified tamper-evident audit and trace envelope belong to S0-05.
6. Frontend cache/worklist/websocket clearing on clinic switch belongs to S0-06. Backend context switching here is stateless and fail-closed.
7. A0 itself also requires S0-04/05/06 evidence plus Security + Tech + QA review.

## 7. Completion statement

P05-S0-03 is source-complete for the planned IAM/Security slice: multi-clinic/branch membership, revoke, backend-verified context, scoped service identity, Clinic object authorization integration and tenant RLS fail-closed behavior are implemented and verified for the source owners that exist in S0-03. Later Patient/Medical/UI requirements are explicitly not marked complete.
