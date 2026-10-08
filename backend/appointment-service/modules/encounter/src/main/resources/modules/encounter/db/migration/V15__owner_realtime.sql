CREATE FUNCTION encounter_v2.notify_owner_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v encounter_v2.visits%ROWTYPE;
BEGIN
 SELECT * INTO v FROM encounter_v2.visits WHERE id=NEW.aggregate_id;
 IF FOUND THEN
  IF v.doctor_user_id IS NOT NULL THEN PERFORM pg_notify('encounter_doctor_' || md5(v.clinic_id::text || ':' || v.branch_id::text || ':' || v.doctor_user_id::text),'changed');END IF;
  -- Only completion/release-facing lifecycle hints are exposed to patients.
  IF v.status IN ('CLINICALLY_COMPLETED','CLOSED') THEN PERFORM pg_notify('encounter_patient_' || md5(v.clinic_id::text || ':' || v.branch_id::text || ':' || v.patient_id::text),'changed');END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER owner_realtime AFTER INSERT ON encounter_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION encounter_v2.notify_owner_realtime();
