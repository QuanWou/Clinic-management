# Operational follow-up design

Scope is a new no-deposit appointment linked to a prior completed encounter. No signed/released clinical document, drug recommendation or approved clinical form is inferred.

Only the active user's authoritative Patient identity and non-revoked clinic link may read a proposed follow-up date. Medical exposes the date and immutable case version only; notes/results remain private and clinical release stays disabled. Encounter independently proves the same patient's CLINICALLY_COMPLETED/CLOSED visit and the Medical version used for completion.

Before creating a follow-up hold, Appointment's facade obtains both patient-owned proofs outside the booking transaction and checks clinic/branch/encounter/patient/version agreement. The existing booking source eligibility, schedule/capacity, hold TTL and current price validation still apply. A generic hold endpoint accepts no prior encounter link. The specialized command persists the source encounter/branch, Medical version and proposed date on the hold and resulting new appointment; the old visit and immutable note are untouched.

Idempotency digest includes the prior source identity/version. No client-supplied Medical version or date is trusted. Confirming/recovering the hold carries its stored prior link. Rescheduling the new appointment preserves its original link. Proposed date is a suggested scheduling date; it does not bypass actual availability and does not silently create an appointment.

Pending implementation/verification is tracked separately. This design is not A5 acceptance evidence.
