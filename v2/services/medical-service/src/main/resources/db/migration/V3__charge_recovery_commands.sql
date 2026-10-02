CREATE TABLE medical_v2.charge_recovery_commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,event_id uuid NOT NULL REFERENCES medical_v2.billing_deliveries(event_id),
 reason varchar(500) NOT NULL CHECK(length(trim(reason))>0),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE medical_v2.charge_recovery_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_v2.charge_recovery_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON medical_v2.charge_recovery_commands USING(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id()) WITH CHECK(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id());
REVOKE ALL ON medical_v2.charge_recovery_commands FROM PUBLIC;
GRANT SELECT,INSERT ON medical_v2.charge_recovery_commands TO clinic_v2_medical_runtime;

