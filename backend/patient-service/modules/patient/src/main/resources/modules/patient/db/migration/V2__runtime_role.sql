DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_patient_runtime') THEN
  CREATE ROLE clinic_v2_patient_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
 END IF;
END $$;
GRANT USAGE ON SCHEMA patient_v2 TO clinic_v2_patient_runtime;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA patient_v2 TO clinic_v2_patient_runtime;
