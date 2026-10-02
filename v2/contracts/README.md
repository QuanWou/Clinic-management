# Clinic V2 integration contracts

## event-envelope.schema.json

This file is copied from the P03 architecture contract and remains the canonical machine-readable baseline for non-PHI integration events.

Rules:
- versioned event type `clinic.<domain>.<event>.vN`
- explicit clinic scope; branch optional
- correlation and causation identifiers
- aggregate version
- minimal safe metadata only
- no diagnosis, patient contact, full clinical text or equivalent PHI
- producer is authenticated separately from the JSON payload
- consumers remain idempotent; at-least-once transport does not mean exactly-once delivery

Any incompatible contract change requires a new event version and producer/consumer compatibility evidence.
