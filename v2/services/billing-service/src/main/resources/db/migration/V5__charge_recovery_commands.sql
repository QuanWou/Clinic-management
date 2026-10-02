CREATE TABLE billing_v2.charge_recovery_commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,event_id uuid NOT NULL REFERENCES billing_v2.charge_event_inbox(event_id),
 reason varchar(500) NOT NULL CHECK(length(trim(reason))>0),created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE billing_v2.charge_recovery_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_v2.charge_recovery_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON billing_v2.charge_recovery_commands USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id()) WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id());
REVOKE ALL ON billing_v2.charge_recovery_commands FROM PUBLIC;
GRANT SELECT,INSERT ON billing_v2.charge_recovery_commands TO clinic_v2_billing_runtime;

