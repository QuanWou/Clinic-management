ALTER TABLE lab_event_outbox ADD COLUMN recipient_user_id UUID;
ALTER TABLE lab_event_outbox ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'WAITING_RECIPIENT';
ALTER TABLE lab_event_outbox ADD COLUMN publish_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE lab_event_outbox ADD COLUMN next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE lab_event_outbox ADD COLUMN last_error VARCHAR(255);

ALTER TABLE lab_event_outbox ADD CONSTRAINT lab_event_outbox_status_check
    CHECK (status IN ('WAITING_RECIPIENT', 'PENDING', 'PUBLISHED', 'FAILED'));

CREATE INDEX idx_lab_event_outbox_relay ON lab_event_outbox(next_attempt_at)
    WHERE status = 'PENDING';
