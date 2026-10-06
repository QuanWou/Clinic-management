CREATE FUNCTION patient_v2.current_user_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.user_id',true),'')::uuid
$$;
CREATE FUNCTION patient_v2.current_patient_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.patient_id',true),'')::uuid
$$;
CREATE FUNCTION patient_v2.current_clinic_id() RETURNS uuid LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.clinic_id',true),'')::uuid
$$;
ALTER TABLE patient_v2.platform_user_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.platform_user_patient_links FORCE ROW LEVEL SECURITY;
CREATE POLICY user_link_scope ON patient_v2.platform_user_patient_links
 USING(user_id=patient_v2.current_user_id() OR patient_id=patient_v2.current_patient_id())
 WITH CHECK(user_id=patient_v2.current_user_id());
ALTER TABLE patient_v2.patient_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.patient_identities FORCE ROW LEVEL SECURITY;
CREATE POLICY patient_read ON patient_v2.patient_identities FOR SELECT USING(
 id=patient_v2.current_patient_id() OR EXISTS(
 SELECT 1 FROM patient_v2.platform_user_patient_links l WHERE l.patient_id=id AND l.user_id=patient_v2.current_user_id()));
CREATE POLICY patient_insert ON patient_v2.patient_identities FOR INSERT WITH CHECK(patient_v2.current_user_id() IS NOT NULL);
CREATE POLICY patient_update ON patient_v2.patient_identities FOR UPDATE USING(EXISTS(
 SELECT 1 FROM patient_v2.platform_user_patient_links l WHERE l.patient_id=id AND l.user_id=patient_v2.current_user_id()));
ALTER TABLE patient_v2.clinic_patient_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.clinic_patient_links FORCE ROW LEVEL SECURITY;
CREATE POLICY clinic_link_scope ON patient_v2.clinic_patient_links
 USING(patient_id=patient_v2.current_patient_id() AND clinic_id=patient_v2.current_clinic_id())
 WITH CHECK(patient_id=patient_v2.current_patient_id() AND clinic_id=patient_v2.current_clinic_id());
