ALTER TABLE appointment_v2.appointments ADD UNIQUE(id,clinic_id,branch_id);
CREATE TABLE appointment_v2.reception_exceptions(
 id uuid PRIMARY KEY,appointment_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 key varchar(120) NOT NULL,payload_hash varchar(64) NOT NULL,exception_type varchar(24) NOT NULL CHECK(exception_type IN ('LATE','NO_SHOW','DOCTOR_ABSENT')),
 reason varchar(500) NOT NULL,state varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','RESOLVED')),
 notification_mode varchar(32) NOT NULL CHECK(notification_mode IN ('IN_APP','MANUAL_CONTACT_REQUIRED')),created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,actor_user_id,key),FOREIGN KEY(appointment_id,clinic_id,branch_id) REFERENCES appointment_v2.appointments(id,clinic_id,branch_id));
ALTER TABLE appointment_v2.reception_exceptions ENABLE ROW LEVEL SECURITY;ALTER TABLE appointment_v2.reception_exceptions FORCE ROW LEVEL SECURITY;
CREATE POLICY exception_scope ON appointment_v2.reception_exceptions USING(clinic_id=appointment_v2.current_clinic_id());
GRANT SELECT,INSERT ON appointment_v2.reception_exceptions TO clinic_v2_appointment_runtime;
