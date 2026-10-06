# Doctor worklist pagination

`GET /api/clinics/{clinicId}/branches/{branchId}/doctor/worklist/page?after={visitId}&limit=200` returns `items` and nullable `nextAfter`. Limit is 1–200. The existing array endpoint remains compatible and returns the first 200 rows.

Every read requires canonical Doctor permission and applies clinic/branch FORCE RLS plus `doctor_user_id`. Ordering is ascending `(created_at,id)` to preserve oldest-first priority and handle equal timestamps. The cursor must belong to the same Doctor and scope. An owned cursor can continue after its status becomes inactive; a missing, reassigned or out-of-scope cursor yields a generic conflict requiring reload. This is a live worklist, not a historical snapshot: concurrent assignment/status changes can require a new first-page read.

The UI continues from the last first-page row when 200 rows were returned, retains that cursor after a transient read failure, deduplicates already loaded IDs, and stops when the server returns no cursor. An authoritative 4xx clears the previous worklist/selected care data. Unsaved/pending Medical work blocks changing the worklist or scope. The count labels loaded rows, not an invented total.

Migration V10 adds a partial scoped index; it changes no existing price, appointment or clinical record. Page reads use the existing identifiers-only `READ_WORKLIST` audit, with branch as resource. Audit never includes patient or clinical content.

The isolated PostgreSQL volume fixture covers 225 rows with identical timestamps, unique complete continuation and an inactive cursor; negative tests cover other Doctor/scope, role, limit and revoke. The actual HTTP journey separately checks small-data page continuation, other Doctor cursor conflict, Reception denial and source security audit.
