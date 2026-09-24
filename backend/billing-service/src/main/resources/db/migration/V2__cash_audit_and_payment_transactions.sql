ALTER TABLE invoices ADD COLUMN paid_by UUID;
ALTER TABLE invoices ADD COLUMN refunded_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN refunded_by UUID;
ALTER TABLE invoices ADD COLUMN cancelled_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN cancelled_by UUID;
ALTER TABLE invoices ADD COLUMN catalog_revision VARCHAR(100);

-- Legacy paid invoices have no verified transaction; retain them for reconciliation,
-- never manufacture payment receipts or backfill paid_by without evidence.
UPDATE invoices SET status = 'RECONCILIATION_REQUIRED' WHERE status = 'PAID';
ALTER TABLE invoices ADD CONSTRAINT chk_invoices_positive_amount CHECK (total_amount > 0) NOT VALID;

CREATE TABLE payment_transactions (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('CAPTURE', 'REFUND')),
    provider VARCHAR(50) NOT NULL CHECK (provider = 'CASH_REGISTER'),
    external_reference VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'VND'),
    status VARCHAR(20) NOT NULL CHECK (status = 'SUCCEEDED'),
    confirmed_by UUID NOT NULL,
    confirmed_at TIMESTAMP NOT NULL,
    reason VARCHAR(500),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_payment_invoice_type UNIQUE(invoice_id, transaction_type)
);

CREATE INDEX idx_payment_transactions_invoice ON payment_transactions(invoice_id);