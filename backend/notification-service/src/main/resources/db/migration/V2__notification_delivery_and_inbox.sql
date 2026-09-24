ALTER TABLE notifications
    ADD COLUMN recipient_user_id UUID,
    ADD COLUMN event_id UUID,
    ADD COLUMN event_type VARCHAR(64),
    ADD COLUMN read_at TIMESTAMP,
    ADD COLUMN delivery_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN publish_failures INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN last_enqueued_at TIMESTAMP;

CREATE INDEX idx_notifications_inbox ON notifications(recipient_user_id, created_at DESC);
CREATE INDEX idx_notifications_outbox ON notifications(status, next_attempt_at, last_enqueued_at);
CREATE UNIQUE INDEX idx_notifications_event_recipient_channel
    ON notifications(event_id, recipient_user_id, type) WHERE event_id IS NOT NULL;