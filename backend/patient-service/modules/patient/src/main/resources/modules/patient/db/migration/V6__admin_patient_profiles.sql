-- Clinic-wide administration is authorized through IAM before this scope is set.
CREATE POLICY admin_patient_read ON patient_v2.patient_identities FOR SELECT USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND EXISTS(
 SELECT 1 FROM patient_v2.clinic_patient_links l WHERE l.patient_id=patient_identities.id
 AND l.clinic_id=patient_v2.current_clinic_id() AND l.status IN ('PROVISIONAL','VERIFIED')));
CREATE POLICY admin_patient_insert ON patient_v2.patient_identities FOR INSERT WITH CHECK(
 current_setting('app.patient_mode',true)='clinic_admin' AND origin_clinic_id=patient_v2.current_clinic_id());
CREATE POLICY admin_patient_update ON patient_v2.patient_identities FOR UPDATE USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND EXISTS(
 SELECT 1 FROM patient_v2.clinic_patient_links l WHERE l.patient_id=patient_identities.id
 AND l.clinic_id=patient_v2.current_clinic_id() AND l.status IN ('PROVISIONAL','VERIFIED')))
 WITH CHECK(current_setting('app.patient_mode',true)='clinic_admin' AND EXISTS(
 SELECT 1 FROM patient_v2.clinic_patient_links l WHERE l.patient_id=patient_identities.id
 AND l.clinic_id=patient_v2.current_clinic_id() AND l.status IN ('PROVISIONAL','VERIFIED')));
CREATE POLICY admin_link_read ON patient_v2.clinic_patient_links FOR SELECT USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND clinic_id=patient_v2.current_clinic_id());
CREATE POLICY admin_link_insert ON patient_v2.clinic_patient_links FOR INSERT WITH CHECK(
 current_setting('app.patient_mode',true)='clinic_admin' AND clinic_id=patient_v2.current_clinic_id()
 AND status='PROVISIONAL');
CREATE POLICY admin_account_link_read ON patient_v2.platform_user_patient_links FOR SELECT USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND EXISTS(
 SELECT 1 FROM patient_v2.clinic_patient_links l WHERE l.patient_id=platform_user_patient_links.patient_id
 AND l.clinic_id=patient_v2.current_clinic_id() AND l.status IN ('PROVISIONAL','VERIFIED')));

CREATE TABLE patient_v2.admin_profile_receipts(
 clinic_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,patient_id uuid NOT NULL REFERENCES patient_v2.patient_identities(id),
 PRIMARY KEY(clinic_id,actor_user_id,key));
CREATE TABLE patient_v2.profile_changes(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,patient_id uuid NOT NULL REFERENCES patient_v2.patient_identities(id),
 actor_user_id uuid NOT NULL,action varchar(20) NOT NULL CHECK(action IN ('CREATE','UPDATE')),
 reason varchar(500) NOT NULL,changed_fields varchar(200) NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_profile_changes_patient ON patient_v2.profile_changes(clinic_id,patient_id,created_at DESC);
ALTER TABLE patient_v2.admin_profile_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.admin_profile_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_v2.profile_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY admin_receipt_scope ON patient_v2.admin_profile_receipts USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND clinic_id=patient_v2.current_clinic_id()
 AND actor_user_id=patient_v2.current_user_id());
CREATE POLICY admin_change_scope ON patient_v2.profile_changes USING(
 current_setting('app.patient_mode',true)='clinic_admin' AND clinic_id=patient_v2.current_clinic_id());
GRANT SELECT,INSERT ON patient_v2.admin_profile_receipts,patient_v2.profile_changes TO clinic_v2_patient_runtime;
