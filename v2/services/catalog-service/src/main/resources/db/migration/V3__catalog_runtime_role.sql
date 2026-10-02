DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_catalog_runtime') THEN
    CREATE ROLE clinic_v2_catalog_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA catalog_v2 TO clinic_v2_catalog_runtime;
GRANT SELECT,INSERT,UPDATE ON catalog_v2.offerings TO clinic_v2_catalog_runtime;
GRANT SELECT,INSERT,UPDATE ON catalog_v2.branch_offerings TO clinic_v2_catalog_runtime;
GRANT SELECT,INSERT ON catalog_v2.price_versions TO clinic_v2_catalog_runtime;
