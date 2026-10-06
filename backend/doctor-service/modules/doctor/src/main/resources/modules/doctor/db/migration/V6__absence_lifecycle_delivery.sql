ALTER TABLE doctor.absences ADD COLUMN state varchar(12) NOT NULL DEFAULT 'ACTIVE' CHECK(state IN('ACTIVE','CANCELLED'));
ALTER TABLE doctor.absences ADD COLUMN row_version bigint NOT NULL DEFAULT 1;
ALTER TABLE doctor.absences ADD COLUMN cancelled_at timestamptz;
ALTER TABLE doctor.absences ADD COLUMN cancelled_by uuid;
ALTER TABLE doctor.absences ADD CHECK((state='ACTIVE' AND cancelled_at IS NULL AND cancelled_by IS NULL) OR (state='CANCELLED' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL));
GRANT UPDATE(state,row_version,cancelled_at,cancelled_by) ON doctor.absences TO clinic_v2_doctor_runtime;
CREATE FUNCTION doctor.guard_absence_cancellation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state<>'ACTIVE' OR NEW.state<>'CANCELLED' OR NEW.row_version<>OLD.row_version+1
 OR ROW(NEW.id,NEW.clinic_id,NEW.branch_id,NEW.practitioner_id,NEW.starts_at,NEW.ends_at,NEW.reason,NEW.actor_user_id,NEW.key,NEW.payload_hash,NEW.created_at)
 IS DISTINCT FROM ROW(OLD.id,OLD.clinic_id,OLD.branch_id,OLD.practitioner_id,OLD.starts_at,OLD.ends_at,OLD.reason,OLD.actor_user_id,OLD.key,OLD.payload_hash,OLD.created_at)
 THEN RAISE EXCEPTION 'Absence interval is immutable; only cancellation is allowed'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_absence BEFORE UPDATE ON doctor.absences FOR EACH ROW EXECUTE FUNCTION doctor.guard_absence_cancellation();
CREATE TABLE doctor.absence_commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,key varchar(120) NOT NULL,
 absence_id uuid NOT NULL REFERENCES doctor.absences(id),replacement_id uuid REFERENCES doctor.absences(id),
 operation varchar(12) NOT NULL CHECK(operation IN('CANCEL','AMEND')),payload_hash varchar(64) NOT NULL,
 reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(clinic_id,branch_id,actor_user_id,key));
ALTER TABLE doctor.absence_commands ENABLE ROW LEVEL SECURITY;ALTER TABLE doctor.absence_commands FORCE ROW LEVEL SECURITY;
CREATE POLICY absence_command_scope ON doctor.absence_commands USING(clinic_id=doctor.current_clinic_id()) WITH CHECK(clinic_id=doctor.current_clinic_id());
GRANT SELECT,INSERT ON doctor.absence_commands TO clinic_v2_doctor_runtime;
-- Minimal source-owned delivery metadata; no reason, patient or clinical payload.
CREATE TABLE doctor.absence_deliveries(
 event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),absence_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,
 doctor_id uuid NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL,source_version bigint NOT NULL,
 source_state varchar(12) NOT NULL,actor_user_id uuid NOT NULL,
 status varchar(12) NOT NULL DEFAULT 'PENDING' CHECK(status IN('PENDING','CLAIMED','PUBLISHED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),lease_id uuid,lease_until timestamptz,last_error varchar(50),
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(absence_id,source_version));
CREATE FUNCTION doctor.capture_absence_delivery() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,doctor AS $$
BEGIN
 INSERT INTO doctor.absence_deliveries(absence_id,clinic_id,branch_id,doctor_id,starts_at,ends_at,source_version,source_state,actor_user_id)
 VALUES(NEW.id,NEW.clinic_id,NEW.branch_id,NEW.practitioner_id,NEW.starts_at,NEW.ends_at,NEW.row_version,NEW.state,coalesce(NEW.cancelled_by,NEW.actor_user_id));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION doctor.capture_absence_delivery() FROM PUBLIC;
CREATE TRIGGER absence_delivery_change AFTER INSERT OR UPDATE OF state ON doctor.absences FOR EACH ROW EXECUTE FUNCTION doctor.capture_absence_delivery();
DROP TRIGGER absences_projection_change ON doctor.absences;
CREATE TRIGGER absences_projection_change AFTER INSERT OR UPDATE OF state ON doctor.absences FOR EACH ROW EXECUTE FUNCTION doctor.capture_projection_change('clinic_id');
INSERT INTO doctor.absence_deliveries(absence_id,clinic_id,branch_id,doctor_id,starts_at,ends_at,source_version,source_state,actor_user_id)
 SELECT id,clinic_id,branch_id,practitioner_id,starts_at,ends_at,row_version,state,actor_user_id FROM doctor.absences;
GRANT SELECT ON doctor.absence_deliveries TO clinic_v2_doctor_runtime;
GRANT UPDATE(status,attempts,next_attempt_at,lease_id,lease_until,last_error) ON doctor.absence_deliveries TO clinic_v2_doctor_runtime;
