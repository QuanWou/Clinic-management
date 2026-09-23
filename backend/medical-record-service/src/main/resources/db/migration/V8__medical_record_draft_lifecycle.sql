ALTER TABLE medical_records
    ALTER COLUMN diagnosis DROP NOT NULL;

ALTER TABLE medical_records
    ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'FINAL',
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN finalized_at TIMESTAMP,
    ADD COLUMN finalized_by UUID;

UPDATE medical_records
SET finalized_at = COALESCE(updated_at, created_at)
WHERE status = 'FINAL' AND finalized_at IS NULL;

ALTER TABLE medical_records
    ADD CONSTRAINT medical_records_status_check
        CHECK (status IN ('DRAFT', 'FINAL')),
    ADD CONSTRAINT medical_records_finalization_check
        CHECK (
            (status = 'DRAFT' AND finalized_at IS NULL)
            OR
            (status = 'FINAL' AND diagnosis IS NOT NULL AND finalized_at IS NOT NULL)
        );
