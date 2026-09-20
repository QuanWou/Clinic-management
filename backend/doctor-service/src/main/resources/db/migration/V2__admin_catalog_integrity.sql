ALTER TABLE doctor.doctors ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE doctor.schedules ADD CONSTRAINT ck_schedule_day_of_week CHECK (day_of_week BETWEEN 1 AND 7);
ALTER TABLE doctor.schedules ADD CONSTRAINT ck_schedule_time_range CHECK (start_time < end_time);
ALTER TABLE doctor.doctors ADD CONSTRAINT ck_doctor_consultation_fee CHECK (consultation_fee >= 0);

CREATE UNIQUE INDEX uk_specialty_name_lower ON doctor.specialties (LOWER(name));

CREATE TABLE doctor.admin_audit (
    id UUID PRIMARY KEY,
    actor_user_id UUID NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID NOT NULL,
    action VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_doctor_admin_audit_resource ON doctor.admin_audit (resource_type, resource_id, created_at DESC);