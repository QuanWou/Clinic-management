-- No broker send occurs in the release transaction. A future confirmed Task 06
-- publisher may deliver pending rows after commit and set published_at on ack.
CREATE TABLE lab_event_outbox (
    id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL CHECK (event_type = 'LAB_RESULT_READY'),
    lab_order_id UUID NOT NULL UNIQUE REFERENCES lab_orders(id),
    appointment_id UUID NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    published_at TIMESTAMP
);

CREATE INDEX idx_lab_event_outbox_pending ON lab_event_outbox(occurred_at)
    WHERE published_at IS NULL;