CREATE FUNCTION encounter_v2.notify_reception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('encounter_' || md5(NEW.clinic_id::text || ':' || NEW.branch_id::text),'changed');
 RETURN NEW;
END $$;
CREATE TRIGGER reception_changed AFTER INSERT ON encounter_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION encounter_v2.notify_reception();
CREATE TRIGGER reception_changed AFTER INSERT OR UPDATE ON encounter_v2.reception_requests FOR EACH ROW EXECUTE FUNCTION encounter_v2.notify_reception();
