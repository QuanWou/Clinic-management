# 02 — Multi-tenancy and authorization design

## Tenancy model `[PROPOSED]`
- Global **PlatformUser** with UUID. **PatientIdentity** can exist without PlatformUser for walk-ins; verified link is separate.
- **Clinic** is primary tenant boundary; **Branch** is an owned sub-scope (`branch.clinic_id = clinic.id`). `clinic_id` is mandatory on all clinic-owned operational/clinical/financial rows.
- **Membership** `(user_id, clinic_id, branch_scope, role, status, version)`, allowing one user to work at A and B. Branch scope may be all branches or explicit grants.
- Staff may have many roles, but grants are evaluated *per action and object*, not unioned across unrelated clinic contexts.
- A patient has a global identity and `clinic_patient_link` with clinic-scoped local reference, verification/provenance. This does **not** grant B access to A's encounters. A guardian link requires verified relationship, expiry/revocation and document scope.

## Request context path
1. Gateway verifies token issuer/audience/signature/expiry and session revocation. `X-Clinic-Id` is only a requested context, never proof of access.
2. IAM/permission guard resolves an **active, non-revoked membership** for actor + chosen clinic/branch; scopes are verified against Clinic owner relationship.
3. Destination service resolves resource owner clinic/branch server-side; verifies action permission **and** assignment/doctor-patient/guardian relationship.
4. Database transaction sets a **server-derived** tenant context (`SET LOCAL app.clinic_id`) and uses tenant-scoped SQL + RLS (e.g. `sql/tenancy_reference.sql`). For multi-branch constraints check branch relationship at application/database-owned local tables or validated reference snapshots.
5. In event consumers, validate event producer identity and clinic ownership; re-establish tenant context and consumer authorization. Do not trust arbitrary event-provided clinic_id without authenticating the producer.
6. On context switch, clear frontend/API caches, worklist, websocket subscriptions, stateful query keys and download tokens from previous clinic.

## Data access policy
| Actor | Permitted baseline | Explicitly denied by default |
|---|---|---|
| Platform operator | listing moderation/tenant support/operational settlement | direct clinical detail |
| Clinic owner/manager | clinic configuration and operational aggregates | individual medical chart absent clinical duty |
| Receptionist | minimum identity, appointment and queue admin fields | diagnosis, draft clinical content |
| Cashier | charge and payment-relevant fields | unneeded clinical note |
| Assigned doctor | encounter and relevant clinical record for assigned work | other clinic chart without authorized access |
| Nurse/lab | explicitly allocated observations/orders | blanket patient-record access |
| Patient/guardian | own or verified dependent released documents | draft/internal notes and another patient's records |

## Shared patient and cross-clinic continuity
- Patient portal aggregates released records by calling each *owner clinic* API, which separately authorizes the patient/guardian; never query a global clinical database.
- For clinician-to-clinician sharing between clinics, use explicit consent/legal basis, source clinic authorization, purpose, recipient, expiry, minimum dataset, immutable audit and an access grant. Until OD-06 is approved: **deny by default**.
- For same-clinic cross-branch access, clinic policy may permit a care team; branch assignment remains independently checked. No blanket access implied.

## PostgreSQL RLS as defense-in-depth
- Enable and FORCE RLS on each tenant-owned table, use non-owner application DB role with no `BYPASSRLS`; global tables have separate roles/policies.
- Fail closed when tenant GUC is absent. `USING` and `WITH CHECK` protect SELECT/UPDATE/DELETE and inserted/new rows; composite clinic-scoped foreign keys prevent references to another clinic's local rows.
- Pooled connections must use `BEGIN → SET LOCAL → commands → COMMIT/ROLLBACK` and never `SET` session-wide for tenant. Test connection reuse and rollback.
- RLS covers tenant equality, **not** professional assignment or a patient's right to view a particular chart; service policies still enforce those checks.
- Do not expose database credentials or let clients set tenant GUC. Parameterized queries, least-privileged roles and controlled migrations are mandatory. A custom GUC alone is not a cryptographic security boundary.
- Object keys/caches/search documents must contain validated tenant partition and never use an unscoped record ID as cache key.

## Mandatory adversarial tests
Cross-tenant GET/PUT by guessed UUID; staff with A+B membership changing active context; revoked grants with stale tokens; guardian revoke; branch scope; signed URL reuse; background job context missing; pooled-connection tenant leak; public index suspended clinic; platform admin attempting clinical API. Mapped to AT-004, 025–028, 034–036, 043, 047, 049.

**Reference:** OWASP Multi Tenant Security Cheat Sheet; PostgreSQL RLS docs linked in README.
