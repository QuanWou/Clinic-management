ALTER TABLE lab_orders ADD COLUMN service_id UUID;
ALTER TABLE lab_orders ADD COLUMN performed_on DATE;

CREATE TABLE lab_billing_closures (
    appointment_id UUID PRIMARY KEY,
    finalized BOOLEAN NOT NULL DEFAULT FALSE,
    revision VARCHAR(64),
    finalized_at TIMESTAMP,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT lab_billing_finalized_state CHECK (
        (finalized = FALSE AND revision IS NULL AND finalized_at IS NULL)
        OR (finalized = TRUE AND revision IS NOT NULL AND finalized_at IS NOT NULL)
    )
);
