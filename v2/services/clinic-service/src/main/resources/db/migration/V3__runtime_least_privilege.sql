-- S0-03 defense-in-depth role. The deployment creates a LOGIN role
-- (for example clinic_v2_clinic_app) and grants membership in this NOLOGIN
-- role. The application login must remain NOSUPERUSER NOBYPASSRLS and must
-- not own tenant tables.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_clinic_runtime') THEN
    CREATE ROLE clinic_v2_clinic_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

REVOKE ALL ON SCHEMA clinic FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA clinic FROM PUBLIC;

GRANT USAGE ON SCHEMA clinic, app_security TO clinic_v2_clinic_runtime;
GRANT EXECUTE ON FUNCTION app_security.current_mode(),
                          app_security.current_clinic_id(),
                          app_security.current_user_id()
  TO clinic_v2_clinic_runtime;
GRANT SELECT,INSERT,UPDATE ON clinic.clinics,
                              clinic.branches,
                              clinic.clinic_licenses,
                              clinic.onboarding_reviews
  TO clinic_v2_clinic_runtime;

-- No DELETE is granted. Deletion is prohibited by S0 lifecycle and RLS.
