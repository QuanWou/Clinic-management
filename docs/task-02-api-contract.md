# Task 02 API contract — Admin, Doctor profile, Catalog, integration

Status: **implemented in the Task 02 worktree** unless explicitly marked **PROPOSED / NOT IMPLEMENTED** below. API base is `/api`, NOT `/api/v1`. Through the existing gateway use port `8090`; direct identity, doctor, catalog ports are `8083`, `8085`, `8091` respectively. All endpoints use JSON. UUIDs below are illustrative IDs; amounts are documentation examples, **not official clinical prices, test seed data, or billing defaults**.

## Common authentication and envelopes

Send `Authorization: Bearer <access-token>` for all endpoints below. `ROLE_ADMIN` is required for `/admin` routes. Catalog GET reads accept an authenticated user of any role, and doctor self-profile requires `ROLE_DOCTOR`. A clinician's `ROLE_DOCTOR` **does not grant** management privileges.

Success (HTTP 200 for currently implemented controllers, including POST):

```json
{"success":true,"message":"Success","data":{},"timestamp":"2026-09-20T00:00:00Z"}
```

Failure:

```json
{"success":false,"errorCode":"CONFLICT","message":"Price period overlaps an existing or future price","timestamp":"2026-09-20T00:00:00Z"}
```

Implemented error mapping: `400 VALIDATION_ERROR`, `403 FORBIDDEN` for insufficient role (catalog also currently responds 403 to anonymous requests), `404 RESOURCE_NOT_FOUND`, `409 CONFLICT`, `500 INTERNAL_SERVER_ERROR`. Identity now returns HTTP `401` for anonymous/invalid Bearer tokens and for rejected refresh/logout tokens; other services' security entry points still require cross-task verification. Database connection/migration exceptions may return 500. Never treat a 500 as a quote or retry a payment blindly.

### P0 token-purpose separation — IMPLEMENTED IN TASK 02; CROSS-TASK DEPLOYMENT NOT VERIFIED

- Identity issues signed JWT access tokens with `sub` = canonical account UUID, `token_type: "access"`, `email`, nonempty `roles` list of `ROLE_*`, `iat`, `exp` and a unique `jti`; refresh tokens contain `sub`, `token_type: "refresh"`, `iat`, `exp` and unique `jti` but are NOT API Bearer credentials. **The API filters in all three Task 02 services (Identity, Doctor and Catalog) now require `token_type=access`, signed/unexpired JWT and valid subject/access claims.** Identity also checks the account's ACTIVE status and roles from its database; Doctor/Catalog do not yet independently introspect live account status and still require cross-service revocation coordination. Identity refuses missing/wrong type, malformed UUID subject, missing/expired `exp`, invalid `iat`, missing access claims or bad signature before loading DB roles.
- `POST /api/auth/refresh` and `POST /api/auth/logout` are the **only** consumers of refresh tokens: JSON body `{"refreshToken":"<signed-refresh-jwt>"}`. Both require the signed refresh type, unexpired JWT and storage record, stored-token UUID owner matching `sub`, nonrevoked state, unexpired storage timestamp and active owner. The refresh row is pessimistically locked; successful refresh revokes the old record and issues a distinct replacement. Invalid/replayed tokens return `401`, not replacement credentials.
- **Breaking change:** previously minted JWTs lack `token_type` and will no longer work in the Task 02 services; clients must sign in again. When deploying with Task 01, deploy all consumer validators consistently and do not assume old access or refresh tokens retain backward compatibility. Real-filter regression tests in Identity `JwtPurposeFilterIntegrationTest`, Doctor `DoctorJwtPurposeIntegrationTest` and Catalog `CatalogAdminSecurityTest` verify refresh-as-Bearer denial, valid access, and legacy-token denial; Identity also tests access-as-refresh/logout denial, malformed/missing claims, locked account and refresh ownership/replay. Database-backed migration/E2E across Task 01 worktree and Task 02 worktree remains unverified; a read-only diff comparison confirmed both use the literal values `access` / `refresh` but no branches were merged. Patient, Medical, Billing and Notification are owned by other tasks and their validators require separate review.

## 1. Identity: account administration — IMPLEMENTED

