ALTER TABLE encounter_v2.care_commands DROP CONSTRAINT care_commands_operation_check;
ALTER TABLE encounter_v2.care_commands ADD CONSTRAINT care_commands_operation_check CHECK(operation IN ('start','await-results','resume-queue','complete','close'));
ALTER TABLE encounter_v2.visits ADD COLUMN clinically_completed_at timestamptz, ADD COLUMN closed_at timestamptz, ADD COLUMN medical_case_version bigint CHECK(medical_case_version>0);
ALTER TABLE encounter_v2.visits ADD CONSTRAINT completion_proof_required CHECK(status NOT IN ('CLINICALLY_COMPLETED','CLOSED') OR (clinically_completed_at IS NOT NULL AND medical_case_version IS NOT NULL));
ALTER TABLE encounter_v2.visits ADD CONSTRAINT closed_timestamp_required CHECK(status<>'CLOSED' OR closed_at IS NOT NULL);
