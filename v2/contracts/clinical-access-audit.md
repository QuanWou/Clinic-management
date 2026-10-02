# Clinical access audit v1

Medical and Encounter record authenticated clinical reads (2xx GET) and denials (403/404) before response serialization. The audit writer never inspects the response body. Anonymous/invalid-session requests are not attributed to a user; authentication-edge audit remains a separate deployment concern.

Events clinic.medical.access_recorded.v1 and clinic.encounter.access_recorded.v1 use the normal envelope, source-specific workload issuer/secret and audit.write. Subject: clinical-access/{resourceId}; aggregateversion: 1; data has exactly resourceId, actorUserId, operation, outcome. No name, phone, diagnosis, result, note, body, user-supplied reason or credentials. Worklist resource ID is its branch.

Medical operations: READ_DRAFT, READ_ORDERS, READ_READINESS, READ_LAB_WORKLIST, CARE_MUTATION. Encounter: READ_ENCOUNTER, READ_WORKLIST, CARE_MUTATION. Outcomes SUCCESS or DENIED. CARE_MUTATION only allows DENIED; successful mutations already emit business events.

A separate local transaction writes the source outbox even when the rejected business transaction rolled back. Persistence failure prevents normal clinical response serialization; no remote Audit call occurs in that transaction. Existing relays retry/DLQ after commit. Audit validates producer/type/subject/operation/data, deduplicates source/event ID and appends its SECURITY hash chain with fixed denial reason. Resource types medical-access and encounter-access stay separate from business-state events. Clinical read authority grants no audit-read capability.

Covered: Medical draft/orders/readiness/lab worklist, denied order/result/review mutations; Encounter visit/Doctor worklist (array and page endpoints) and denied care mutations. This does not claim whole-platform or gateway authentication-denial audit coverage.

