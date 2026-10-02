# Operational financial notifications — implementation plan

Scope: no deposit, no online payment, no refund automation, no clinical release. Events for internal bill issue, onsite payment recording and separately authorized reduction provide fixed safe in-app copy. No amount, service name, cashier reason, external bank reference, clinical content or contact detail enters the preview.

Billing enqueues a separate durable delivery in its source transaction. Audit and Notification maintain independent acknowledgements; Audit success cannot suppress notification retries. A bounded leased worker resolves the actual patient owner at Patient outside Billing's transaction, then delivers using the original event ID and immutable financial source version. No account or revoked clinic link becomes an explicit manual-contact outcome, never a manufactured recipient or cashier notification.

The Patient peer read is restricted to Billing issuer, Patient audience and an exact recipient scope. It scopes both patient and clinic under runtime RLS and returns only eligibility and platform user ID. A missing identity never creates a platform link or grants user access.

Notification's Billing endpoint is separately guarded from Appointment. It validates the exact identifier-only envelope and approved event types, stores an immutable inbox receipt, rejects changed replay payloads and commits one user-owned notification per event. A bill resource remains a bill resource; it cannot be inserted into the appointment identifier column.

Verification must cover concurrent replay, changed recipient/payload, cross-account reads, missing/revoked Patient source, source outage without lost delivery, expired worker lease, independent Audit acknowledgement and fixed preview copy. This design file is not execution evidence.
