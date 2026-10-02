# Automatic source charge ingestion — active design

Medical result review produces a unique source charge from its immutable reviewed order/price snapshot. Encounter clinical completion reconciles all performed Medical orders plus its checked-in booking's frozen consultation price. Neither event authorizes automatic bill issue, collection, ledger posting, signature or document release.

Producers deliver identifier-only events through independent durable delivery acknowledgements, separate from Audit and Appointment fulfillment. Billing validates the dedicated producer issuer/audience/scope, exact envelope and source/type relationship, stores an immutable event inbox and acknowledges receipt. A leased worker queries source-owned minimal price proof outside the local transaction and atomically merges charge snapshots under clinic AND branch RLS. Unsupported/mismatched source proof cannot create a charge.

Medical reviewed orders cannot subsequently be cancelled or authored again under the implemented transition rules. Billing keeps unique (clinic, source type, source ID), verifies the same encounter/branch/offering/name/price on replay and does not replace a frozen charge with a newer Catalog price. Completion proof binds the immutable validated Medical case version and actual booking/encounter/patient.

Cashier bill issue remains a current-role command. It obtains the complete authoritative proof, reconciles existing imported charges and creates any missing source charge exactly once before bill lines and balanced journals. Ingested candidate charges alone do not create receivables or collect money. Missing source events can be reconciled by the complete proof without duplicates; mismatches require explicit operational investigation.

Verification must cover duplicate/concurrent/changed replay, wrong producer or scope, source outage before allocation, worker crash/reclaimed lease, unique charge reuse on bill issue, unchanged source price after Catalog updates, independent Audit acknowledgement and actual producer-to-Billing delivery. This file is design, not execution evidence.
