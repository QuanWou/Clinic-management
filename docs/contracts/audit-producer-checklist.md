# Audit / event producer adoption checklist

Use this checklist when a source-owning service starts emitting S0-05 audit or integration events.

1. Record the business mutation in the source service's own transaction.
2. Persist a local outbox row in that same transaction when an integration event is required.
3. Never make a remote Audit/Broker call the condition for committing a clinical or financial aggregate unless an approved synchronous contract explicitly requires it.
4. Carry the incoming correlation id, create a causation id when applicable and keep the aggregate version.
5. Use `docs/contracts/event-envelope.schema.json`.
6. Event `data` contains only IDs, states, approved amounts and other minimal safe metadata. Never diagnosis, symptoms, contact details, clinical body, prescription/result text or secrets.
7. Authenticate the producer workload. The event's `source` string is not authentication.
8. Relay after commit; retry with backoff/dead-letter policy. Consumers deduplicate by `(source,event_id)` before applying a business effect.
9. Audit sensitive action outcome with actor, object, clinic/branch, timestamp, reason and correlation id. Audit read permission stays separate from ordinary clinical/financial roles.
10. Add contract tests for valid version, malformed/forged producer, replay, wrong tenant and PHI-key rejection.
11. Add integration evidence showing broker failure after DB commit does not lose the local outbox record.
12. Do not mark AT-039/068 complete across the platform until the relevant producer and consumer services are actually integrated and tested.
