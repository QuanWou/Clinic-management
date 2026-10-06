# S3-01 — Assigned care and awaiting-results contract

Canonical branch prefix `B=/api/clinics/{clinicId}/branches/{branchId}`. Every care read/command checks current canonical IAM `DOCTOR_WORK` with role `DOCTOR`; worklist filters `doctor_user_id`, commands additionally verify visit assignment. Client role labels confer no access. Clinic/branch FORCE RLS remains active. Reasons are bounded to 500 characters and remain local.

| Owner | Endpoint | Input/output |
|---|---|---|
| Clinic | GET `/api/clinics/{clinicId}/care-directory` | Clinic name + active branches granted DOCTOR_WORK; no PHI or publication requirement |
| Encounter | GET `B/doctor/worklist` | This doctor's WAITING, IN_PROGRESS and AWAITING_RESULTS visits, including older encounters |
| Encounter | GET `B/doctor/service-points` | Active service points in the authorized branch |
| Encounter | POST `B/doctor/visits/{id}/start` | Idempotency-Key; expectedVersion, reason; requires called ticket for today's Vietnam date |
| Encounter | POST `B/doctor/visits/{id}/await-results` | Idempotency-Key; expectedVersion, reason; requires IN_PROGRESS and SERVING ticket |
| Encounter | POST `B/doctor/visits/{id}/resume-queue` | Idempotency-Key; expectedVersion, reason, servicePointId; requires AWAITING_RESULTS with no active ticket |

Start changes WAITING or AWAITING_RESULTS to IN_PROGRESS and CALLED to SERVING. Await-results changes IN_PROGRESS to AWAITING_RESULTS and the old serving ticket to DONE atomically, freeing the point. DONE refers to that ticket, not clinical completion. No check-in or appointment is created by care commands.

Resume-queue explicitly issues a fresh numbered WAITING ticket for the current Vietnam date, retains the same visit/check-in/appointment/doctor, and keeps AWAITING_RESULTS until reception calls and the assigned doctor starts. Reception call/skip/transfer supports this returning ticket with the existing queue order/version/point constraints. Resume does not bypass another patient or claim that a lab result was authenticated/reviewed. Medical-owned order/result/review validation remains S3-03.

Commands serialize on scoped actor/action/key then visit. V5 adds append-only care receipts with payload hashes, FORCE clinic+branch RLS and runtime SELECT/INSERT only. Matching replay returns the current visit without another effect; changed visit/body under the key conflicts. Authorization and assignment still apply on replay. A stale version, wrong branch/doctor, invalid point or invalid state rolls back all local effects. The legacy `B/visits/{id}/start` remains compatible and version-guarded; new UI uses the keyed doctor endpoint.

Awaiting encounters are not restricted to their initial day and no nightly auto-close exists. An old CALLED ticket cannot start care today; waiting results can return through a fresh day ticket. Existing IN_PROGRESS overnight care can explicitly wait for results. Completion/closure and recovery of ordinary overnight WAITING tickets remain future commands.

Outbox adds `clinic.encounter.awaiting_results.v1` and `clinic.encounter.return_queued.v1`, alongside existing `started.v1`. Payload contains only encounter/patient/actor references and status. Audit consumer binds canonical event type to permitted status, rejects extra fields/reason, deduplicates inbox and appends hash-chain atomically. There is no result-ready notification or medical-content event here.

UI at `/workspace?view=doctor` uses existing real login adapter, DOCTOR contexts, one clinic per Workspace and branch filter. Tokens/passwords/reasons are not persisted in browser storage. Retry persistence uses an opaque UUID/time under the existing payload digest. An uncertain response freezes original payload/key and exposes explicit retry plus server worklist refresh. A known 4xx clears stale worklist and requires reload. Successful ACK is preserved; scope change clears old worklist before reads. Browser reload recovers current assigned care from the server.

Boundaries: no clinical notes/orders/results/sign/release/payment/completion; no supervisor reassignment; no pagination for large worklists; no dedicated denied-care audit event yet. No A3 or AT-012/013/028 full acceptance claim. OD-05 remains OPEN for reviewed medical templates/signature.

Unsigned completion extension (2026-10-01): POST /doctor/visits/{id}/complete requires key, expectedVersion, medicalCaseVersion and bounded reason. Assigned canonical Doctor only; current SERVING visit and immutable VALIDATED Medical proof required. Proof fetch is outside the local write transaction. Complete retires the ticket, records CLINICALLY_COMPLETED and queues independent Appointment fulfillment plus Audit. Exact receipt replay works during later source outage. POST /doctor/visits/{id}/close requires key, expectedVersion and reason; CLINICALLY_COMPLETED→CLOSED is independent of money/signature/release. Medical reopen is unavailable; adding it requires a new seal protocol. Encounter V6/V7 and Appointment V9 were verified in completion-verification (130 selected tests/10 packages/30 UI/4 browser workflows).
