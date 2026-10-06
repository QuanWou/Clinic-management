CREATE TABLE encounter_v2.care_commands(
 clinic_id uuid NOT NULL, branch_id uuid NOT NULL, actor_user_id uuid NOT NULL,
 operation varchar(32) NOT NULL CHECK(operation IN ('start','await-results','resume-queue')),
 key varchar(120) NOT NULL, payload_hash varchar(64) NOT NULL, visit_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,operation,key),
 FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
ALTER TABLE encounter_v2.care_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_v2.care_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON encounter_v2.care_commands
 USING(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id())
 WITH CHECK(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id());
GRANT SELECT,INSERT ON encounter_v2.care_commands TO clinic_v2_encounter_runtime;
