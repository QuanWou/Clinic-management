CREATE TABLE doctor.absences(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,practitioner_id uuid NOT NULL REFERENCES doctor.practitioners(id),
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,reason varchar(500) NOT NULL,actor_user_id uuid NOT NULL,
 key varchar(120) NOT NULL,payload_hash varchar(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(ends_at>starts_at AND ends_at-starts_at<=interval '31 days'),UNIQUE(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE doctor.absences ENABLE ROW LEVEL SECURITY;ALTER TABLE doctor.absences FORCE ROW LEVEL SECURITY;
CREATE POLICY absence_scope ON doctor.absences USING(clinic_id=doctor.current_clinic_id()) WITH CHECK(clinic_id=doctor.current_clinic_id());
GRANT SELECT,INSERT ON doctor.absences TO clinic_v2_doctor_runtime;
CREATE INDEX absences_doctor_time ON doctor.absences(clinic_id,branch_id,practitioner_id,starts_at,ends_at);
CREATE TRIGGER absences_projection_change AFTER INSERT ON doctor.absences FOR EACH ROW EXECUTE FUNCTION doctor.capture_projection_change('clinic_id');
