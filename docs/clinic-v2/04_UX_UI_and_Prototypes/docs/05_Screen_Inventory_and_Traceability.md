# CMV2 — Screen inventory, requirement mapping

| Screen / state | Requirement refs | Persona | Prototype route |
|---|---|---|---|
| Public home/search/list filters | FR-PUB-01, FR-ORG-07 | Guest | public.html#home, #search |
| Clinic detail/branch/doctor/service/price | FR-PUB-02/03 | Guest | #clinic |
| Slot/identity/review/confirm | FR-PUB-04/05, FR-SCH-02/04 | Guest | #book, #confirmation |
| My appointments/changes | FR-PUB-06 | Patient | #portal |
| Released docs/payment/dependents | FR-PUB-07/08, FR-IAM-07 | Patient | #portal |
| Manager dashboard/branch/staff/catalog | FR-ORG-03/04/05/06, FR-OPS-03 | Manager | workspace.html#overview, #manager |
| Clinic submission/review | FR-ORG-01/02/07 | Owner / Platform | #manager, #platform |
| Reception today, walk-in | FR-SCH-05/06, FR-IAM-05/06 | Receptionist | #reception, #walkin |
| Check-in, queue and exception | FR-SCH-07/08/09 | Receptionist | #reception, #queue |
| Assigned doctor worklist | FR-MED-01/02 | Doctor | #doctor |
| Clinical draft/orders/result/review/prescription/sign | FR-MED-03..10 | Doctor/Lab | #encounter |
| Charges/onsite partial/online verified/refund/close shift | FR-BIL-01..11 | Cashier | #billing |
| Empty/error/denied/partial status showcase | FR-OPS-03/04, FR-IAM-03 | All | #states |

**Not fully simulated:** real refunds/provider verification, guardian verification, prescriptions legally signed, real lab publication, staff permissions (requires backend). These appear as annotated views, not fake completions.

### Prototype handoff checklist
Component identifier → tokens → responsive behavior → interactive state → empty/error state → API owner → FR → acceptance test. Preserve identifiers (`appointment_code`, `patient_code`, `encounter_code`, `queue_ticket`) as distinct model fields. Review actual source and service contracts before translating into production components.
