-- Protect the same interval semantics at the database boundary: [from, until).
-- Extension availability and existing rows must be validated before production rollout.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE catalog.service_prices
    ADD CONSTRAINT ck_price_currency CHECK (currency ~ '^[A-Z]{3}$');

ALTER TABLE catalog.service_prices
    ADD CONSTRAINT ex_service_price_no_overlap
    EXCLUDE USING gist (
        service_id WITH =,
        daterange(effective_from, effective_until, '[)') WITH &&
    );