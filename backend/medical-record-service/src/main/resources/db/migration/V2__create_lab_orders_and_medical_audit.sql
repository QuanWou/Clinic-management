CREATE TABLE lab_orders (
    id UUID PRIMARY KEY,
    medical_record_id UUID NOT NULL REFERENCES medical_records(id),
    test_code VARCHAR(100) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('ORDERED', 'COLLECTED', 'PROCESSING', 'RESULTED', 'RELEASED')),
    sample_identifier VARCHAR(100) UNIQUE,
    collected_at TIMESTAMP,
    result_value TEXT,
    result_unit VARCHAR(100),
    reference_range VARCHAR(255),
    resulted_at TIMESTAMP,
    released_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT lab_orders_sample_state CHECK (status = 'ORDERED' OR sample_identifier IS NOT NULL),
    CONSTRAINT lab_orders_result_state CHECK (status NOT IN ('RESULTED', 'RELEASED') OR (result_value IS NOT NULL AND resulted_at IS NOT NULL)),
    CONSTRAINT lab_orders_release_state CHECK (status <> 'RELEASED' OR released_at IS NOT NULL)
);

CREATE INDEX idx_lab_orders_record_created ON lab_orders(medical_record_id, created_at DESC);

CREATE TABLE medical_audit_events (
    id UUID PRIMARY KEY,
    actor_user_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    resource_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_medical_audit_resource_created ON medical_audit_events(resource_id, created_at DESC);
CREATE INDEX idx_medical_records_patient_created ON medical_records(patient_id, created_at DESC);
CREATE INDEX idx_medical_records_doctor_patient ON medical_records(doctor_id, patient_id);