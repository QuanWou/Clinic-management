CREATE TABLE billing_v2.charge_event_inbox(
 event_id uuid PRIMARY KEY,source varchar(80) NOT NULL CHECK(source IN ('/services/medical','/services/encounter')),
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,encounter_id uuid NOT NULL,resource_id uuid NOT NULL,patient_id uuid,
 source_version bigint NOT NULL CHECK(source_version>0),kind varchar(24) NOT NULL CHECK(kind IN ('MEDICAL_REVIEWED','ENCOUNTER_COMPLETED')),
 payload_json jsonb NOT NULL,status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','APPLIED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,
 received_at timestamptz NOT NULL DEFAULT now(),applied_at timestamptz,last_error varchar(80),
 CHECK(kind<>'ENCOUNTER_COMPLETED' OR patient_id IS NOT NULL),
 CHECK((status='CLAIMED')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)));
ALTER TABLE billing_v2.charge_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_v2.charge_event_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON billing_v2.charge_event_inbox USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id()) WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id());
CREATE POLICY charge_relay ON billing_v2.charge_event_inbox USING(current_setting('app.billing_mode',true)='charge-relay') WITH CHECK(current_setting('app.billing_mode',true)='charge-relay');
REVOKE ALL ON billing_v2.charge_event_inbox FROM PUBLIC;
GRANT SELECT,INSERT ON billing_v2.charge_event_inbox TO clinic_v2_billing_runtime;
GRANT UPDATE(status,attempts,next_attempt_at,lease_token,lease_until,applied_at,last_error) ON billing_v2.charge_event_inbox TO clinic_v2_billing_runtime;
