# 05 — API contract architecture

`contracts/openapi.yaml` is a machine-parseable **representative baseline** for the high-risk P0 routes. It is not a claim of 100% endpoint coverage; each service will publish its own complete OpenAPI file before implementation.

## HTTP conventions
- `/api/v2/...`, JSON over TLS; UUID IDs; `timestamptz` ISO 8601 UTC, clinic/branch calendar day explicitly documented.
- Auth: bearer access token + session check; tenant context selected via `/api/v2/me/contexts` then supplied as `X-Clinic-Id`, `X-Branch-Id` to staff routes. These headers are **requests**, not authorization credentials; server validates active membership and resource owner on each action. Patient portal APIs resolve patient/guardian authorization server-side.
- `Idempotency-Key` mandatory for payment, booking confirmation, check-in, refund, order create and other retried effects; scope includes principal/tenant/endpoint/payload hash. Reusing key with different body returns `409 IDEMPOTENCY_CONFLICT`.
- Mutations affecting a versioned document/appointment accept `If-Match`/`row_version`, stale version returns `409 VERSION_CONFLICT` or `412` when explicitly using HTTP preconditions.
- Common error: `{ "error": { "code": "SLOT_UNAVAILABLE", "message": "...", "requestId": "...", "details": {} } }`; validation details never reveal another tenant's identifiers.
- `401` no identity; `403` actor forbidden within valid context; `404` for inaccessible/unknown object to avoid enumeration; `409` duplicate/conflict; `422` invalid workflow; `202` async acceptance; `503` dependent system unavailable (do not report success).
- Pagination via opaque `cursor`; filter/sort by whitelisted fields, least privilege fields in response. No clinical data in public endpoints.

## Endpoint inventory by owner (selected)
| Domain | Endpoint/action | Auth/notes |
|---|---|---|
| Identity | `GET /me/contexts`, `POST /sessions/logout`, `POST /memberships/{id}/revoke` | Contexts server-verified; revocation epoch |
| Clinic | `POST /clinics`, `POST /clinics/{id}/submit`, `POST /platform/clinics/{id}/approve`, `GET /public/clinics/{id}` | Publication status enforced |
| Patient | `POST /patients/walk-in`, `POST /patients/{id}/clinic-links`, `GET /me/records` | Matching is reviewable, not blind merge |
| Doctor | `GET /public/doctors`, `PUT /clinics/{id}/doctors/{doctorId}/schedule` | Affiliation/schedule authority |
| Catalog | `GET /public/clinics/{id}/offerings`, `POST /clinics/{id}/price-versions` | Frozen price snapshots |
| Appointment | `GET /public/availability`, `POST /appointments/holds`, `POST /appointments`, `POST /appointments/{id}/cancel`, `POST /appointments/{id}/reschedule` | Slot owner, idempotency |
| Encounter | `POST /visits/walk-in`, `POST /appointments/{id}/check-in`, `GET /visits/{id}`, `POST /queue/{id}/call` | One encounter/check-in, branch scope |
| Medical | `POST /visits/{id}/orders`, `POST /orders/{id}/results`, `POST /orders/{id}/reviews`, `POST /visits/{id}/documents/{id}/sign`, `POST /documents/{id}/release` | Assigned clinical roles and versions |
| Billing | `GET /bills/{id}`, `POST /payment-intents`, `POST /payments/onsite`, `POST /refunds`, `POST /webhooks/payments/{provider}` | Verify provider, merchant, amount and replay |
| Portal | `GET /me/appointments`, `GET /me/records/{id}/released-documents`, `GET /me/bills` | owner/guardian relationship per resource |

## Representative booking request
```http
POST /api/v2/appointments/holds
Authorization: Bearer <token>
Idempotency-Key: 0b6d...
Content-Type: application/json

{"clinicId":"uuid","branchId":"uuid","serviceId":"uuid","doctorId":"uuid","slotId":"uuid","patientId":"uuid"}
```
Response `201` with `holdId`, `expiresAt`, `priceSnapshot`, state `active`. A subsequent appointment confirmation consumes hold atomically. The hold does not guarantee money receipt; deposit policy can require `pending_payment` with bounded reservation TTL.

## Representative online payment request
`POST /api/v2/payment-intents` receives `billId`, `amountVnd` and `collectionMode` chosen from a server-validated clinic policy; never takes merchant secrets, beneficiary override or final amount from frontend. Response may be `202 pending`, with a safe redirect/provider token. Provider webhook drives verified ledger posting; online return only polls status.

## Request audit fields
`request_id`, `traceparent`, authenticated user, clinic, branch, operation, record IDs, decision, status, latency. Redact bearer token, raw medical content and provider secrets; avoid logging unmasked data.

## Contract governance
- Generate client types from OpenAPI, validate request/response in CI and run negative auth tests per endpoint.
- Service-to-service identity via workload credentials; no forwarding of staff token to arbitrary services. Use on-behalf-of context only through audited, scoped delegation.
- Breaking change requires v3 or versioned response/event with consumer adoption plan.
- Refer to PRD FR-IAM, FR-SCH, FR-MED, FR-BIL and AT-006/009/026/029/030.
