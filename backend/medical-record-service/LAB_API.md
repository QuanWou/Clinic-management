# Medical record and laboratory API (current `/api` routes)

This service owns both `medical_record.medical_records` and `medical_record.lab_orders` in the
**same PostgreSQL schema**. Lab orders cannot refer to another service's database tables.
All endpoints require a valid JWT and return `ApiResponse<T>` or `ErrorResponse`.
Use the existing gateway route `/api/medical-records/**` to reach these endpoints;
there is no independent laboratory deployment or new gateway route.

## Clinical record access

- `POST /api/medical-records`: only the doctor assigned to the **COMPLETED** appointment can
  create its record. The appointment service supplies patient and doctor IDs; the request
  must not supply either identity. One medical record per appointment (unique DB constraint).
- `GET /api/medical-records/my`: patient reads only their own records.
- `GET /api/medical-records/patients/{patientId}`: doctor reads only records they authored
  for that patient; other roles receive HTTP 403.
- `GET /api/medical-records/{id}`: only the treating doctor or the owning patient.
  Admin and receptionist permissions alone do **not** authorize access to clinical contents.
- Role assertions use Identity-issued `ROLE_DOCTOR`, `ROLE_PATIENT`, `ROLE_ADMIN`,
  `ROLE_RECEPTIONIST` authorities. Refresh tokens without role/email claims do not
  authenticate any medical endpoint.
- Existing prescription line items accept medicine names, dosages, frequency and duration.
  Medicine catalog IDs/validation will be integrated once task 02 establishes its API contract.

## Laboratory endpoints

`recordId` is a UUID returned by creating a medical record; `orderId` is returned by creating
an order. All write operations require the doctor linked to that record, validated using
the doctor service's current authenticated profile, not a caller-provided doctor ID.

| Method | Route | Body | Expected current state | New state |
| --- | --- | --- | --- | --- |
| POST | `/api/medical-records/{recordId}/lab-orders` | `{"testCode":"CBC","testName":"Complete blood count"}` | Record exists | `ORDERED` |
| PATCH | `/api/medical-records/lab-orders/{orderId}/sample` | `{"sampleIdentifier":"S001"}` | `ORDERED` | `COLLECTED` |
| PATCH | `/api/medical-records/lab-orders/{orderId}/processing` | none | `COLLECTED` | `PROCESSING` |
| PATCH | `/api/medical-records/lab-orders/{orderId}/result` | `{"value":"5.2","unit":"g/L","referenceRange":"4–6"}` | `PROCESSING` | `RESULTED` |
| PATCH | `/api/medical-records/lab-orders/{orderId}/release` | none | `RESULTED` | `RELEASED` |

`GET /api/medical-records/{recordId}/lab-orders` lists orders. The treating doctor sees all
states; the owning patient sees **only RELEASED** results. `GET
/api/medical-records/lab-orders/{orderId}` returns details to the treating doctor or,
once released, the owning patient. Other patients and unrelated doctors receive HTTP 403.

Result release is deliberately separate from result entry. Results are immutable once released.
Invalid state transitions and duplicate sample identifiers return HTTP 409. Invalid DTOs
return HTTP 400. A row version prevents conflicting concurrent status changes; the
database enforces sample uniqueness and valid result/release states.

An append-only `medical_audit_events` table stores actor UUID, action, resource UUID and
timestamp for clinical record and lab-result reads/writes. It does not store clinical details,
JWTs or patient names. Failed audit insertion fails the read/write rather than silently
returning unlogged sensitive information.

## Integration boundaries and remaining dependencies

1. **Task 02 / medicine catalog**: agree a service API for resolving active medicine IDs.
   Until then the existing free-text prescription model is unchanged and catalog validation
   must not be claimed as implemented.
2. **Task 03 / visit lifecycle**: record creation still requires `COMPLETED` appointments,
   matching the existing appointment contract. Earlier lab ordering during check-in needs
   coordination with visit lifecycle; it is not supported by this contract yet.
3. **Task 05 / billing**: test code and order ID are available for pricing/invoicing.
   No billing call or invoice creation is performed by the laboratory workflow yet.
4. Laboratory mutations currently require the treating **DOCTOR** role, because no
   separately authorized lab-technician identity/assignment API exists yet.

### Integration status: verified versus outstanding

- Task 02 has confirmed the routes `GET /api/catalog/medicines/{medicineId}` and
  `GET /api/catalog/services/{serviceId}` plus the historical price lookup
  `GET /api/catalog/services/{serviceId}/price?on=YYYY-MM-DD` (price revision UUID
  in `data.id`). The exact medicine/service DTO, active-state semantics and
  permission/error contract are **not yet confirmed in this worktree**. Therefore
  prescription `medicine_name` and lab `test_code` remain local snapshots/free text,
  **not catalog-verified**; no catalog HTTP client or service-ID-based lab pricing
  is claimed to work. New lab orders cannot be represented as catalog-priced items
  until Task 04 persists a verified `serviceId` and exposes a performed date.
- Task 03 confirmed a visit flow WAITING -> CALLED -> IN_PROGRESS -> COMPLETED,
  with the appointment marked CONFIRMED on check-in. Medical records remain gated
  on appointment COMPLETED and the assigned doctor as supplied by the appointment
  and doctor APIs. Live IN_PROGRESS clinical drafts are not supported.
- Task 05 must resolve service-ID-based pricing, invoice item idempotency and the
  race between a newly created lab order and invoice finalization. No late-order
  policy is in force; no billing mutation is performed in this service.
- Task 06: releasing a result writes a single `LAB_RESULT_READY` outbox row in
  the same local transaction as the lab status change and mutation audit.
  The event contract is `{eventId,eventType,orderId,appointmentId,occurredAt}`:
  no patient identity, result value, diagnosis, specimen identifier or contact details.
  `lab_order_id` is unique in the outbox. No external message is published yet:
  a post-commit publisher, routing key, consumer and recipient lookup must be
  coordinated with Task 06. An unsent outbox row is **not** a sent notification.

### Billing read contract for task 05

`GET /api/medical-records/appointments/{appointmentId}/billable-items` accepts an authenticated
`ADMIN` or `RECEPTIONIST` token and returns `{"appointmentId":"...","items":[{"orderId":"...",
"testCode":"CBC","quantity":1,"status":"RELEASED","billableAt":"..."}]}` inside the standard
`ApiResponse` wrapper. A completed visit with no medical record returns an empty item list.
The endpoint includes **pending orders** (with null `billableAt`) so Billing can fail closed
when charges remain unfinalized. Only `RELEASED` orders are billable; billing must look up
unit prices from its trusted catalog and avoid charging the same order twice. This API
never returns result values, sample IDs, names or patient/doctor IDs. Invoicing policy
for lab orders added *after* an invoice still requires coordination with task 05.

Run `mvn -pl medical-record-service -am test` from `backend/`. Unit and HTTP controller
tests do not need PostgreSQL. An end-to-end database/Flyway integration test requires an
available PostgreSQL service; running only Maven tests does not verify database migration.