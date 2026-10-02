# S5 — operational baseline, updated 2026-10-02

The [PO scope](../Delivery_Scope_No_Deposit_Unsigned.md) enables no-deposit booking, unsigned internal care, onsite collection and own operational history. Signature, clinical release, guardian and online money remain unavailable.

| Area | Implemented and verified | Remaining review/limits |
|---|---|---|
| Own profile/booking | Actual registration/password login/Public form, platform-user Patient proof; no-deposit confirm/cancel/reschedule, preferences/in-app messages | Provider channels and consent/retention review |
| Private money/history | Patient/clinic-link proof, unpublished historical access, branch RLS, safe receipts, next-read revoke; no internal bank/staff/source references | Bounded history lists, production privacy; guardian policy |
| Follow-up | Completed Encounter and immutable Medical proposed date; new booking/current 120,000 VND, old FULFILLED 100,000 VND unchanged | Qualified content/release review |
| Financial messages | Independent inbox/delivery, verified recipient/safe preview, manager exact-key lost-ACK recovery | Production channels/alerts and ownership review |
| Owner operations | Actual scoped Encounter/Billing aggregates; failed sources withhold totals; configuration; source-charge status/DLQ retry, distinct shift approver | Benchmark, operational user assessment, environment alerts |

[Checkpoint 05](../P05-S6/authenticated-checkpoint-05/summary.json): 206 selected tests/12 exact package hashes reused from passing zero-skip runs, real HTTP and 13 restored synthetic databases. [Application recovery](../P05-S6/authenticated-checkpoint-05/restored-applications-summary.json) starts five restored applications with migrations/relays disabled: actual login, same Patient, canonical Owner, paid bills/receipts and preserved staff/Patient-link revocation.

Earlier [aftercare](Aftercare_Operations_Implementation_Evidence.md), [charge](../P05-S4/Charge_Ingestion_Implementation_Evidence.md) and [configuration](../P05-S0-06/Configuration_Implementation_Evidence.md) counts are successive, not additive or sign-off. A5/A6 remain unaccepted. Production migration/traffic rollback, qualified forms, online/refund/settlement and legal/privacy acceptance remain separate.

