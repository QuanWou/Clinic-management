CREATE SCHEMA IF NOT EXISTS app_security;

CREATE OR REPLACE FUNCTION app_security.current_mode()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.access_mode', true), '')
$$;

CREATE OR REPLACE FUNCTION app_security.current_clinic_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.clinic_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_security.current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

ALTER TABLE clinic.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic.clinics FORCE ROW LEVEL SECURITY;
ALTER TABLE clinic.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic.branches FORCE ROW LEVEL SECURITY;
ALTER TABLE clinic.clinic_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic.clinic_licenses FORCE ROW LEVEL SECURITY;
ALTER TABLE clinic.onboarding_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic.onboarding_reviews FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_select_scope ON clinic.clinics;
CREATE POLICY clinic_select_scope ON clinic.clinics FOR SELECT TO PUBLIC USING (
  app_security.current_mode() IN ('platform','system')
  OR (app_security.current_mode()='tenant' AND id=app_security.current_clinic_id())
  OR (app_security.current_mode()='owner_index' AND owner_user_id=app_security.current_user_id())
  OR (app_security.current_mode()='public' AND review_status='APPROVED' AND evidence_verified=true
      AND publication_status='PUBLISHED' AND published_at IS NOT NULL)
);
DROP POLICY IF EXISTS clinic_insert_scope ON clinic.clinics;
CREATE POLICY clinic_insert_scope ON clinic.clinics FOR INSERT TO PUBLIC WITH CHECK (
  app_security.current_mode()='system'
  OR (app_security.current_mode()='tenant' AND id=app_security.current_clinic_id())
);
DROP POLICY IF EXISTS clinic_update_scope ON clinic.clinics;
CREATE POLICY clinic_update_scope ON clinic.clinics FOR UPDATE TO PUBLIC
USING (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND id=app_security.current_clinic_id()))
WITH CHECK (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND id=app_security.current_clinic_id()));
DROP POLICY IF EXISTS clinic_delete_scope ON clinic.clinics;
CREATE POLICY clinic_delete_scope ON clinic.clinics FOR DELETE TO PUBLIC USING (false);

DROP POLICY IF EXISTS branch_select_scope ON clinic.branches;
CREATE POLICY branch_select_scope ON clinic.branches FOR SELECT TO PUBLIC USING (
  app_security.current_mode() IN ('platform','system')
  OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id())
  OR (app_security.current_mode()='owner_index' AND EXISTS (
      SELECT 1 FROM clinic.clinics c WHERE c.id=branches.clinic_id AND c.owner_user_id=app_security.current_user_id()))
  OR (app_security.current_mode()='public' AND active=true AND EXISTS (
      SELECT 1 FROM clinic.clinics c WHERE c.id=branches.clinic_id AND c.review_status='APPROVED'
      AND c.evidence_verified=true AND c.publication_status='PUBLISHED' AND c.published_at IS NOT NULL))
);
DROP POLICY IF EXISTS branch_write_scope ON clinic.branches;
CREATE POLICY branch_write_scope ON clinic.branches FOR ALL TO PUBLIC
USING (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id()))
WITH CHECK (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id()));

DROP POLICY IF EXISTS license_select_scope ON clinic.clinic_licenses;
CREATE POLICY license_select_scope ON clinic.clinic_licenses FOR SELECT TO PUBLIC USING (
  app_security.current_mode() IN ('platform','system')
  OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id())
  OR (app_security.current_mode()='owner_index' AND EXISTS (
      SELECT 1 FROM clinic.clinics c WHERE c.id=clinic_licenses.clinic_id AND c.owner_user_id=app_security.current_user_id()))
  OR (app_security.current_mode()='public' AND EXISTS (
      SELECT 1 FROM clinic.clinics c WHERE c.id=clinic_licenses.clinic_id AND c.review_status='APPROVED'
      AND c.evidence_verified=true AND c.publication_status='PUBLISHED' AND c.published_at IS NOT NULL))
);
DROP POLICY IF EXISTS license_write_scope ON clinic.clinic_licenses;
CREATE POLICY license_write_scope ON clinic.clinic_licenses FOR ALL TO PUBLIC
USING (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id()))
WITH CHECK (app_security.current_mode() IN ('platform','system')
       OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id()));

DROP POLICY IF EXISTS review_select_scope ON clinic.onboarding_reviews;
CREATE POLICY review_select_scope ON clinic.onboarding_reviews FOR SELECT TO PUBLIC USING (
  app_security.current_mode() IN ('platform','system')
  OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id())
  OR (app_security.current_mode()='owner_index' AND EXISTS (
      SELECT 1 FROM clinic.clinics c WHERE c.id=onboarding_reviews.clinic_id AND c.owner_user_id=app_security.current_user_id()))
);
DROP POLICY IF EXISTS review_insert_scope ON clinic.onboarding_reviews;
CREATE POLICY review_insert_scope ON clinic.onboarding_reviews FOR INSERT TO PUBLIC WITH CHECK (
  app_security.current_mode() IN ('platform','system')
  OR (app_security.current_mode()='tenant' AND clinic_id=app_security.current_clinic_id())
);
DROP POLICY IF EXISTS review_update_scope ON clinic.onboarding_reviews;
CREATE POLICY review_update_scope ON clinic.onboarding_reviews FOR UPDATE TO PUBLIC USING (false);
DROP POLICY IF EXISTS review_delete_scope ON clinic.onboarding_reviews;
CREATE POLICY review_delete_scope ON clinic.onboarding_reviews FOR DELETE TO PUBLIC USING (false);

-- Deployment requirement: the runtime role must be non-owner, non-superuser, NO BYPASSRLS.
-- Grant only SELECT/INSERT/UPDATE needed by clinic-service. Migration role remains separate.
