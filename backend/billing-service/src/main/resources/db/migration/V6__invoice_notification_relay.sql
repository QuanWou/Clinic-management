ALTER TABLE invoice_paid_outbox DROP CONSTRAINT IF EXISTS invoice_paid_outbox_status_check;
ALTER TABLE invoice_paid_outbox ADD COLUMN recipient_user_id UUID;
ALTER TABLE invoice_paid_outbox ADD COLUMN publish_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoice_paid_outbox ADD COLUMN next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE invoice_paid_outbox ADD COLUMN published_at TIMESTAMP;
ALTER TABLE invoice_paid_outbox ADD COLUMN last_error VARCHAR(255);

ALTER TABLE invoice_paid_outbox ADD CONSTRAINT invoice_paid_outbox_status_check
    CHECK (status IN ('WAITING_RECIPIENT', 'PENDING', 'PUBLISHED', 'FAILED'));

CREATE INDEX idx_invoice_paid_outbox_relay ON invoice_paid_outbox(next_attempt_at)
    WHERE status = 'PENDING';
