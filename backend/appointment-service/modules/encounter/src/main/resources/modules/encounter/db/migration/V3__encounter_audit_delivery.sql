ALTER TABLE encounter_v2.outbox_events ADD COLUMN last_error varchar(80),ADD COLUMN published_at timestamptz;
CREATE POLICY outbox_relay_read ON encounter_v2.outbox_events FOR SELECT USING(current_setting('app.encounter_mode',true)='relay');
CREATE POLICY outbox_relay_update ON encounter_v2.outbox_events FOR UPDATE USING(current_setting('app.encounter_mode',true)='relay') WITH CHECK(current_setting('app.encounter_mode',true)='relay');
GRANT UPDATE ON encounter_v2.outbox_events TO clinic_v2_encounter_runtime;
