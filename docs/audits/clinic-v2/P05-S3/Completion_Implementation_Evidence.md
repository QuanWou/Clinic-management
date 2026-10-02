# S3 unsigned clinical completion — verified checkpoint

Implementation follows the [Product Owner scope](../Delivery_Scope_No_Deposit_Unsigned.md). Signing, clinical release and online payments remain disabled; A3 is not accepted and no qualified medical/legal form approval is inferred.

[Final run](completion-verification/summary.json): PostgreSQL 17.6 in ten fresh isolated databases, **130 selected tests** and ten Maven packages PASS, zero failures/errors/skips. Run 2026-10-01 **22:30–22:35 Asia/Bangkok**. Patient 6, Appointment 23, Clinic 25, Doctor 13, Encounter 16, Identity 16, Notification 5, Audit 12, Catalog 8, Medical 6. [Final check](completion-verification/final-check.json) confirms all ten package hashes matched and the owned database port had no listener after stopping. Sandbox retained by configuration; cleanup is not PASS.

Encounter V6/V7 adds immutable complete/close command receipts, completion timestamp and Medical version proof, and a separate Appointment delivery queue. An assigned canonical Doctor completes only the current serving visit with immutable VALIDATED Medical proof, read outside the local write transaction. Completion retires the serving ticket atomically and writes history/outbox/fulfillment effect together. Replay returns local recorded outcome even during later Medical outage, while still rechecking IAM and assignment.

Closure requires the current clinically completed version and reason. It does not imply paid bill, signed document or released document. Closed records remain readable to the assigned Doctor and leave the active worklist. Introducing Medical reopen requires a revised cross-service seal protocol.

Appointment V9 accepts only Encounter workload issuer/audience/scope `appointment.fulfill` and the booking's actual Encounter. Transactional receipt replay/concurrency creates one FULFILLED history effect without repricing. Audit and Appointment delivery acknowledgements are independent, with bounded retry/DLQ.

[Encounter tests](completion-verification/com.clinic.v2.encounter.EncounterPostgresTest.txt) verify proof/version/state denial, source call outside transaction, local replay after source outage, closure replay, twelve concurrent completions, one booked delivery, stable event ID across failed acknowledgement, assignment/branch/revoke and premature closure denial. [Appointment tests](completion-verification/com.clinic.v2.appointment.AppointmentPostgresTest.txt) verify twelve concurrent fulfillment requests, one history/receipt, changed payload conflict, branch denial, frozen price and confirmed-without-arrival denial.

[Real-service HTTP](completion-verification/completion-flow-summary.json) covers both walk-in and seeded booking through real queue, Doctor note, LAB result, Doctor review, unsigned validation and complete/close. Booking asynchronously reaches FULFILLED; a user token is denied at the peer endpoint. [Medical summary](completion-verification/medical-flow-summary.json) records the booked case; the helper checks seven Medical Audit effects per case and both completion Audit events. Legacy user/token source remains synthetic and booking is seeded; full production signup/public-booking E2E is not established.

[UI](completion-verification/ui-tests.txt): **30 tests PASS**; [build](completion-verification/ui-build.txt) PASS; [browser fixtures](completion-verification/browser-tests.txt): **four PASS**, including validation→completion→closure and unknown-closure exact retry. Browser fixtures are separate from real-service HTTP.

Attempt 01 passed database tests but failed real Audit delivery: first check-in emitted version zero after correcting aggregate-version mapping. Activation now increments the actual visit version before emitting; regression checks positive source version equality. Failed evidence is retained in `attempt-01/`.

Billing implementation started subsequently and is not verified by this checkpoint. Full prescription/sign/addendum/release and S4–S6 acceptance remain outstanding or disabled by scope.
