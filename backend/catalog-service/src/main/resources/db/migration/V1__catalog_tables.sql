CREATE TABLE catalog.medical_services (
    id UUID PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog.medicines (
    id UUID PRIMARY KEY,
    code VARCHAR(60) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    description VARCHAR(1000),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog.service_prices (
    id UUID PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES catalog.medical_services(id),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL,
    effective_from DATE NOT NULL,
    effective_until DATE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_price_range CHECK (effective_until IS NULL OR effective_from < effective_until),
    CONSTRAINT uk_price_start UNIQUE (service_id, effective_from)
);

CREATE INDEX idx_service_price_lookup ON catalog.service_prices (service_id, effective_from DESC);

CREATE TABLE catalog.admin_audit (
    id UUID PRIMARY KEY,
    actor_user_id UUID NOT NULL,
    resource_type VARCHAR(40) NOT NULL,
    resource_id UUID NOT NULL,
    action VARCHAR(40) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);