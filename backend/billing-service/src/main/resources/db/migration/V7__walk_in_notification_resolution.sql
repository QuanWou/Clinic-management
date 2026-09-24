-- Applied migrations remain immutable. Resolve recipients after cash capture, never inside it.
ALTER TABLE invoice_paid_outbox DROP CONSTRAINT invoice_paid_outbox_status_check;
ALTER TABLE invoice_paid_outbox ADD CONSTRAINT invoice_paid_outbox_status_check
    CHECK (status IN ('WAITING_RECIPIENT', 'PENDING', 'PUBLISHED', 'FAILED', 'SKIPPED_NO_ACCOUNT'));

CREATE INDEX idx_invoice_paid_outbox_waiting_recipient ON invoice_paid_outbox(next_attempt_at)
    WHERE status = 'WAITING_RECIPIENT';