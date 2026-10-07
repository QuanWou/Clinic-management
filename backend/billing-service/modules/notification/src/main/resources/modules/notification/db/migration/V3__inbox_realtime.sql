ALTER TABLE notification_v2.notifications ADD COLUMN read_at timestamptz;
GRANT UPDATE(read_at) ON notification_v2.notifications TO clinic_v2_notification_runtime;
CREATE FUNCTION notification_v2.notify_user_realtime() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_notify('notification_user_' || md5(NEW.user_id::text),'changed');RETURN NEW;
END $$;
CREATE TRIGGER user_realtime AFTER INSERT OR UPDATE ON notification_v2.notifications FOR EACH ROW EXECUTE FUNCTION notification_v2.notify_user_realtime();
CREATE TRIGGER preference_realtime AFTER INSERT OR UPDATE ON notification_v2.preferences FOR EACH ROW EXECUTE FUNCTION notification_v2.notify_user_realtime();
