-- Retain the exact upstream immutable billable revisions accepted during invoice issuance.
-- Historical invoices have no source evidence and remain RECONCILIATION_REQUIRED.
ALTER TABLE invoices ADD COLUMN performed_revision VARCHAR(100);
ALTER TABLE invoices ADD COLUMN lab_revision VARCHAR(100);
ALTER TABLE invoices ADD CONSTRAINT chk_unpaid_invoice_source_revisions
    CHECK (status <> 'UNPAID' OR
           (performed_revision IS NOT NULL AND length(trim(performed_revision)) > 0 AND
            lab_revision IS NOT NULL AND length(trim(lab_revision)) > 0)) NOT VALID;
