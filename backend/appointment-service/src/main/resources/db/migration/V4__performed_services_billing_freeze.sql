CREATE TABLE performed_services (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL REFERENCES appointments(id),
    service_id UUID NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    service_date DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performed_services_appointment_created
    ON performed_services(appointment_id, created_at);

CREATE TABLE appointment_billing_closures (
    appointment_id UUID PRIMARY KEY REFERENCES appointments(id),
    finalized BOOLEAN NOT NULL DEFAULT FALSE,
    revision VARCHAR(64),
    finalized_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT appointment_billing_finalized_state CHECK (
        (finalized = FALSE AND revision IS NULL AND finalized_at IS NULL)
        OR (finalized = TRUE AND revision IS NOT NULL AND finalized_at IS NOT NULL)
    )
);