| Method and endpoint | JSON input | `data` response | Relevant errors |
| --- | --- | --- | --- |
| `GET /api/users/admin?page=0&size=20` | Query, `size` maximum 100 | Spring Data page of `AdminUserResponse` | 403, 400 |
| `GET /api/users/admin/{userId}` | UUID path | `AdminUserResponse` | 403, 404 |
| `POST /api/users/admin` | `CreateAdminUserRequest` | Created `AdminUserResponse` | 400, 403, 409 (email) |
| `PUT /api/users/admin/{userId}` | `UpdateAdminUserRequest` | Updated `AdminUserResponse` | 400, 403, 404, 409 |
| `PATCH /api/users/admin/{userId}/status` | `UpdateUserStatusRequest` | Updated `AdminUserResponse` | 400, 403, 404, 409 (self/last Admin) |
| `PUT /api/users/admin/{userId}/roles` | `UpdateUserRolesRequest` | Updated `AdminUserResponse` | 400, 403, 404, 409 |
| `POST /api/users/admin/{userId}/roles/{role}` | No body | Updated `AdminUserResponse` | 403, 404, 409 |
| `DELETE /api/users/admin/{userId}/roles/{role}` | No body | Updated `AdminUserResponse` | 403, 404, 409 |

Allowed role literals: `ROLE_ADMIN`, `ROLE_DOCTOR`, `ROLE_RECEPTIONIST`, `ROLE_PATIENT`. Status literals: `ACTIVE`, `INACTIVE`, `LOCKED`.

Example create request:

```json
{"email":"doctor@example.test","password":"example-only-password","fullName":"Example Doctor","phone":"0123456789","roles":["ROLE_DOCTOR"]}
```

Example role replacement: `{"roles":["ROLE_DOCTOR","ROLE_PATIENT"]}`. Example status update: `{"status":"LOCKED"}`. Account update body: `{"email":"doctor@example.test","fullName":"Updated Doctor","phone":"0123456789"}`. Response `data`:

```json
{"id":"00000000-0000-0000-0000-000000000011","email":"doctor@example.test","fullName":"Example Doctor","phone":"0123456789","status":"ACTIVE","roles":["ROLE_DOCTOR"],"createdAt":"2026-09-20T00:00:00","updatedAt":"2026-09-20T00:00:00"}
```

An administrator cannot deactivate/lock themselves or remove their own Admin role. The last active Admin cannot be deactivated or demoted; the shared Admin-role row lock serializes the last-Admin check when changing distinct Admin accounts. Status/role/profile changes revoke stored refresh tokens and write audit (`actor_user_id`, `target_user_id`, action, before/after, time). Identity checks account status and roles from its database on requests. **Other JWT-consuming services can still accept an already-issued access token with stale claims until expiry**; immediate cross-service revocation requires Task 01 changes and is NOT implemented here. Do not put passwords or token values in audit entries.

## 2. Doctor self-service — IMPLEMENTED, BREAKING REQUEST CHANGE

| Method and endpoint | Access | Request | Response | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/doctors/profile` | `ROLE_DOCTOR` | None | `DoctorProfileResponse` | 403, 404 |
| `PUT /api/doctors/profile` | `ROLE_DOCTOR` | `UpdateDoctorProfileRequest` | `DoctorProfileResponse` | 400, 403, 404 |

Only permitted self-service request:

```json
{"biography":"Specialist in cardiology"}
```

`biography` is optional/nullable, maximum 10,000 characters. Any unknown key, including `specialtyId`, `consultationFee`, `active` and `userId`, returns HTTP 400. Self-service cannot create a missing doctor profile (404); Admin must first create it. `GET` and successful `PUT` return the same read-only details:

```json
{"id":"00000000-0000-0000-0000-000000000021","userId":"00000000-0000-0000-0000-000000000011","specialtyId":"00000000-0000-0000-0000-000000000031","specialtyName":"Cardiology","biography":"Specialist in cardiology","consultationFee":350000.00}
```

Only `ROLE_ADMIN` may use `POST /api/doctors/admin` (`{userId,specialtyId,biography,consultationFee}`), `PUT /api/doctors/admin/{doctorId}` (`{specialtyId,biography,consultationFee,active}`), and `DELETE /api/doctors/admin/{doctorId}` (deactivate, do not hard-delete). Admin doctor reads: `GET /api/doctors/admin`, `GET /api/doctors/admin/{doctorId}`; weekly schedules: `GET|POST /api/doctors/admin/{doctorId}/schedules`, `PUT|DELETE /api/doctors/admin/{doctorId}/schedules/{scheduleId}`. Specialty reads: `GET /api/specialties`, `GET /api/specialties/{id}`; Admin writes: `POST /api/specialties/admin`, `PUT|DELETE /api/specialties/admin/{id}`. All these admin routes return 403 for non-admin; missing ID returns 404; invalid inputs 400; conflicts (duplicates, linked specialty, overlapping schedules) 409. `POST /api/doctors/admin` requires an ACTIVE identity user with `ROLE_DOCTOR`; Identity must be reachable.

## 3. Catalog service and medicines — IMPLEMENTED

| Method and endpoint | Access | Request | `data` | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/catalog/services` | Authenticated | None | Array of **active** services only | 403 |
| `GET /api/catalog/medicines` | Authenticated | None | Array of **active** medicines only | 403 |
| `GET /api/catalog/services/{serviceId}` | Authenticated | UUID | Single service including inactive historical entry | 403, 404 |
| `GET /api/catalog/medicines/{medicineId}` | Authenticated | UUID | Single medicine including inactive historical entry | 403, 404 |
| `GET /api/catalog/admin/services` | `ROLE_ADMIN` | None | All services, including inactive | 403 |
| `GET /api/catalog/admin/medicines` | `ROLE_ADMIN` | None | All medicines, including inactive | 403 |
| `POST|PUT /api/catalog/admin/services[/{serviceId}]` | `ROLE_ADMIN` | `{code,name,description,active}` | Service | 400, 403, 404, 409 |
| `DELETE /api/catalog/admin/services/{serviceId}` | `ROLE_ADMIN` | None | Deactivated service | 403, 404 |
| `POST|PUT /api/catalog/admin/medicines[/{medicineId}]` | `ROLE_ADMIN` | `{code,name,unit,description,active}` | Medicine | 400, 403, 404, 409 |
| `DELETE /api/catalog/admin/medicines/{medicineId}` | `ROLE_ADMIN` | None | Deactivated medicine | 403, 404 |

