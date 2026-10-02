CREATE SCHEMA IF NOT EXISTS notification_v2;
CREATE TABLE notification_v2.event_inbox(source varchar(80) NOT NULL,event_id uuid NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(source,event_id));
CREATE TABLE notification_v2.appointment_states(
 appointment_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,user_id uuid NOT NULL,status varchar(32) NOT NULL,
 starts_at timestamptz NOT NULL,source_version bigint NOT NULL,reminder_at timestamptz,reminded_version bigint NOT NULL DEFAULT 0
);
CREATE TABLE notification_v2.notifications(
 id uuid PRIMARY KEY,user_id uuid NOT NULL,clinic_id uuid NOT NULL,appointment_id uuid NOT NULL,
 kind varchar(40) NOT NULL,message varchar(180) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(appointment_id,kind,id)
);
CREATE TABLE notification_v2.preferences(user_id uuid PRIMARY KEY,reminders_enabled boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now());
CREATE FUNCTION notification_v2.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
CREATE FUNCTION notification_v2.is_consumer() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT coalesce(current_setting('app.notification_mode',true),'')='consumer' $$;
ALTER TABLE notification_v2.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_v2.notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_scope ON notification_v2.notifications USING(user_id=notification_v2.current_user_id() OR notification_v2.is_consumer())
 WITH CHECK(user_id=notification_v2.current_user_id() OR notification_v2.is_consumer());
ALTER TABLE notification_v2.preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_v2.preferences FORCE ROW LEVEL SECURITY;
CREATE POLICY preference_read ON notification_v2.preferences FOR SELECT USING(user_id=notification_v2.current_user_id() OR notification_v2.is_consumer());
CREATE POLICY preference_insert ON notification_v2.preferences FOR INSERT WITH CHECK(user_id=notification_v2.current_user_id());
CREATE POLICY preference_update ON notification_v2.preferences FOR UPDATE USING(user_id=notification_v2.current_user_id()) WITH CHECK(user_id=notification_v2.current_user_id());
ALTER TABLE notification_v2.appointment_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_v2.appointment_states FORCE ROW LEVEL SECURITY;
CREATE POLICY state_consumer ON notification_v2.appointment_states USING(notification_v2.is_consumer()) WITH CHECK(notification_v2.is_consumer());
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_notification_runtime') THEN
 CREATE ROLE clinic_v2_notification_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT; END IF;END $$;
REVOKE ALL ON SCHEMA notification_v2 FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA notification_v2 FROM PUBLIC;
GRANT USAGE ON SCHEMA notification_v2 TO clinic_v2_notification_runtime;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA notification_v2 TO clinic_v2_notification_runtime;

