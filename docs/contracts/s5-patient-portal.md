# S5 own history and onsite financial portal

Scope: [Product Owner instruction](../../docs/audits/clinic-v2/Delivery_Scope_No_Deposit_Unsigned.md). Signing, clinical release and online collection stay disabled. This contract describes own-account operational reads; guardian/delegated access is not enabled.

Patient owns the platform-user→patient mapping. `GET /api/me/patient-clinic-links` and `/{clinicId}` resolve that mapping using the active session. Caller-supplied patient IDs, shared contact information and matching UUIDs confer no ownership. Revoked clinic links are absent on the next read. A SELECT-only RLS policy reads links under a transaction-local own-patient context populated only after the current user's protected mapping is resolved; it does not permit link creation or updates.

Clinic's `GET /api/me/patient-clinics` delegates the already authenticated user bearer to Patient outside its local read transaction, then reads only source-authorized clinic IDs with tenant RLS. It returns names and branch identifiers/active flags, excluding licenses/private contacts. A linked UNPUBLISHED/SUSPENDED clinic can appear in private history; this grants no eligibility for a new booking. Search's public publication rule still governs discovery.

Billing's `GET /api/me/clinics/{clinicId}/branches/{branchId}/bills` and `/{billId}` delegates the active bearer to Patient's own clinic-link endpoint before starting its read transaction. Local queries require clinic AND branch RLS plus the authoritative patient ID. No staff BILLING membership is needed to read one's own data. Another patient's bill gives 404; a different branch gives no rows; missing/revoked ownership fails closed; a source outage returns unavailable rather than stale financial data.

Patient representation: issued time, whole-VND subtotal/approved reduction/paid/remaining values, status, source service names/amounts and internal receipts. It omits patient/source IDs, collector/shift IDs, cash office reasons and external bank/POS references. Receipt labels explicitly exclude tax-invoice status. There is no money mutation in the own financial portal.

UI private history selection is independent of public Search. Session/clinic/branch changes discard previous data; a late response for an earlier account/scope is ignored. Failed/revoked reload clears old balances and receipts. Tokens remain in memory. Booking history/cancel/reschedule continues through Appointment's independent patient ownership checks.

Verification is recorded separately under `docs/audits/clinic-v2/P05-S5/`; this document itself does not confer A5 acceptance.