Example service request: `{"code":"EXAM_CARDIO","name":"Example consultation","description":"Example only","active":true}`. Example service `data`: `{"id":"00000000-0000-0000-0000-000000000041","code":"EXAM_CARDIO","name":"Example consultation","description":"Example only","active":true}`.

Example medicine request: `{"code":"MED_DEMO","name":"Illustrative medicine","unit":"tablet","description":null,"active":true}`. Medicine response adds `id` and preserves `unit` and `active`. `code` is unique (normalized uppercase); allowed characters are ASCII letters/digits, `_`, `-`, length 1–60. Names max 255; unit max 50; descriptions max 1000. A DELETE is soft-deactivation, NOT a database delete. Admin list endpoints expose inactive records for correction/reactivation. No medicine pricing, drug-dosing, inventory, or clinical suitability API exists here.

## 4. Dated catalog prices — IMPLEMENTED

| Method and endpoint | Access | Input | `data` | Errors |
| --- | --- | --- | --- | --- |
| `GET /api/catalog/services/{serviceId}/prices` | Authenticated | UUID | Price history, newest effective date first | 403, 404 |
| `GET /api/catalog/services/{serviceId}/price?on=YYYY-MM-DD` | Authenticated | UUID and optional ISO date | One dated `PriceResponse` | 400 (bad date), 403, 404 (service/price) |
| `POST /api/catalog/admin/services/{serviceId}/prices` | `ROLE_ADMIN` | `PublishPriceRequest` | New `PriceResponse` | 400, 403, 404, 409, 500 (database/extension failure) |

The optional `on` date defaults to the catalog server's current local date. **Billing MUST supply the explicitly agreed service date**, not use the default for historical invoices. Both start and end boundaries are ISO `YYYY-MM-DD`; the valid interval is `[effectiveFrom, effectiveUntil)`; `effectiveUntil: null` means indefinite.

Example publish request:

```json
{"amount":150000.00,"currency":"VND","effectiveFrom":"2026-10-01","effectiveUntil":null}
```

Example response `data`:

```json
{"id":"00000000-0000-0000-0000-000000000051","serviceId":"00000000-0000-0000-0000-000000000041","amount":150000.00,"currency":"VND","effectiveFrom":"2026-10-01","effectiveUntil":null}
```

**`PriceResponse.id` is the stable `priceId` / version identifier.** Each publication creates a new UUID; no separate numeric revision is implemented. The amount, currency, service reference and start date of an existing price are not rewritten by the publish API; publishing a later price closes a prior **open-ended** period at the new start date. Overlap with finite or future periods returns 409. Exactly adjacent periods are allowed. Database migration `catalog/V2__price_period_guards.sql` adds a GiST exclusion constraint for concurrent or non-API writes; it requires PostgreSQL `btree_gist`. The migration is authored but has NOT been applied/tested on a real PostgreSQL instance in this worktree.

