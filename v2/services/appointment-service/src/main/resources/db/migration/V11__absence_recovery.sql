ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN absence_doctor_id uuid;
ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN absence_starts_at timestamptz;
ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN absence_ends_at timestamptz;
ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN resolved_at timestamptz;
ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN resolved_by uuid;
GRANT UPDATE(state,resolved_at,resolved_by) ON appointment_v2.reception_exceptions TO clinic_v2_appointment_runtime;
CREATE TABLE appointment_v2.absence_progress(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,doctor_id uuid NOT NULL,
 starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,source_version bigint NOT NULL,
 state varchar(12) NOT NULL CHECK(state IN('ACTIVE','CANCELLED')));
CREATE TABLE appointment_v2.exception_resolution_commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 exception_id uuid NOT NULL REFERENCES appointment_v2.reception_exceptions(id),payload_hash varchar(64) NOT NULL,
 reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE appointment_v2.absence_progress ENABLE ROW LEVEL SECURITY;ALTER TABLE appointment_v2.absence_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY absence_progress_scope ON appointment_v2.absence_progress USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
ALTER TABLE appointment_v2.exception_resolution_commands ENABLE ROW LEVEL SECURITY;ALTER TABLE appointment_v2.exception_resolution_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY exception_resolution_scope ON appointment_v2.exception_resolution_commands USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
GRANT SELECT,INSERT,UPDATE ON appointment_v2.absence_progress TO clinic_v2_appointment_runtime;
GRANT SELECT,INSERT ON appointment_v2.exception_resolution_commands TO clinic_v2_appointment_runtime;
