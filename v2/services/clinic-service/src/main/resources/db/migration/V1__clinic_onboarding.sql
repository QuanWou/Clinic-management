CREATE SCHEMA IF NOT EXISTS clinic;

CREATE TABLE clinic.clinics (
    id uuid PRIMARY KEY,
    owner_user_id uuid NOT NULL,
    slug varchar(80) NOT NULL UNIQUE,
    name varchar(180) NOT NULL,
    public_description varchar(1000),
    contact_name varchar(150),
    contact_email varchar(180),
    contact_phone varchar(30),
    review_status varchar(24) NOT NULL DEFAULT 'DRAFT'
        CHECK (review_status IN ('DRAFT','SUBMITTED','NEEDS_CHANGES','APPROVED','REJECTED')),
    publication_status varchar(20) NOT NULL DEFAULT 'UNPUBLISHED'
        CHECK (publication_status IN ('UNPUBLISHED','PUBLISHED','SUSPENDED')),
    evidence_verified boolean NOT NULL DEFAULT false,
    reviewed_by uuid,
    reviewed_at timestamptz,
    published_at timestamptz,
    row_version bigint NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT ck_clinic_published CHECK (publication_status <> 'PUBLISHED' OR
        (review_status='APPROVED' AND evidence_verified=true AND published_at IS NOT NULL)),
    CONSTRAINT ck_clinic_suspended CHECK (publication_status <> 'SUSPENDED' OR published_at IS NOT NULL)
);
CREATE INDEX idx_clinics_owner ON clinic.clinics(owner_user_id);

CREATE TABLE clinic.clinic_licenses (
    clinic_id uuid PRIMARY KEY REFERENCES clinic.clinics(id),
    license_number varchar(100),
    issuing_authority varchar(180),
    scope_summary varchar(500),
    evidence_ref varchar(200),
    valid_until date,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE clinic.branches (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL REFERENCES clinic.clinics(id),
    name varchar(180) NOT NULL,
    address varchar(300) NOT NULL,
    opening_hours varchar(300) NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (clinic_id,id),
    UNIQUE (clinic_id,name)
);
CREATE INDEX idx_branch_clinic_active ON clinic.branches(clinic_id,active);

CREATE TABLE clinic.onboarding_reviews (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL REFERENCES clinic.clinics(id),
    actor_user_id uuid NOT NULL,
    action varchar(40) NOT NULL
        CHECK (action IN ('CREATED','DRAFT_UPDATED','BRANCH_ADDED','BRANCH_UPDATED',
                         'SUBMITTED','NEEDS_CHANGES','REJECTED','APPROVED','PUBLISHED','UNPUBLISHED','SUSPENDED')),
    reason varchar(500) NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_reviews_clinic ON clinic.onboarding_reviews(clinic_id,occurred_at DESC);