Validation: nonnegative amount, up to 10 integer digits and 2 decimal places (`NUMERIC(12,2)`), uppercase recognized ISO 4217 currency code with valid fraction metadata, non-null start, end strictly after start if present, active catalog service when publishing. Status of the catalog entry is **not** silently used to rewrite historical dated prices; consumers must separately enforce `service.active` for new billable selections. A zero price is permitted as an explicit Admin decision, NEVER a fallback when pricing data is missing. Invoice items must retain a snapshot of the `priceId`, amount, currency and description; do not recalculate historical invoices against a new price version.

## 5. Appointment quote — PROPOSED CONTRACT; NOT IMPLEMENTED BY TASK 02

Billing currently expects `GET /api/pricing/appointments/{appointmentId}/quote`. **This route is not provided by catalog-service and is not wired to `/api/catalog/**`.** A `serviceId` price response is not an appointment quote. Task 05 owns the quote endpoint, authentication/authorization, aggregation and invoice snapshots; final schema below is **proposed pending explicit Task 05 agreement**.

Proposed request: `GET /api/pricing/appointments/00000000-0000-0000-0000-000000000061/quote` with authorized Bearer access token, no body. Illustrative proposed `data`:

```json
{
  "appointmentId":"00000000-0000-0000-0000-000000000061",
  "currency":"VND",
  "items":[{
    "sourceType":"APPOINTMENT_SERVICE",
    "sourceId":"00000000-0000-0000-0000-000000000061",
    "serviceId":"00000000-0000-0000-0000-000000000041",
    "priceId":"00000000-0000-0000-0000-000000000051",
    "effectiveDate":"2026-10-01",
    "description":"Example consultation",
    "quantity":1,
    "unitAmount":150000.00,
    "lineTotal":150000.00
  }],
  "totalAmount":150000.00
}
```

Example monetary numbers here are **contract illustrations only**. The quote cannot return synthetic/default prices when no mapping or effective price exists. Proposed errors: unauthorized 401/403 per agreed security entry point, 404 nonexistent/inaccessible appointment or no effective price, 409 missing billable mapping, inactive new selection or mixed currencies, 400 invalid user request; downstream unavailability must fail closed, never bill zero. Task 05 must specify whether quotes are persisted, expire, require idempotency, and how consumer permissions work before this proposed contract becomes official.

**Source ownership and mapping (unimplemented dependency):**

1. `appointment-service` owns the appointment's identity, patient, doctor, date and status. Its current `AppointmentResponse` does **not** carry a catalog `serviceId`. Neither `appointmentId` nor `doctorId` determines a catalog service by itself. Appointment booking/service selection or a configured mapping must explicitly provide `serviceId`; responsible team/endpoint requires confirmation with Task 05 and appointment owner.
2. Task 04 `medical-record-service` / laboratory domain owns the ordered/performed lab tests and must expose explicit catalog `serviceId`, quantity and clinical service date for each billable test. No lab-item contract is implemented in this Task 02 worktree.
3. Task 05 Billing must authorize appointment access, fetch those structured sources, deduplicate line items, select billable types, pass each explicit `serviceId` + date to the catalog price API, reject missing mappings/prices, check currency consistency, compute totals, and persist immutable snapshots. **Catalog must never infer item type or serviceId from appointmentId.**
4. Doctor profile's `consultationFee` is a separate Admin-managed value, NOT automatically a catalog price or a valid quote substitute. Task 05 must choose and enforce one authoritative pricing source for consultations and document any mapping/synchronization; until then cross-service consultation quote acceptance is blocked.
5. Catalog medicines currently have no price API; medicine charges need a separately designed price source, not arbitrary catalog service lookup.

## 6. Integration, migration, frontend changes

- Task 04: use active medicine list for new prescription selection and lookup by ID for historical snapshots (name, unit, prescribed dose/frequency). Task 05: consume dated catalog prices only for explicit service IDs, retain price version. Do not query `catalog` tables from other services.
- Task 01: cross-service JWT revocation and access/refresh separation must be verified before production; refresh revocation in Identity alone does not invalidate JWT role claims held by other services.
- Frontend **breaking request change**: remove `specialtyId` and `consultationFee` from `PUT /api/doctors/profile`; they now get HTTP 400. Update them exclusively through Admin doctor endpoints. Doctor read response retains these fields as read-only. Catalog public lists now exclude inactive entries; Admin UI must use `/api/catalog/admin/services` and `/api/catalog/admin/medicines` to display/manage inactive entries. Catalog `price.id` should be saved as `priceId` in Billing's snapshot, not mistaken for an `appointmentId`.
- Prior to rollout: validate catalog V1+V2 Flyway on isolated PostgreSQL with `btree_gist` available, check existing price overlaps and migration permissions; verify HTTP E2E, authorize calls across services and bootstrap an initial Admin using a controlled procedure. Do not run migrations against a shared live database as part of this task.