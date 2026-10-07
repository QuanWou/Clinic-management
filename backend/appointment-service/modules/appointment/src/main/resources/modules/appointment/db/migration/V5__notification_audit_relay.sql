ALTER TABLE appointment_v2.outbox_events ADD COLUMN notification_published_at timestamptz,ADD COLUMN audit_published_at timestamptz;
CREATE POLICY outbox_relay_read ON appointment_v2.outbox_events FOR SELECT USING(current_setting('app.appointment_mode',true)='relay');
CREATE POLICY outbox_relay_update ON appointment_v2.outbox_events FOR UPDATE USING(current_setting('app.appointment_mode',true)='relay') WITH CHECK(current_setting('app.appointment_mode',true)='relay');

