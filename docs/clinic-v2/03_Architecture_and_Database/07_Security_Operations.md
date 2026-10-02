# 07 — Security, medical data and operations

## Access and medical data
- Access token (short expiry) + revocation-aware session and membership version; MFA for privileged roles based on approved policy.
- Separate administrative/financial/clinical capabilities, explicit purpose/assignment checks, deny by default; access to another clinic's chart requires approved sharing workflow.
- Sensitive medical content encrypted in transit; backups/object store encrypted at rest. Restrict staff access to production data and secrets in managed vault.
- Doctor signature workflow is not merely a boolean: capture signed payload hash, signer identity, credential/method, timestamp, purpose, version, verification evidence and immutable revision. Legal sufficiency of signature is OD-05 OPEN.
- Attachments: private storage, tenant-scoped keys, antivirus/content controls, checksum, short-lived authorization, audit download, tested restore.
- Avoid protected health information in event broker, analytics, email/SMS/push, URLs, application logs and error messages.

## Audit
Append-only audit categories: authentication/membership change, patient matching/guardian grant, clinic approval/publication, appointment modification, encounter read/write, document sign/release/addendum, charge/payment/refund/settlement, break-glass if ever implemented. Fields: event id, tenant/branch, subject actor and delegated actor, resource, action, outcome, reason, trace/correlation, UTC timestamp, immutable hash chain or equivalent tamper-evidence. Audit read access separate from normal clinical users. Define retention schedule with legal review; do not hardcode one period without counsel.

## Reliability and observability
- Metrics: booking hold timeout, concurrent-conflict rate, queue age, visit awaiting results, unreviewed orders, unpaid amount, unknown payment attempts, webhook replay failures, outbox/inbox delay, dead letters, search freshness, unauthorized cross-tenant attempts.
- Traces with correlation ID through HTTP/events; redact request body for clinical/payment routes. Security events also go to separate monitored sink.
- Health checks differentiate process alive/readiness/dependency; graceful degraded behavior for noncritical notifications/search. No payment-success response if Billing cannot verify.
- Backups by service with restoration test and immutable/offsite copy. RPO ≤15 min and RTO ≤4 h are **Phase 02 proposals only** pending actual capacity/restore test; do not claim achieved.
- Workload targets for booking and public search remain proposal; benchmark under approved load before production.

## Threat model starter
Cross-tenant IDOR, stale membership, SQL injection/GUC spoofing, pooled connection leak, signed URL enumeration, leaked provider secret/webhook spoof, replay of payment/refund, queue cross-talk, accidental PHI in search/notifications/log, document tampering, privilege escalation through manager role, broker event forgery, supply-chain dependencies. Per-threat mitigations become test cases and release evidence.

## Data governance
Define per-entity controller/processor roles, purpose, consent or other lawful basis, access/rectification/retention/erasure exceptions and cross-clinic data sharing. Medical retention and electronic record requirements require legal/medical sign-off; an internal PostgreSQL record alone is not legal certification. Production data never copied into demo/staging without authorization and safeguards.
