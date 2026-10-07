CREATE FUNCTION billing_v2.notify_reception() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('billing_' || md5(NEW.clinic_id::text || ':' || NEW.branch_id::text),'changed');
 RETURN NEW;
END $$;
CREATE TRIGGER reception_changed AFTER INSERT ON billing_v2.outbox_events FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_reception();
CREATE TRIGGER reception_changed AFTER INSERT OR UPDATE ON billing_v2.bills FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_reception();
CREATE TRIGGER reception_changed AFTER INSERT OR UPDATE ON billing_v2.shifts FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_reception();
