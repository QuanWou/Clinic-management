CREATE TABLE encounter_v2.charge_recovery_commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,event_id uuid NOT NULL REFERENCES encounter_v2.billing_deliveries(event_id),
 reason varchar(500) NOT NULL CHECK(length(trim(reason))>0),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE encounter_v2.charge_recovery_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_v2.charge_recovery_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON encounter_v2.charge_recovery_commands USING(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id()) WITH CHECK(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id());
REVOKE ALL ON encounter_v2.charge_recovery_commands FROM PUBLIC;
GRANT SELECT,INSERT ON encounter_v2.charge_recovery_commands TO clinic_v2_encounter_runtime;

