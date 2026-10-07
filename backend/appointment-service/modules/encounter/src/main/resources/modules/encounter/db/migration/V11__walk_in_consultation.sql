ALTER TABLE encounter_v2.visits
  ADD COLUMN consultation_json jsonb,
  ADD COLUMN consultation_performed_at timestamptz;
ALTER TABLE encounter_v2.visits ADD CONSTRAINT walk_in_consultation_only
  CHECK (consultation_json IS NULL OR appointment_id IS NULL);
ALTER TABLE encounter_v2.visits ADD CONSTRAINT performed_consultation_requires_snapshot
  CHECK (consultation_performed_at IS NULL OR consultation_json IS NOT NULL);
-- Existing encounters have no newly invented service or fee.
