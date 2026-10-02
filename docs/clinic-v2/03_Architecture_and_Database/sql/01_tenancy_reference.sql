-- DESIGN REFERENCE ONLY. Run in a disposable service-owned DB after review.
-- Not an V1 migration. The application must supply verified tenant context.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS app_security;
CREATE OR REPLACE FUNCTION app_security.current_clinic_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.clinic_id', true), '')::uuid
$$;

-- EXAMPLE local tenant table. Each real service should apply the same principle
-- to ALL tenant-owned operational/clinical/financial tables.
CREATE TABLE IF NOT EXISTS public.tenant_example (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid,
 name text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (clinic_id,id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_example_scope ON public.tenant_example(clinic_id,branch_id);
ALTER TABLE public.tenant_example ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_example FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_example_scope ON public.tenant_example;
CREATE POLICY tenant_example_scope ON public.tenant_example
  FOR ALL TO PUBLIC
  USING (clinic_id = app_security.current_clinic_id())
  WITH CHECK (clinic_id = app_security.current_clinic_id());

-- Operational requirements:
-- * Runtime DB role must NOT own tables, be superuser, or have BYPASSRLS.
-- * Revoke public table access; GRANT only needed commands to runtime role.
-- * App calls BEGIN; SELECT set_config('app.clinic_id', :VERIFIED_CLINIC, true);
--   ...parameterized DML... COMMIT; ROLLBACK on error.
-- * Missing context => NULL => deny. Test pooled connection re-use.
-- * RLS checks clinic ownership, NOT doctor assignment or guardian entitlement.
-- * A client must never be allowed to set this setting directly.
