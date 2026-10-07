ALTER TABLE encounter_v2.queue_tickets DROP CONSTRAINT queue_tickets_state_check;
ALTER TABLE encounter_v2.queue_tickets ADD CONSTRAINT queue_tickets_state_check CHECK(state IN ('WAITING','CALLED','SERVING','DONE','SKIPPED','TRANSFERRED','CANCELLED','ABSENT'));
ALTER TABLE encounter_v2.care_commands DROP CONSTRAINT care_commands_operation_check;
ALTER TABLE encounter_v2.care_commands ADD CONSTRAINT care_commands_operation_check CHECK(operation IN ('call','start','await-results','resume-queue','complete','close','queue-call','queue-skip','queue-transfer','queue-recall','queue-absent','queue-requeue'));
-- A shared intake point can serve separate doctor queues concurrently.
ALTER TABLE encounter_v2.queue_tickets ADD COLUMN doctor_user_id uuid;
UPDATE encounter_v2.queue_tickets t SET doctor_user_id=v.doctor_user_id FROM encounter_v2.visits v WHERE v.id=t.visit_id;
ALTER TABLE encounter_v2.queue_tickets ALTER COLUMN doctor_user_id SET NOT NULL;
CREATE FUNCTION encounter_v2.assign_ticket_doctor() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 SELECT doctor_user_id INTO NEW.doctor_user_id FROM encounter_v2.visits WHERE id=NEW.visit_id;
 RETURN NEW;
END $$;
CREATE TRIGGER ticket_doctor BEFORE INSERT OR UPDATE OF visit_id,doctor_user_id ON encounter_v2.queue_tickets FOR EACH ROW EXECUTE FUNCTION encounter_v2.assign_ticket_doctor();
DROP INDEX encounter_v2.one_served_ticket_per_point;
CREATE UNIQUE INDEX one_served_ticket_per_doctor_point ON encounter_v2.queue_tickets(doctor_user_id,service_point_id,queue_date) WHERE state IN ('CALLED','SERVING');
CREATE TABLE encounter_v2.reception_requests(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,visit_id uuid,patient_id uuid,
 type varchar(40) NOT NULL,reason varchar(500) NOT NULL,state varchar(16) NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','RESOLVED')),
 actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,payload_hash varchar(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),resolved_by uuid,resolved_at timestamptz,resolution varchar(500),
 UNIQUE(clinic_id,branch_id,actor_user_id,key),FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
ALTER TABLE encounter_v2.reception_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE encounter_v2.reception_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY reception_scope ON encounter_v2.reception_requests USING(clinic_id=nullif(current_setting('app.clinic_id',true),'')::uuid AND branch_id=nullif(current_setting('app.branch_id',true),'')::uuid) WITH CHECK(clinic_id=nullif(current_setting('app.clinic_id',true),'')::uuid AND branch_id=nullif(current_setting('app.branch_id',true),'')::uuid);
GRANT SELECT,INSERT,UPDATE ON encounter_v2.reception_requests TO clinic_v2_encounter_runtime;
