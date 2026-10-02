CREATE TABLE billing_v2.notification_deliveries(
 event_id uuid PRIMARY KEY REFERENCES billing_v2.outbox_events(event_id),clinic_id uuid NOT NULL,branch_id uuid NOT NULL,
 bill_id uuid NOT NULL,patient_id uuid NOT NULL,payload_json text NOT NULL,recipient_user_id uuid,
 status varchar(24) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CLAIMED','DELIVERED','MANUAL_CONTACT','DLQ')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token uuid,lease_until timestamptz,last_error varchar(80),delivered_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id),
 CHECK((status='CLAIMED')=(lease_token IS NOT NULL AND lease_until IS NOT NULL)));
ALTER TABLE billing_v2.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_v2.notification_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON billing_v2.notification_deliveries USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id()) WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id());
CREATE POLICY notification_relay ON billing_v2.notification_deliveries USING(current_setting('app.billing_mode',true)='notification-relay') WITH CHECK(current_setting('app.billing_mode',true)='notification-relay');
REVOKE ALL ON billing_v2.notification_deliveries FROM PUBLIC;
GRANT SELECT,INSERT ON billing_v2.notification_deliveries TO clinic_v2_billing_runtime;
GRANT UPDATE(recipient_user_id,status,attempts,next_attempt_at,lease_token,lease_until,last_error,delivered_at) ON billing_v2.notification_deliveries TO clinic_v2_billing_runtime;
CREATE FUNCTION billing_v2.freeze_notification_recipient() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF OLD.recipient_user_id IS NOT NULL AND OLD.recipient_user_id IS DISTINCT FROM NEW.recipient_user_id THEN RAISE EXCEPTION 'Resolved notification recipient is immutable'; END IF;RETURN NEW;END $$;
CREATE TRIGGER freeze_notification_recipient BEFORE UPDATE ON billing_v2.notification_deliveries FOR EACH ROW EXECUTE FUNCTION billing_v2.freeze_notification_recipient();
CREATE FUNCTION billing_v2.enqueue_financial_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_type IN ('clinic.billing.bill_issued.v1','clinic.billing.onsite_collected.v1','clinic.billing.adjustment_approved.v1') THEN
  INSERT INTO billing_v2.notification_deliveries(event_id,clinic_id,branch_id,bill_id,patient_id,payload_json)
  SELECT NEW.event_id,NEW.clinic_id,NEW.branch_id,id,patient_id,NEW.payload_json FROM billing_v2.bills WHERE id=NEW.aggregate_id AND clinic_id=NEW.clinic_id AND branch_id=NEW.branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial notification requires an owned bill'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER enqueue_financial_notification AFTER INSERT ON billing_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION billing_v2.enqueue_financial_notification();
