# Task 07 — Frontend/API contract and acceptance log

Updated: 2026-09-20. Workspace: Clinic-management. Frontend branch: `local-coder/07-frontend-api-role-dashboard-a341ace4`. Frontend code compared read-only against Java controllers, DTOs and access checks in the uncommitted worktrees of Tasks 02–06 and the baseline Task 01 service. **The task backends are not merged into this branch or master; reading an endpoint's source is not evidence of a working deployed route.** No backend files, CSS or another agent's files have been modified; no merge or commit has been performed.

## Deployment safety and feature flags

API base: `VITE_API_BASE_URL` (default `http://localhost:8090`); all calls retain the real `/api/...` prefix. For each flag below, the default is `false`. Set one to `true` **only after** its corresponding task is merged, its services and gateway routes are running, the role contract is verified with actual credentials, and the applicable database migrations have passed. These environment settings are deployment assertions, not automatic probes or replacements for server-side authorization.

The Task 07 baseline gateway has **no** `/api/catalog/**` route; Task 02's unmerged gateway `application.yml` adds that route pointing to the catalog service (default port 8091). Do not enable `VITE_TASK02_API_READY` against the baseline gateway. A read-only check of `http://127.0.0.1:8090/actuator/health` on 2026-09-20 returned a connection error, so no live authenticated E2E or contract test was possible.

| Flag | Contract and capability gated |
|---|---|
| `VITE_TASK01_SECURITY_READY` | Verified appointment ownership and booking state changes for patient/doctor, receptionist confirm through existing Task 01 route |
| `VITE_TASK02_API_READY` | Admin doctor directory, active specialty/service/medicine catalogs, effective service price, doctor biography-only self-edit |
| `VITE_TASK03_API_READY` | Reception patient search/walk-in, staff booking/list/reschedule/cancel, check-in and queue |
| `VITE_TASK04_API_READY` | Treating doctor medical record search; no admin/reception medical content |
| `VITE_TASK05_API_READY` | Admin/reception cash receipt and transaction history; never online checkout |
| `VITE_TASK06_API_READY` | Personal notification inbox/read/preference APIs |

### Current screen-by-screen status

| Screen | Connected or prepared | Current blocker/default behavior |
|---|---|---|
| Login/session/navigation | Actual login/logout/`users/me` contracts. Access and refresh kept separate in browser storage; authenticated 401 clears tokens, 403 shows error without fallback. Primary role drives both sidebar and view access. | Requires running Identity service and role credentials for live verification. Not a proof of server JWT enforcement. |
| Patient dashboard | Real patient-only `/api/dashboard/me` arrays, accurate personal counts, empty/error/retry. No fake visitors, revenue, patient names or trends. | Staff dashboard APIs not available; admin/doctor/reception see explicit unavailable state, never call patient-only aggregation. |
| Patient appointments | GET own list. Create/cancel adapters use existing controller and validate form. | Create/cancel buttons disabled by default pending Task 01 booking integrity verification. Patient-accessible doctor directory does not exist; no invented doctor IDs are displayed. |
| Staff appointments and queue | Task 03 typed GET/POST/PATCH adapters and role-specific daily list, patient search/booking, reschedule, cancel, check-in and permitted queue transitions. Cashier staff cannot mark a visit IN_PROGRESS/COMPLETED. Staff confirm is additionally gated on Task 01. | Entire staff workflow unavailable by default until Task 03 is merged and verified; Task 01 must be verified for confirmation. Reception has no authorized doctor directory; only admin can use Task 02's `/doctors/admin` list. |
| Patients | Patient own GET/PUT profile and empty/error/retry. Admin/reception Task 03 search and walk-in registration prepared with actual DTO; no medical-record panel. | Staff search/registration requires Task 03. Doctor patient directory endpoint not available. |
| Doctors/profile | Doctor own GET; biography-only PUT body; admin-only real paginated doctor directory and list. Specialty/fee are read-only for doctors. | Edit and admin list gated on Task 02. No public or receptionist doctor list exists; do not call admin route with those roles. |
| Catalog | Active service/medicine/specialty lists and effective-date price use Task 02 DTOs; only Admin fetches admin doctor directory. Currency displayed only when supplied by price DTO. | Task 02 unmerged; catalog page unavailable by default. Task 04 prescription request still uses a free-text medicine name: do not claim catalog-verified prescriptions or offer an unsafe create button. |
| Medical records | Patient own records/prescriptions from authorized dashboard; doctor can search own treating records only after Task 04 verification. Empty/error/retry. | Admin/reception completely blocked by navigation and view guard. Doctor lookup disabled by default until Task 04 is verified; lab write/publish UI not implemented. |
| Invoices | Patient own list, admin/reception authorized lookup by patient ID; new statuses `REFUNDED` and `RECONCILIATION_REQUIRED`, audit fields, pricing revision, invoice currency and item snapshots shown where supplied. Prepared cash receipt + transaction history for cashiers with server-confirmed PAID/CASH, matching currency and receipt reference validation. | Cash controls hidden until Task 05 is merged/verified. No provider/online success UI. Latest Task 05 DTO includes `currency` and `items`, but baseline does not: missing currency stays explicitly unspecified, never guessed. The obsolete `/{id}/pay` path is deleted from the endpoint map and not called. |
| Notifications | Personal-only `/api/notifications/my`, mark-as-read and preferences use Task 06 typed DTOs. Empty/error/retry. | Inbox disabled until Task 06 is merged/verified; privileged global `/api/notifications` is never used as personal inbox. |
| Settings | Account info from `/api/users/me`; patient-only own profile GET/PUT. | Identity user-update API not verified, so account fields are read-only. |

