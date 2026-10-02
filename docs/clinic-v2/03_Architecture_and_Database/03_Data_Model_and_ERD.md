# 03 — Data model and ERD

## Modeling conventions
- `id UUID` is an internal stable identifier. `patient_code`, `appointment_code`, `visit_code`, `queue_number`, `bill_no` are clinic/branch-scoped *display codes*, never cross-service foreign keys.
- Foreign keys are valid **within one service-owned DB only**. A field ending `_id` pointing at another service is an external reference resolved via API/event + immutable context snapshot, **not** a database FK.
- Every clinic-owned record carries `clinic_id`; branch-specific records carry `branch_id`; timestamp of the event stored as `timestamptz` UTC; local calendar date computed from the branch zone `Asia/Ho_Chi_Minh` by default.
- `created_at`, `updated_at`, `created_by`, `row_version` used where relevant; immutable documents/ledger entries are append-only. Personal identifiers are not used as global primary keys.
- Refer to `diagrams/02_tenant_erd.mmd`, `03_scheduling_erd.mmd`, `04_clinical_erd.mmd`, and `05_billing_erd.mmd`.

## Logical entity catalog
| DB owner | Entity | Primary relationships/constraints |
|---|---|---|
| Identity | user, session, membership, membership_branch_grant | membership references user; `(user,clinic,role)` uniqueness according to active policy; version increments on revoke |
| Clinic | clinic, branch, clinic_license, publication, onboarding_review | branch FK `(clinic_id)` local; evidence encrypted/private; publication status explicit |
| Patient | patient_identity, platform_user_patient_link, clinic_patient_link, guardian_grant | no automatic merge by phone; clinic link `(clinic_id,patient_id)` verified; guardian expiry/revoke |
| Doctor | practitioner, doctor_affiliation, working_schedule, absence | `(doctor,clinic,branch)` relationship and non-overlapping effective scope; schedule has timezone |
| Catalog | offering, branch_offering, price_version | time-versioned VND integer price, no retroactive mutation of consumed snapshot |
| Appointment | capacity_slot, slot_reservation, appointment, appointment_history | atomic occupancy; reservation states; appointment optional booking deposit reference |
| Encounter | visit, check_in, queue_ticket, care_assignment, visit_history | `appointment_id` nullable external reference; unique active check-in/queue for visit; queue unique per branch/date/desk |
| Medical | clinical_document, document_version, clinical_order, clinical_result, review, prescription, medication_line, document_release | all linked to encounter UUID+clinic/branch; signed revision immutable, addendum references original |
| Billing | charge, bill, bill_line, payment_intent, payment, payment_allocation, refund, journal_entry, journal_line, settlement, reconciliation | charge unique per source key; `amount_vnd BIGINT` nonnegative; payment unique provider event/ref; journal balanced, immutable |
| Notification | notification_request, delivery_attempt, preference | channel-specific delivery, dedup key and no PHI in payload |
| Audit | audit_event | append-only actor, action, object, outcome, tenant, correlation ID; access policy |
| Search | public_clinic_projection, public_doctor_projection, public_slot_hint | approved public fields only, `source_version` and `indexed_at`, no PHI |

## Cross-service identity/reference contract
- Encounter stores `patient_id` external Patient ref + `clinic_patient_link_id` validated; appointment ID nullable; doctor assignment is captured as both doctor ref and assignment snapshot.
- Medical stores `encounter_id` external ref plus clinic/branch snapshot, validates owner and patient at creation. It does not reference Appointment directly for authorization.
- Billing charge `source_type, source_id, source_version` uniquely identifies the billable event, with service origin authenticated. A charge may be attributed to a clinic/branch/encounter/order/appointment depending on source.
- Price version is owned by Catalog; Appointment/Billing copy amount, currency, tax/discount policy, effective time and source version for audit. Subsequent price changes cannot change historical charges.
- Use service-produced validated references and idempotent consumer upserts. **No cross-DB FK** and no direct select against another service's tables.

## Physical DB plan
At P0: one PostgreSQL cluster is permissible, but provision **separate logical databases and runtime credentials per service**; backup/restore boundaries, access grants and migrations documented separately. For local development, separate schemas can simulate ownership but must not become a cross-service join API. Patient identity and public projection have explicit global access policies; they are not placed under arbitrary clinic RLS.

## Medical content storage
Document metadata/structured clinical content under Medical; attachments in private encrypted object storage, by clinic/patient/encounter/version, with content hash, MIME whitelist, malware scanning, retention classification, and authorized short-lived URL issuance. Stored signatures must retain identity, signing event, record hash, method/evidence and verification chain; exact legal/e-sign mechanism OD-05 remains OPEN.

## Indexing / constraints to test
- `unique (clinic_id, branch_id, local_date, queue_number)`.
- Only one active check-in and active queue entry per encounter; use a partial unique index with explicit active states.
- `unique (clinic_id, source_type, source_id, source_version)` for charge ingestion.
- `unique (provider, merchant_id, provider_event_id)` for authenticated webhook receipt and `unique (clinic_id, idempotency_key, operation)` for API commands.
- Slot capacity updated under row lock/conditional update in single Appointment DB transaction; unique reservation/appointment linkage and active count invariants.
- Deferred journal balance checking at commit; never mutate posted journal lines. See SQL reference examples.
