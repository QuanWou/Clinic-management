ALTER TABLE notification_v2.notifications ALTER COLUMN appointment_id DROP NOT NULL;
ALTER TABLE notification_v2.notifications ADD COLUMN billing_id uuid;
ALTER TABLE notification_v2.notifications ADD CONSTRAINT exactly_one_resource CHECK((appointment_id IS NOT NULL)::integer+(billing_id IS NOT NULL)::integer=1);
CREATE TABLE notification_v2.financial_event_inbox(
 event_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,billing_id uuid NOT NULL,user_id uuid NOT NULL,
 source_version bigint NOT NULL CHECK(source_version>0),payload_json jsonb NOT NULL,received_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE notification_v2.financial_event_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_v2.financial_event_inbox FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_consumer ON notification_v2.financial_event_inbox USING(notification_v2.is_consumer()) WITH CHECK(notification_v2.is_consumer());
REVOKE ALL ON notification_v2.financial_event_inbox FROM PUBLIC;
GRANT SELECT,INSERT ON notification_v2.financial_event_inbox TO clinic_v2_notification_runtime;
REVOKE UPDATE ON notification_v2.notifications FROM clinic_v2_notification_runtime;
