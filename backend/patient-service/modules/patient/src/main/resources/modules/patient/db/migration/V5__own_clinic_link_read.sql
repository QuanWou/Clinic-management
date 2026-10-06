-- Own authenticated history access is independent of public clinic publication.
-- PatientService sets this transaction-local ID only after resolving the current
-- user's RLS-protected platform link. Avoid nested policies involving the
-- reception identity/link cycle. This grants no link insert/update permission.
CREATE POLICY own_clinic_link_read ON patient_v2.clinic_patient_links FOR SELECT USING (
 status IN ('PROVISIONAL','VERIFIED') AND patient_id=nullif(current_setting('app.own_patient_id',true),'')::uuid
);
