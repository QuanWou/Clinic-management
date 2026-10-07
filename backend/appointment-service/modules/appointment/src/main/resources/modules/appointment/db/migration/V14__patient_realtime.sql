CREATE FUNCTION appointment_v2.notify_patient_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('appointment_patient_' || md5(NEW.clinic_id::text || ':' || NEW.patient_id::text),'changed');RETURN NEW;
END $$;
CREATE TRIGGER patient_realtime AFTER INSERT OR UPDATE ON appointment_v2.appointments FOR EACH ROW EXECUTE FUNCTION appointment_v2.notify_patient_realtime();
