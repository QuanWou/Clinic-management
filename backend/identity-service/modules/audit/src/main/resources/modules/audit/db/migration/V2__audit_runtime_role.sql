DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_audit_runtime') THEN
    CREATE ROLE clinic_v2_audit_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

GRANT USAGE ON SCHEMA audit_v2 TO clinic_v2_audit_runtime;
GRANT SELECT,INSERT,UPDATE ON audit_v2.audit_chain_heads TO clinic_v2_audit_runtime;
GRANT SELECT,INSERT ON audit_v2.audit_events TO clinic_v2_audit_runtime;
GRANT SELECT,INSERT,UPDATE ON audit_v2.outbox_events TO clinic_v2_audit_runtime;
