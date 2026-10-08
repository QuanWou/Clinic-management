CREATE FUNCTION medical_v2.notify_owner_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE patient uuid; owner_id text;
BEGIN
 owner_id := NEW.payload_json::jsonb #>> '{data,actorUserId}';
 IF owner_id IS NOT NULL THEN PERFORM pg_notify('medical_doctor_' || md5(NEW.clinic_id::text || ':' || NEW.branch_id::text || ':' || owner_id),'changed');END IF;
 -- Unreleased note/order/result activity does not emit patient hints.
 IF NEW.event_type='clinic.medical.validated.v1' THEN
  SELECT patient_id INTO patient FROM medical_v2.cases WHERE encounter_id=NEW.aggregate_id;
  IF patient IS NOT NULL THEN PERFORM pg_notify('medical_patient_' || md5(NEW.clinic_id::text || ':' || NEW.branch_id::text || ':' || patient::text),'changed');END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER owner_realtime AFTER INSERT ON medical_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION medical_v2.notify_owner_realtime();
