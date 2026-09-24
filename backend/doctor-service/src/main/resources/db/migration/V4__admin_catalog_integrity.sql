-- Extend the original production V2 lineage without rewriting its installed history.
ALTER TABLE doctor.doctors ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;
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