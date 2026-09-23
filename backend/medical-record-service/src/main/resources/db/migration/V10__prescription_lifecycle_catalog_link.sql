ALTER TABLE prescriptions
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'SIGNED',
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN signed_at TIMESTAMP,
    ADD COLUMN signed_by UUID;

UPDATE prescriptions
SET signed_at = created_at
WHERE status = 'SIGNED' AND signed_at IS NULL;

ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_status_check
        CHECK (status IN ('DRAFT', 'SIGNED'));

ALTER TABLE prescription_items
    ADD COLUMN medicine_id UUID,
    ADD COLUMN medicine_code VARCHAR(100),
    ADD COLUMN medicine_unit VARCHAR(100),
    ADD COLUMN route VARCHAR(100),
    ADD COLUMN quantity INTEGER;

ALTER TABLE prescription_items
    ADD CONSTRAINT prescription_items_quantity_check
        CHECK (quantity IS NULL OR quantity > 0);
