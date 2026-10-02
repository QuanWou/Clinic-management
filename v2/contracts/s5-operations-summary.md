# Source-owned operations summary

Both Encounter and Billing provide `GET /api/v2/clinics/{clinic}/branches/{branch}/operations-summary?date=YYYY-MM-DD`. Each checks the active user and current canonical Owner/Manager branch authorization before a read-only, repeatable-read transaction with forced clinic AND branch RLS. Receptionist, Doctor, Lab and Cashier do not obtain this management summary by holding a legacy role.

The day is [00:00, next 00:00) in Asia/Ho_Chi_Minh. Encounter returns checked-in and completed counts for that day, queue counts for that queue date, plus current non-closed/non-cancelled visits, current awaiting results and arrival pending. Overnight is measured against today's local midnight, independently of the selected historical reporting day. No patient identifier, queue detail or clinical note is returned.

Billing returns immutable received tender by CASH/BANK_TRANSFER/POS and receipt count for the day; current outstanding balances and open/submitted shifts are current-state measures. Approved shifts are counted by approval time in the day. `issuedVnd` is the current net value of bills created that day, incorporating subsequently authorized reductions; it is not historical revenue or a tax report.

Each response includes `date` and `measuredAt`. The UI uses a private authorized branch directory within one clinic and refreshes it on every report read. Independent sources may be measured at different instants. A complete whole-scope summary is withheld when any requested branch/source fails. Scope/date changes, logout and denied reload clear previous reports; late replies from an earlier session are ignored.

These counts support operational review. They do not approve a shift, close a visit, sign/release a document or declare the clinic ready for production.
