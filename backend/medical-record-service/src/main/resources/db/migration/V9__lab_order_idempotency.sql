ALTER TABLE lab_orders
    ADD COLUMN idempotency_key VARCHAR(100),
    ADD COLUMN ordered_by_user_id UUID,
    ADD COLUMN duplicate_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN duplicate_reason VARCHAR(500);

ALTER TABLE lab_orders
    ADD CONSTRAINT lab_orders_record_idempotency_unique
        UNIQUE (medical_record_id, idempotency_key);

ALTER TABLE lab_orders
    ADD CONSTRAINT lab_orders_duplicate_reason_check
        CHECK (
            duplicate_confirmed = FALSE
            OR (duplicate_reason IS NOT NULL AND length(trim(duplicate_reason)) > 0)
        );
