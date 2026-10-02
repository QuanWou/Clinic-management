-- DESIGN REFERENCE ONLY: separate Medical Record service database.
-- Ownership of encounter/doctor/patient IDs is checked through signed internal
-- API/event contracts; they are NOT cross-service SQL foreign keys.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS medical;
CREATE TABLE medical.clinical_document (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 encounter_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 document_type text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id)
);
CREATE TABLE medical.document_version (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 document_id uuid NOT NULL,
 version_no integer NOT NULL CHECK(version_no>0),
 addendum_of_version_id uuid,
 state text NOT NULL CHECK(state IN ('draft','validated','signed')),
 content_uri text NOT NULL, -- private object, never a public URL
 content_sha256 text NOT NULL,
 signer_user_id uuid,
 signature_evidence_uri text,
 signed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id), UNIQUE(clinic_id,document_id,version_no),
 FOREIGN KEY(clinic_id,document_id) REFERENCES medical.clinical_document(clinic_id,id),
 FOREIGN KEY(clinic_id,addendum_of_version_id) REFERENCES medical.document_version(clinic_id,id),
 CHECK ((state = 'signed') = (signed_at IS NOT NULL AND signer_user_id IS NOT NULL AND signature_evidence_uri IS NOT NULL))
);
CREATE TABLE medical.document_release (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 version_id uuid NOT NULL,
 released_by uuid NOT NULL,
 released_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz,
 UNIQUE(clinic_id,version_id),
 FOREIGN KEY(clinic_id,version_id) REFERENCES medical.document_version(clinic_id,id)
);
CREATE TABLE medical.clinical_order (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 encounter_id uuid NOT NULL,
 source_offering_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('ordered','accepted','processing','resulted','reviewed','cancelled','rejected')),
 ordered_by uuid NOT NULL,
 ordered_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id)
);
CREATE TABLE medical.clinical_result (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 order_id uuid NOT NULL,
 author_id uuid NOT NULL,
 content_uri text NOT NULL,
 content_sha256 text NOT NULL,
 resulted_at timestamptz NOT NULL,
 UNIQUE(clinic_id,id),
 FOREIGN KEY(clinic_id,order_id) REFERENCES medical.clinical_order(clinic_id,id)
);
CREATE TABLE medical.result_review (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 result_id uuid NOT NULL,
 doctor_id uuid NOT NULL,
 reviewed_at timestamptz NOT NULL,
 UNIQUE(clinic_id,result_id,doctor_id),
 FOREIGN KEY(clinic_id,result_id) REFERENCES medical.clinical_result(clinic_id,id)
);
-- Documents signed in real implementation must be write-protected by a narrowly
-- scoped DB/service privilege and a BEFORE UPDATE/DELETE guard; release is a
-- separate record, not an edit of signed content. Legal signature format OPEN.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['clinical_document','document_version','document_release','clinical_order','clinical_result','result_review']) LOOP
  EXECUTE format('ALTER TABLE medical.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE medical.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scope ON medical.%I FOR ALL USING (clinic_id = app_security.current_clinic_id()) WITH CHECK (clinic_id = app_security.current_clinic_id())',t);
 END LOOP;
END $$;
