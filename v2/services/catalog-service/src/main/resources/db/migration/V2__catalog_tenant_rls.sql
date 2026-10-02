CREATE OR REPLACE FUNCTION catalog_v2.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.clinic_id', true), '')::uuid
$$;

ALTER TABLE catalog_v2.offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_v2.offerings FORCE ROW LEVEL SECURITY;
ALTER TABLE catalog_v2.branch_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_v2.branch_offerings FORCE ROW LEVEL SECURITY;
ALTER TABLE catalog_v2.price_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_v2.price_versions FORCE ROW LEVEL SECURITY;

CREATE POLICY offering_tenant ON catalog_v2.offerings
  USING (clinic_id = catalog_v2.current_clinic_id())
  WITH CHECK (clinic_id = catalog_v2.current_clinic_id());
CREATE POLICY branch_offering_tenant ON catalog_v2.branch_offerings
  USING (clinic_id = catalog_v2.current_clinic_id())
  WITH CHECK (clinic_id = catalog_v2.current_clinic_id());
CREATE POLICY price_tenant ON catalog_v2.price_versions
  USING (clinic_id = catalog_v2.current_clinic_id())
  WITH CHECK (clinic_id = catalog_v2.current_clinic_id());
