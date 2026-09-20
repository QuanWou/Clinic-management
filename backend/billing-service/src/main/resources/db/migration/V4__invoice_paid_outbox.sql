-- Durable intent only. No automatic publication until authenticated recipient mapping,
-- post-commit broker confirms and Task 06's event consumer are integrated.
CREATE TABLE invoice_paid_outbox (
    event_id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL UNIQUE REFERENCES invoices(id),
    patient_id UUID NOT NULL,
    event_type VARCHAR(30) NOT NULL CHECK (event_type = 'INVOICE_PAID'),
    status VARCHAR(40) NOT NULL CHECK (status = 'WAITING_RECIPIENT'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);