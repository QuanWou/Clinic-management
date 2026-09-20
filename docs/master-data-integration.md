# Admin Master Data — Service Boundaries and Integration

## Ownership

| Data | Owning service / schema | External reference |
| --- | --- | --- |
| Users, roles, account state | identity-service / `identity` | `userId` UUID |
| Doctors, specialties, weekly schedules | doctor-service / `doctor` | `doctorId` / `specialtyId` UUID |
| Medical services, price history, medicine catalog | catalog-service / `catalog` | `serviceId`, `medicineId`, `priceId` UUID |
| Prescriptions and medical records | medical-record-service / `medical_record` | Medicine reference may be added by task 04 |
| Invoice amounts and payments | billing-service / `billing` | Price snapshot should be stored by task 05 |

Services MUST use authenticated HTTP API calls or events, never direct cross-schema SQL or foreign keys. `catalog-service` is registered with the existing gateway route `/api/catalog/**`, exposed internally on port 8091, and uses independent Flyway and `ddl-auto=validate`.

## Billing integration contract (task 05)

**Integration decision pending Task 05 acknowledgement:** `GET /api/pricing/appointments/{appointmentId}/quote` is an appointment-level billing orchestration endpoint, not an alias of catalog service pricing. Task 02 does not implement that quote route. See [Task 02 precise API and proposed quote contract](task-02-api-contract.md).

1. Appointment currently provides `appointmentId`, `doctorId`, patient, date and status but **no `serviceId`**. Task 05 must collect explicit billable service selections from the appropriate appointment/consultation workflow. Task 04 must provide explicit lab order/test IDs mapped to catalog `serviceId`, quantity and performed date. Do not infer a service ID from an appointment ID or reason.
2. Fetch `GET /api/catalog/services/{serviceId}` and ensure `active=true` before billing a newly selected service.
3. Fetch `GET /api/catalog/services/{serviceId}/price?on=YYYY-MM-DD`, using the billing event's explicitly agreed service date (not an unqualified current-day price for historical work).
4. Persist `PriceResponse.id` as `priceId`, alongside `serviceId`, amount, currency, quantity and description in immutable invoice-item snapshots. Do not dynamically recalculate already issued invoices after price changes. Fail closed if mapping/price is missing; do not invent zero prices.
5. Task 05 must own quote route, calculation, deduplication, currency consistency and invoice creation; doctor profile `consultationFee` must not silently replace catalog pricing. Consultation source-of-truth and quote response require Task 05 confirmation.

## Medical integration contract (task 04)

Use `GET /api/catalog/medicines/{medicineId}` and `GET /api/catalog/medicines` (active-only listing) to select drug master entries. The prescription must retain a textual snapshot (medicine name, unit, dosage/frequency) so historical medical records remain readable after catalog changes. Task 04 owns lab order/test mapping to explicit catalog service IDs for Billing. Medication pricing, prescribing rules, inventory, interaction checking and dosage validation are explicitly not implemented by the catalog.

## Security and migration coordination (task 01)

`identity-service` now issues explicitly typed `token_type=access`/`token_type=refresh` JWTs; Identity, Doctor and Catalog API filters require signed `access` type, unexpired JWT, canonical UUID subject and valid access claims. Identity additionally verifies account ACTIVE and current DB roles; Doctor and Catalog still rely on embedded roles and do not independently check current identity account status. Refresh/logout in Identity require a signed refresh token matching a live locked storage record and owner. Previously issued untyped JWTs require a new login. Read-only comparison with Task 01's shared-checkout diff confirmed the `access`/`refresh` literal convention and token-purpose methods, and appointment-service's filter checks `access`; the combined branches have NOT been merged or runtime-tested. Patient, Medical, Billing and Notification validators are owned by their respective tasks and must be audited for token-purpose rejection before end-to-end deployment. For immediate cross-service revocation, each service must validate current account state/roles or equivalent; refresh revocation alone does not invalidate access JWTs across services.

## Admin bootstrapping

The migration seeds role definitions only; no default admin password or publicly accessible admin creation endpoint is introduced. Initial admin provisioning must be handled by an explicit controlled environment-specific administrative procedure, not an unauthenticated production API.