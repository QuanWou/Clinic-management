DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_search_runtime') THEN
   CREATE ROLE clinic_v2_search_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
 END IF;
END $$;
GRANT USAGE ON SCHEMA search_v2 TO clinic_v2_search_runtime;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA search_v2 TO clinic_v2_search_runtime;
