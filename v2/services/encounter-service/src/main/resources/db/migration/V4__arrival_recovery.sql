ALTER TABLE encounter_v2.command_receipts ADD COLUMN created_at timestamptz;
UPDATE encounter_v2.command_receipts r SET created_at=v.created_at FROM encounter_v2.visits v WHERE v.id=r.visit_id;
ALTER TABLE encounter_v2.command_receipts ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE encounter_v2.command_receipts ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE encounter_v2.command_receipts ADD COLUMN arrival_reason varchar(500);
CREATE INDEX receipts_recovery ON encounter_v2.command_receipts(clinic_id,branch_id,actor_user_id,created_at DESC);
