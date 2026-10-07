CREATE FUNCTION billing_v2.notify_owner_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target billing_v2.bills%ROWTYPE;
BEGIN
 IF TG_TABLE_NAME='bills' THEN target:=NEW;ELSE SELECT * INTO target FROM billing_v2.bills WHERE id=NEW.bill_id;END IF;
 IF target.id IS NOT NULL THEN
  PERFORM pg_notify('billing_' || md5(target.clinic_id::text || ':' || target.branch_id::text),'changed');
  PERFORM pg_notify('billing_patient_' || md5(target.clinic_id::text || ':' || target.branch_id::text || ':' || target.patient_id::text),'changed');
  PERFORM pg_notify('billing_display_' || md5(target.clinic_id::text || ':' || target.branch_id::text || ':' || target.id::text),'changed');
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER owner_realtime AFTER INSERT OR UPDATE ON billing_v2.bills FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_owner_realtime();
CREATE TRIGGER owner_realtime AFTER INSERT OR UPDATE ON billing_v2.payment_intents FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_owner_realtime();
CREATE TRIGGER owner_realtime AFTER INSERT OR UPDATE ON billing_v2.notification_deliveries FOR EACH ROW EXECUTE FUNCTION billing_v2.notify_owner_realtime();
