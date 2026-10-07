CREATE TABLE encounter_v2.appointment_deliveries(
 event_id uuid PRIMARY KEY REFERENCES encounter_v2.outbox_events(event_id),
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,appointment_id uuid NOT NULL,
 encounter_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,last_error varchar(80),
 FOREIGN KEY(encounter_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
ALTER TABLE encounter_v2.appointment_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_v2.appointment_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON encounter_v2.appointment_deliveries
 USING(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id())
 WITH CHECK(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id());
CREATE POLICY relay_read ON encounter_v2.appointment_deliveries FOR SELECT USING(current_setting('app.encounter_mode',true)='relay');
CREATE POLICY relay_update ON encounter_v2.appointment_deliveries FOR UPDATE USING(current_setting('app.encounter_mode',true)='relay') WITH CHECK(current_setting('app.encounter_mode',true)='relay');
GRANT SELECT,INSERT ON encounter_v2.appointment_deliveries TO clinic_v2_encounter_runtime;
GRANT UPDATE(status,attempts,next_attempt_at,published_at,last_error) ON encounter_v2.appointment_deliveries TO clinic_v2_encounter_runtime;
