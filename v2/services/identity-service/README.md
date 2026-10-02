# Clinic Management V2 — P05-S0-03 Identity / IAM

**Status:** S0-03 backend implemented and verified for the evidence listed below. This module is the S0-03 runtime target for membership, clinic/branch context, revocation-aware session checks and internal authorization. It does not make a production-readiness claim for later Patient/Guardian or clinical assignment flows.

## Boundary and owned data

Identity/IAM owns:

- clinic staff memberships: `(user_id, clinic_id, role, status, all_branches, version)`;
- explicit branch grants for memberships that are not all-branch;
- per-user session cutoff (`invalid_before`) for logout/revoke-current semantics;
- platform operator capability as a separate global permission, not a clinic role;
- append-only membership security events for invite/activate/grant/revoke actions.

Clinic ownership and branch existence remain owned by Clinic Service. IAM calls the Clinic internal scope endpoint through a signed workload token before bootstrapping an owner or granting a branch.

## Request authorization model

1. User access token is verified as an `access` token and must have current `iat/exp`.
2. During the V1→V2 transition IAM also calls legacy Identity `/api/users/me` and requires the same active user id and current role set. This is a compatibility bridge, not the final V2 credential issuer.
3. IAM checks `user_security_state.invalid_before`; tokens issued at/before the cutoff are rejected.
4. A requested `clinicId/branchId` never becomes DB tenant context by itself. IAM first uses user-only RLS to find an ACTIVE membership and required capability.
5. Only after that check passes does IAM set transaction-local `app.clinic_id`.
6. Downstream services still resolve the requested object from their own source of truth and enforce resource owner, branch, assignment, lifecycle and consent rules. IAM role/capability alone is not enough for a clinical object.

There is no permission cache in this slice. Membership/branch changes are read from the source on subsequent authorization calls. Membership and branch-grant changes also change the membership version returned to consumers.

## API

Authenticated user routes:

- `GET /api/v2/me/current`
- `GET /api/v2/me/contexts`
- `POST /api/v2/sessions/logout` (alias: `/sessions/revoke-current`)
- `GET /api/v2/clinics/{clinicId}/memberships`
- `POST /api/v2/clinics/{clinicId}/memberships`
- `POST /api/v2/memberships/{membershipId}/activate`
- `POST /api/v2/clinics/{clinicId}/memberships/{membershipId}/branches`
- `POST /api/v2/clinics/{clinicId}/memberships/{membershipId}/branches/{branchId}/revoke`
- `POST /api/v2/clinics/{clinicId}/memberships/{membershipId}/revoke`

Internal workload routes:

- `POST /api/v2/internal/iam/authorization/check` — requires scope `iam.authorize`
- `GET /api/v2/internal/iam/users/{userId}/contexts` — requires `iam.contexts.read`
- `POST /api/v2/internal/iam/owners` — requires `iam.owner.provision`

Internal tokens must be short-lived workload JWTs with issuer/subject, target audience, token type, scopes, `iat/exp/jti`. Unknown issuer/audience/scope fails closed.

## Roles and capabilities

Implemented clinic roles: `CLINIC_OWNER`, `CLINIC_MANAGER`, `RECEPTIONIST`, `CASHIER`, `DOCTOR`, `NURSE`, `LAB`.

Authorization capabilities are evaluated server-side. A branch-scoped membership may use a capability only for an explicitly granted branch. Clinic-wide mutations require an all-branch membership. `CLINIC_MEMBER`/basic clinic read can be used to answer membership-existence checks without selecting a branch. Platform review is a separate global capability and never comes from a clinic role.

Owner transfer/revocation is intentionally not implemented in S0-03; a dedicated approved ownership workflow is required.

## PostgreSQL RLS

Migration `V1__membership_tenancy.sql` creates a least-privileged NOLOGIN runtime role and FORCE RLS policies.

- Missing `app.user_id/app.clinic_id` exposes no tenant rows.
- User-only context can see that user's memberships across clinics so IAM can list/select contexts.
- After a clinic is selected, the policy restricts rows to that clinic; it does **not** continue exposing the same user's rows from another clinic.
- `SET LOCAL` is transaction-scoped so pooled connections do not retain a previous tenant after commit/rollback.
- Runtime DB login must be non-owner, `NOSUPERUSER`, `NOBYPASSRLS`; migration credentials are separate.

RLS is defense-in-depth only. It does not replace object/assignment/consent checks in source-owning services.

## Configuration

Required environment variables for an isolated V2 environment:

```text
IAM_V2_DB_URL=jdbc:postgresql://127.0.0.1:<port>/<isolated-v2-db>
IAM_V2_DB_USER=<non-owner runtime login>
IAM_V2_DB_PASSWORD=<runtime secret>
IAM_V2_DB_MIGRATOR_USER=<migration login>
IAM_V2_DB_MIGRATOR_PASSWORD=<migration secret>

IAM_V2_JWT_SECRET=<legacy-compatible access-signing key during transition>
IAM_V2_LEGACY_IDENTITY_URL=http://127.0.0.1:8083

IAM_V2_CLINIC_URL=http://127.0.0.1:8092
IAM_V2_CLINIC_INBOUND_SECRET=<Clinic->IAM workload secret, >=32 bytes>
IAM_V2_CLINIC_OUTBOUND_SECRET=<IAM->Clinic workload secret, >=32 bytes>
IAM_V2_ALLOWED_WORKLOAD_ISSUERS=clinic-v2-service
IAM_V2_PORT=8093
```

Do not point this module at the V1 production database. The S0-03 migration is intended for an isolated V2 IAM schema/database and synthetic verification.

## Verification

Normal unit/security suite:

```powershell
mvn -q -f v2/services/identity-service/pom.xml test
mvn -q -f v2/services/identity-service/pom.xml -DskipTests package
```

The real PostgreSQL test is opt-in and refuses a database whose URL does not end with the exact disposable database name `clinic_v2_s003_sandbox`. It verifies FORCE RLS, no pooled-context leak, cross-clinic denial, branch grant/revoke, immediate membership revoke and session cutoff.

The implementation evidence is under:

`docs/audits/clinic-v2/P05-S0-03/S0-03_Implementation_Evidence.md`

## Explicit carry-forward limits

- Patient identity, guardian grants/revocation and clinical assignment are later domain slices; S0-03 provides the authorization foundation but does not claim AT-025/AT-028/AT-036 are end-to-end complete before those resource owners exist.
- The compatibility token bridge does not add issuer/audience claims that V1 access tokens do not currently carry. V2 workload tokens do enforce issuer/audience/scope.
- Platform operator grants are stored as a separate global capability. No public/user-facing endpoint may self-grant it; provisioning remains an administrative/bootstrap concern until the Platform operations workflow is approved.
- Security audit unification, immutable/tamper-evident audit sink and full trace envelope belong to S0-05.
