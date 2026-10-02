# Contract status
- `openapi.yaml`: valid OpenAPI 3.1.1 **representative high-risk P0 slice**, 28 operations. It is not the complete set of all PRD P0 APIs, nor an implemented server. Each operation has `operationId` and `x-prd-requirements` trace.
- `event-envelope.schema.json`: JSON Schema 2020-12 for safe event envelope. It cannot by itself prove `data` is PHI-free: review every type in `event-catalog.yaml` and protect transport/producer identity.
- `event-catalog.yaml`: selected integration event types, responsible owner and consumer list.
- `_generate_contracts.py`: deterministic source for the above files; editable architecture exemplar, not connected to the Clinic repo.
- Define service-specific exhaustive OpenAPI/AsyncAPI contracts after OD approvals and V1 audit. Generate contract tests; no deployment from these samples.
