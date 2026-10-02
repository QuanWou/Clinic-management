# S3 Medical runtime contract — unsigned scope

Base: `/api/v2/clinics/{clinicId}/branches/{branchId}`, Medical service 8102. Validated V2 user session and canonical branch IAM required on every request. Doctor operations require actual DOCTOR role and source Encounter assignment; LAB operations require actual LAB role. Legacy role names and Owner membership do not grant clinical access.

| Endpoint | Input / behavior |
|---|---|
| GET /visits/{id}/draft | Assigned Doctor; latest note and document/case versions |
| PUT /visits/{id}/draft | Idempotency-Key, expectedDocumentVersion, bounded note, reason; append-only version |
| GET/POST /visits/{id}/orders | Assigned Doctor; POST expectedCaseVersion, offeringId, reason; private Catalog snapshot |
| GET /lab/orders | Branch LAB; available or own claimed work, limited to 100 |
| POST /orders/{id}/{accept,process,reject,cancel} | Version, reason, key; exclusive LAB claim; Doctor cancellation before results |
| POST /orders/{id}/results | Own LAB claim, expectedVersion, sourceRef, bounded content, reason, key |
| POST /orders/{id}/reviews | Assigned Doctor, expectedVersion, current resultVersion, reason, key |
| POST /visits/{id}/validate | Assigned Doctor, expectedVersion, reason, key; mandatory note fields and all orders reviewed/rejected/cancelled |
| GET /visits/{id}/readiness | Assigned Doctor; identifiers, caseVersion, status, ready only; immutable VALIDATED proof for Encounter |

Validation freezes the local case. In this scope there is no reopen, signing or release route. Completion may rely on immutable VALIDATED proof; adding reopen later requires a new cross-service seal protocol. Signing, clinical download/release and online payment are disabled.

The note fields are draft input structure, not professionally approved forms. Follow-up date currently records a proposal; it does not create a booking. Results preserve author, source reference, version, content hash and time. Review does not auto-complete the visit.

Outbox types: `clinic.medical.{draft_saved,order_changed,result_recorded,result_reviewed,validated}.v1`; data contains encounterId, resourceId, actorUserId only. Audit workload token requires medical-v2-service issuer, audit-v2-service audience and audit.write scope. Inbox replay has no duplicate effect.

Unknown UI mutation retains its original key/body/version. A 4xx conflict requires a fresh authoritative version. Explicit reconciliation preserves local draft text; acknowledged mutation followed by failed refresh is not reissued as an unknown mutation.
