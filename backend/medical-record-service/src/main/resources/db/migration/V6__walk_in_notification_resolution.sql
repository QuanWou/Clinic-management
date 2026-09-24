-- Backfill the authoritative patient profile ID for outbox rows from earlier releases.
ALTER TABLE lab_event_outbox ADD COLUMN patient_id UUID;
UPDATE lab_event_outbox e
SET patient_id = r.patient_id
FROM lab_orders o JOIN medical_records r ON r.id = o.medical_record_id
WHERE e.lab_order_id = o.id AND e.patient_id IS NULL;
ALTER TABLE lab_event_outbox ALTER COLUMN patient_id SET NOT NULL;

ALTER TABLE lab_event_outbox DROP CONSTRAINT lab_event_outbox_status_check;
ALTER TABLE lab_event_outbox ADD CONSTRAINT lab_event_outbox_status_check
    CHECK (status IN ('WAITING_RECIPIENT', 'PENDING', 'PUBLISHED', 'FAILED', 'SKIPPED_NO_ACCOUNT'));

CREATE INDEX idx_lab_event_outbox_waiting_recipient ON lab_event_outbox(next_attempt_at)
    WHERE status = 'WAITING_RECIPIENT';