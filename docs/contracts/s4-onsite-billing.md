# S4 onsite Billing contract

Scope: [Product Owner instruction](../../docs/audits/clinic-v2/Delivery_Scope_No_Deposit_Unsigned.md). `billing-service`, port 8103, schema `billing_v2`. The [03/10 invoice payment extension](invoice-online-payments.md) adds payOS/VNPAY and bank QR after the owner's Lunar reuse instruction. Refunds/reversals, settlement and tax invoices remain unavailable. A bill is independent of clinical signature/release.

## Authorization and source boundaries

User APIs under `/api/clinics/{clinicId}/branches/{branchId}` revalidate the active Identity session and canonical IAM `BILLING` decision. CASHIER, CLINIC_MANAGER and CLINIC_OWNER may collect; only manager/owner may approve reductions or another collector's submitted shift. FORCE RLS scopes every local table by clinic AND branch; the runtime role has no superuser or bypass privileges.

`GET /api/clinics/{c}/branches/{b}/billable-visits` is Encounter-owned and requires BILLING authorization. Billing obtains immutable completion/Medical/Appointment proofs before opening its write transaction. Source controllers require issuer `billing-service`, their own service audience, scope `billing.source.read`, a bounded workload token, and their independent IAM decision for the authenticated actor. Sources return identifiers, completed state, frozen service names/prices only; clinical notes/results are excluded.

`POST /bills` takes `encounterId` and a bounded reason. No client price is accepted. Only CLINICALLY_COMPLETED/CLOSED Encounter with matching immutable VALIDATED Medical version qualifies. REVIEWED Medical orders and the arrived booking's consultation produce separate source-owned charges. An empty performed-charge proof cannot issue a bill; reception selects the Catalog consultation at intake and the doctor confirms it was performed before completion. `(clinic, source type, source ID)` and `(clinic, branch, encounter)` are unique. Cashier issue rechecks source evidence; automatic source-event reconciliation is implemented by the independent inbox and retry extension below.

## Collection and accounting

All mutations require `Idempotency-Key`; receipts bind actor, operation, original payload and local outcome. A changed payload conflicts. Replays still check current permission. Bill mutation requires `expectedVersion`.

`POST /bills/{id}/payments`: `shiftId`, positive whole `amountVnd`, `method` CASH/BANK_TRANSFER/POS, optional `externalRef` (required for bank/POS), and reason. Only the collector's OPEN shift can receive payment. Shift then bill locks serialize collection against closing and prevent overpayment. Append-only payment, source balance/version, balanced ledger, command receipt, history and outbox commit together. A clinic/branch/method/external-reference unique constraint prevents counting the same confirmed bank/POS transaction twice.

`POST /bills/{id}/adjustments`: manager/owner approved positive reduction, reason and expected version; it cannot reduce below money already collected. Journals and lines are immutable and balanced at commit; a committed journal cannot acquire later lines. Internal receipt codes are labeled **BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ**.

`POST /collection-shifts` opens one collector shift per branch. `POST /collection-shifts/{id}/submit` freezes expected tender totals from immutable payments and declared whole-VND counts; variance is explicit. `POST /collection-shifts/{id}/approve` requires a distinct manager/owner and reason. GET bills/payments/shifts are bounded, authorized reads.

## Events and recovery

Identifier-only CloudEvents: `clinic.billing.bill_issued.v1`, `onsite_collected.v1`, `adjustment_approved.v1`, `shift_submitted.v1`, `shift_approved.v1`. Data keys are exactly `billingId`, `resourceId`, `actorUserId`. No clinical content, tender reference, reason or amount in event previews. Audit receives stable event IDs through bounded retry/DLQ and replay-safe inbox; audit acknowledgement is separate from the local business effect.

Cashier UI holds unknown mutations with their exact original key/body/version/scope and freezes dependent controls. Acknowledged collection followed by failed refresh retains the receipt and requires a read refresh, never a second collection. Tokens stay in memory. Printing includes the internal receipt only.

## Source ingestion and operational retry extension

Medical REVIEWED and Encounter CLINICALLY_COMPLETED events now have independent Billing deliveries, separate from Audit ACK. The Billing immutable inbox resolves minimal source proofs outside its local transaction and atomically reconciles unique frozen charges. Import alone creates neither bill nor journal; explicit cashier issue remains required. A later Catalog price cannot overwrite a performed snapshot.

Billing `GET /encounters/{id}/source-charges` and Medical/Encounter `GET /encounters/{id}/billing-deliveries` expose bounded event state/attempt/error categories, never clinical payloads. The three services use their own canonical BILLING authorization plus clinic/branch RLS. Cashier may read; only Owner/Manager may `POST /{eventId}/retry` beneath these routes with a bounded reason and Idempotency-Key. Only DLQ is reset to PENDING; active worker claims and acknowledged events cannot be reset by a new command. Exact-key replay still rechecks current authority, preserves the original event and returns current state without a second recovery audit effect. Changed payload returns 409. A source mismatch remains an investigation item; retry cannot reprice, release clinical documents, collect money or auto-refund.

Recovery receipts and identifier-only audit outbox commit with the reset. Events are `clinic.billing.charge_retry_requested.v1`, `clinic.medical.billing_retry_requested.v1` and `clinic.encounter.billing_retry_requested.v1`. The Cashier source panel preserves partial-source failures and uses the existing locked original-request recovery for a lost response.
