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

## Billing integration contract (integrated)

The integration branch does not invent an appointment quote or infer a catalog item from a doctor, reason, or appointment ID.

1. Appointment owns the explicit performed-service list at `/api/appointments/{appointmentId}/performed-services`. A treating doctor, receptionist, or admin may edit it until a completed appointment is finalized. Finalization creates an immutable revision; billing staff can read it.
2. Medical Record owns lab orders. Every new lab order carries an explicit catalog `serviceId` and `performedOn`. `/api/medical-records/appointments/{appointmentId}/billable-items/finalize` freezes only released, catalog-linked orders; an empty finalized list is valid when no lab work was ordered.
3. Billing reads both finalized contracts and fetches `GET /api/catalog/services/{serviceId}/price?on=YYYY-MM-DD` for each item. Missing mappings, missing prices, future dates, pending orders, duplicate source IDs, invalid currency, or changed revisions all fail closed.
4. Billing persists `priceId`, `serviceId`, amount, currency, quantity, description, service date, source ID, and both upstream revisions as immutable invoice snapshots. Historical invoices are never dynamically recalculated after catalog changes.
5. Doctor profile `consultationFee` is not used as a pricing fallback. The catalog price history remains the only monetary source for new invoice items.

## Medical integration contract (task 04)

Use `GET /api/catalog/medicines/{medicineId}` and `GET /api/catalog/medicines` (active-only listing) to select drug master entries. The prescription must retain a textual snapshot (medicine name, unit, dosage/frequency) so historical medical records remain readable after catalog changes. Task 04 owns lab order/test mapping to explicit catalog service IDs for Billing. Medication pricing, prescribing rules, inventory, interaction checking and dosage validation are explicitly not implemented by the catalog.

## Security and migration coordination (task 01)

`identity-service` now issues explicitly typed `token_type=access`/`token_type=refresh` JWTs; Identity, Doctor and Catalog API filters require signed `access` type, unexpired JWT, canonical UUID subject and valid access claims. Identity additionally verifies account ACTIVE and current DB roles; Doctor and Catalog still rely on embedded roles and do not independently check current identity account status. Refresh/logout in Identity require a signed refresh token matching a live locked storage record and owner. Previously issued untyped JWTs require a new login. Read-only comparison with Task 01's shared-checkout diff confirmed the `access`/`refresh` literal convention and token-purpose methods, and appointment-service's filter checks `access`; the combined branches have NOT been merged or runtime-tested. Patient, Medical, Billing and Notification validators are owned by their respective tasks and must be audited for token-purpose rejection before end-to-end deployment. For immediate cross-service revocation, each service must validate current account state/roles or equivalent; refresh revocation alone does not invalidate access JWTs across services.

## Admin bootstrapping

The migration seeds role definitions only; no default admin password or publicly accessible admin creation endpoint is introduced. Initial admin provisioning must be handled by an explicit controlled environment-specific administrative procedure, not an unauthenticated production API.
