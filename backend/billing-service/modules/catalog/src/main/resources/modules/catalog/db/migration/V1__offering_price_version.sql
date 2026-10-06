CREATE SCHEMA IF NOT EXISTS catalog_v2;

CREATE TABLE catalog_v2.offerings (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL,
    code varchar(60) NOT NULL,
    name varchar(220) NOT NULL,
    description varchar(1000),
    specialty_code varchar(60),
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    row_version bigint NOT NULL DEFAULT 0,
    UNIQUE (clinic_id,code),
    UNIQUE (id,clinic_id)
);

CREATE TABLE catalog_v2.branch_offerings (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    offering_id uuid NOT NULL,
    active boolean NOT NULL DEFAULT true,
    public_visible boolean NOT NULL DEFAULT false,
    duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 5 AND 720),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    row_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_branch_offering_scope FOREIGN KEY (offering_id,clinic_id)
      REFERENCES catalog_v2.offerings(id,clinic_id),
    UNIQUE (clinic_id,branch_id,offering_id),
    UNIQUE (id,clinic_id,branch_id,offering_id)
);
CREATE INDEX idx_branch_offering_lookup ON catalog_v2.branch_offerings(clinic_id,branch_id,active);

CREATE TABLE catalog_v2.price_versions (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    offering_id uuid NOT NULL,
    branch_offering_id uuid NOT NULL,
    amount_vnd bigint NOT NULL CHECK (amount_vnd >= 0),
    currency varchar(3) NOT NULL DEFAULT 'VND' CHECK (currency='VND'),
    tax_policy_code varchar(80),
    discount_policy_code varchar(80),
    effective_from timestamptz NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fk_price_branch_offering FOREIGN KEY (branch_offering_id,clinic_id,branch_id,offering_id)
      REFERENCES catalog_v2.branch_offerings(id,clinic_id,branch_id,offering_id),
    UNIQUE (clinic_id,branch_id,offering_id,effective_from)
);
CREATE INDEX idx_price_snapshot ON catalog_v2.price_versions(clinic_id,branch_id,offering_id,effective_from DESC);