## Endpoint inventory used by frontend

**Baseline routes (existing on Task 07 branch):** `POST /api/auth/login`, `POST /api/auth/register`, `POST /api/auth/logout`, `GET /api/users/me`, `GET|PUT /api/patients/profile`, `GET|PUT /api/doctors/profile`, `GET /api/dashboard/me` (patient only), `GET /api/appointments/my`, `POST /api/appointments`, `GET /api/appointments/{id}`, `PATCH /api/appointments/{id}/cancel|confirm|complete`, `GET /api/medical-records/my`, `GET /api/medical-records/patients/{patientId}`, `GET /api/invoices/my`, `GET /api/invoices/patients/{patientId}`. Mutation routes are additionally gated when their security contract is not yet verified.

**Task 02, gated:** `GET /api/doctors/admin?page=&size=` (ADMIN only), `GET /api/specialties`, `GET /api/catalog/services`, `GET /api/catalog/medicines`, `GET /api/catalog/services/{serviceId}/price?on=`. `PUT /api/doctors/profile` sends only `{biography}` with the Task 02 version.

**Task 03, gated:** `GET|POST /api/patients/reception` (`name`/`phone` GET query; POST walk-in DTO), `GET|POST /api/appointments/reception/bookings` (`date`,`doctorId` GET query, patient/doctor/time/reason POST), `PATCH /api/appointments/reception/{id}/reschedule`, `PATCH /api/appointments/reception/{id}/cancel`, `POST /api/appointments/reception/{appointmentId}/check-in`, `GET /api/appointments/reception/queue?date=&doctorId=`, `PATCH /api/appointments/reception/queue/{visitId}` (`{status}`). All require the backend's actual role and object scope checks.

**Task 04, gated for doctor:** `GET /api/medical-records/patients/{patientId}`. No administrative/reception record reads. Clinical record create and lab writes are not connected; do not substitute arbitrary medicine strings for verified catalog IDs.

**Task 05, gated for ADMIN/RECEPTIONIST:** `POST /api/invoices/{id}/cash-payment` with `{receiptReference}`, `GET /api/invoices/{id}/transactions`. Explicitly **NOT** used: legacy `PATCH /api/invoices/{id}/pay`, invented checkout URLs or client-calculated invoice totals. Latest InvoiceResponse includes `catalogRevision`, `currency`, `items` (per-service immutable unit/quantity/price/currency snapshots), `paidBy`, `refundedAt/by`, `cancelledAt/by`. Transaction responses also include `currency`. Baseline invoice responses may lack new fields until migration, so frontend renders missing fields honestly.

**Task 06, gated:** `GET /api/notifications/my`, `PATCH /api/notifications/{id}/read`, `GET /api/notifications/my/preferences`, `PUT /api/notifications/my/preferences/{type}` (`{enabled}`). Never use privileged global `GET /api/notifications` for personal inbox.

The Task 06 Java `NotificationResponse` marks `recipient` and `recipientUserId` with `@JsonIgnore`; these fields are **not included in the JSON response** and are deliberately absent from the frontend's public response type. The backend must authorize each result using its authenticated Identity UUID; the frontend must not infer recipients from displayed profile IDs.

## Verification and outstanding acceptance

Run from `frontend/`: `npm test` and `npm run build`. These are local unit/component/API-mock tests and TypeScript/Vite compilation only. Tests cover role isolation (including multi-role), 401/403, empty data, route/DTO matching, disabled unmerged workflows and absence of legacy payment use. They cannot establish a server-side authorization guarantee or end-to-end payment.

**Not verified:** merged cross-task deployment, real accounts and role-switch login session against backend, PostgreSQL migrations, real appointment race/ownership, an actual provider payment, user-scoped notification E2E, medical-record/queue ownership under live auth. Complete acceptance requires merging and running the correct Task 01–06 versions in a controlled integration environment, testing with actual authenticated accounts, verifying HTTP 401/403, performing an authorized cash receipt with a real test invoice, checking cross-user information isolation, and verifying the gateway routes. Do not label this task complete or imply E2E has passed based only on mock tests.
