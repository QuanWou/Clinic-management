CREATE FUNCTION appointment_v2.notify_reception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('appointment_' || md5(NEW.clinic_id::text || ':' || NEW.branch_id::text),'changed');
 RETURN NEW;
END $$;
CREATE TRIGGER reception_changed AFTER INSERT OR UPDATE ON appointment_v2.appointments FOR EACH ROW EXECUTE FUNCTION appointment_v2.notify_reception();
CREATE TRIGGER reception_changed AFTER INSERT OR UPDATE ON appointment_v2.reception_exceptions FOR EACH ROW EXECUTE FUNCTION appointment_v2.notify_reception();
