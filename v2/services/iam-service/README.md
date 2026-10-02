# Superseded S0-03 draft

This directory is an earlier S0-03 draft and is **not** the runtime integration target.

Use `v2/services/identity-service/` for the completed P05-S0-03 Identity/IAM implementation. Clinic Service is wired to the contracts and workload-token conventions in that module.

Do not deploy both modules against the same IAM schema/port. This draft is retained only to avoid destructive cleanup while the shared Workbench task may be used by another conversation; it should be removed or archived during the reviewed integration/commit step.
