CREATE TABLE medical_v2.billing_deliveries(
 event_id uuid PRIMARY KEY REFERENCES medical_v2.outbox_events(event_id),clinic_id uuid NOT NULL,branch_id uuid NOT NULL,
 payload_json text NOT NULL,status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','PUBLISHED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_token uuid,lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,last_error varchar(80),
 CHECK((status='CLAIMED')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)));
ALTER TABLE medical_v2.billing_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_v2.billing_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON medical_v2.billing_deliveries USING(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id()) WITH CHECK(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id());
CREATE POLICY billing_relay ON medical_v2.billing_deliveries USING(current_setting('app.medical_mode',true)='charge-relay') WITH CHECK(current_setting('app.medical_mode',true)='charge-relay');
REVOKE ALL ON medical_v2.billing_deliveries FROM PUBLIC;
GRANT SELECT,INSERT ON medical_v2.billing_deliveries TO clinic_v2_medical_runtime;
GRANT UPDATE(status,attempts,next_attempt_at,lease_token,lease_until,published_at,last_error) ON medical_v2.billing_deliveries TO clinic_v2_medical_runtime;
CREATE FUNCTION medical_v2.enqueue_billing_delivery() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.event_type='clinic.medical.result_reviewed.v1' THEN
 INSERT INTO medical_v2.billing_deliveries(event_id,clinic_id,branch_id,payload_json) VALUES(NEW.event_id,NEW.clinic_id,NEW.branch_id,NEW.payload_json);
 END IF;RETURN NEW;END $$;
CREATE TRIGGER enqueue_billing_delivery AFTER INSERT ON medical_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION medical_v2.enqueue_billing_delivery();
