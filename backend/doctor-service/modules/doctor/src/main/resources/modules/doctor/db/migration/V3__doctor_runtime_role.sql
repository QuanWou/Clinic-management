DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_doctor_runtime') THEN
    CREATE ROLE clinic_v2_doctor_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA doctor TO clinic_v2_doctor_runtime;
GRANT SELECT,INSERT ON doctor.practitioners TO clinic_v2_doctor_runtime;
GRANT SELECT,INSERT,UPDATE ON doctor.doctor_affiliations TO clinic_v2_doctor_runtime;
GRANT SELECT,INSERT,UPDATE ON doctor.working_schedules TO clinic_v2_doctor_runtime;
