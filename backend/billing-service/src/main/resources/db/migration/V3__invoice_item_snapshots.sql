-- Every invoice issued before this migration lacks item snapshots, even if it has a
-- provisional catalog_revision from a former appointment-quote implementation.
-- Quarantine ALL of them; do not fabricate missing price evidence or delete history.
UPDATE invoices SET status = 'RECONCILIATION_REQUIRED' WHERE status = 'UNPAID';
ALTER TABLE invoices ADD COLUMN currency VARCHAR(3);

CREATE TABLE invoice_items (
    id UUID PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id),
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('SERVICE', 'LAB')),
    source_id UUID NOT NULL,
    service_id UUID NOT NULL,
    service_code VARCHAR(60) NOT NULL,
    service_name VARCHAR(255) NOT NULL,
    price_id UUID NOT NULL,
    service_date DATE NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price > 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_amount NUMERIC(12, 2) NOT NULL CHECK (line_amount > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency = 'VND'),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_invoice_item_source UNIQUE(source_type, source_id),
    CONSTRAINT uq_invoice_item_invoice_source UNIQUE(invoice_id, source_type, source_id),
    CONSTRAINT chk_invoice_item_product CHECK (line_amount = unit_price * quantity)
);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);