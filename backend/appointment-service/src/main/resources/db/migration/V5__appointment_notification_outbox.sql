ALTER TABLE appointment.appointments
    ADD COLUMN IF NOT EXISTS patient_user_id UUID;

CREATE TABLE appointment.appointment_notification_outbox (
    id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN (
        'APPOINTMENT_CREATED', 'APPOINTMENT_CONFIRMED',
        'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED'
    )),
    appointment_id UUID NOT NULL REFERENCES appointment.appointments(id),
    recipient_user_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP,
    last_error VARCHAR(255)
);

CREATE INDEX idx_appointment_notification_outbox_pending
    ON appointment.appointment_notification_outbox(status, next_attempt_at, occurred_at);
