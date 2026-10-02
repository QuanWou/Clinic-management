# S3 Medical — unsigned implementation checkpoint

Task `6820c6b7-522a-4a2c-9f1b-b05d2184fb36`, branch `local-coder/clinic-management-v2-6820c6b7`. The [Product Owner scope](../Delivery_Scope_No_Deposit_Unsigned.md) explicitly keeps signing, release and online payment disabled. This checkpoint does not accept A3 or approve medical forms.

[PostgreSQL summary](medical-verification/summary.json): isolated PostgreSQL 17.6, 2026-10-01 21:54–22:01 Asia/Bangkok, ten selected modules/packages, **125 tests**, zero failures/errors/skips. Modules: Patient 6, Appointment 21, Clinic 25, Doctor 13, Encounter 13, Identity 16, Notification 5, Audit 12, Catalog 8, Medical 6. Package hashes record the artifacts used in that run; subsequent completion changes have their own verification directory.

Medical V1 creates clinic/branch FORCE RLS, restricted runtime privileges, immutable note versions/results/reviews/receipts/history, and identifier-only outbox. Doctor reads and writes revalidate canonical role and source Encounter assignment. LAB may claim/process/author a sourced result but cannot read the Doctor note or approve it. Source Catalog price/name is read outside the local transaction, and the frozen snapshot survives later repricing.

[Database tests](medical-verification/com.clinic.v2.medical.MedicalPostgresTest.txt) exercise 18 same-key draft requests, two competing saves, two competing LAB claims, immutable versions and restricted permissions, source snapshot, authenticated result/review prerequisite, cancellation history, branch scope, canonical role, revoke and closed-Encounter denial. Mandatory validation here is a proposed draft baseline, awaiting qualified review; no diagnosis, medication policy or approved prescription template is supplied.

[Real HTTP flow](medical-verification/medical-flow-summary.json) uses ten actual packaged services, real V2 IAM and private Catalog, draft/result replay, LAB claim/process/result, unreviewed-result denial, assigned Doctor review/validation, LAB note denial and seven exact Audit effects. [Audit HTTP tests](medical-verification/com.clinic.v2.audit.MedicalAuditHttpPostgresTest.txt) verify endpoint authorization, scope/issuer rejection, PHI-key rejection and inbox replay. Legacy user/token validation uses the synthetic fixture; this does not establish real signup/login or complete public booking E2E.

[UI tests](medical-verification/ui-tests.txt): **29 PASS**; [build](medical-verification/ui-build.txt) PASS; [browser fixtures](medical-verification/browser-tests.txt): four workflows PASS. Medical includes explicit autosave opt-in, version conflict reconciliation without discarding text, exact retry for unknown outcome, and acknowledged-order recovery without duplicate mutation after a failed head refresh. Browser Doctor and LAB pages share HTTP fixtures, exercise result review/unsigned validation, check storage and mobile overflow. These browser fixtures are separate from the real-service HTTP proof.

[Desktop](medical-verification/medical-desktop.png), [Doctor mobile](medical-verification/medical-mobile.png), [LAB mobile](medical-verification/lab-mobile.png) were visually inspected. The original Workspace palette and one-clinic context remain.

The successful disposable PostgreSQL instance and service children were stopped. The sandbox is retained by configuration, not reported as cleanup PASS. Failed attempts 01–03 remain in the evidence directory with their failure logs.

Remaining work is tracked separately: unsigned Encounter completion/Appointment fulfillment verification, onsite Billing, patient operational portal/follow-up, broader E2E/security/restore. Prescription/sign/addendum/release and online payment remain disabled pending the OPEN decisions and explicit future authorization.
