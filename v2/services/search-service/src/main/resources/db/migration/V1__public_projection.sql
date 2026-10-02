CREATE SCHEMA IF NOT EXISTS search_v2;

CREATE TABLE search_v2.public_clinics (
  clinic_id uuid PRIMARY KEY,
  slug varchar(80) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  description varchar(1000),
  location_text varchar(300),
  published boolean NOT NULL,
  source_version bigint NOT NULL CHECK(source_version>=1),
  source_updated_at timestamptz NOT NULL,
  indexed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE search_v2.public_branches (
  branch_id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES search_v2.public_clinics(clinic_id) ON DELETE CASCADE,
  name varchar(180) NOT NULL,
  address varchar(300) NOT NULL,
  opening_hours varchar(300) NOT NULL,
  active boolean NOT NULL,
  source_version bigint NOT NULL CHECK(source_version>=1),
  indexed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_search_branch_clinic ON search_v2.public_branches(clinic_id,active);

CREATE TABLE search_v2.public_doctors (
  doctor_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  display_name varchar(180) NOT NULL,
  specialty_code varchar(80),
  specialty_name varchar(180),
  professional_title varchar(180),
  public_visible boolean NOT NULL,
  source_version bigint NOT NULL CHECK(source_version>=1),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(doctor_id,clinic_id,branch_id),
  FOREIGN KEY(branch_id) REFERENCES search_v2.public_branches(branch_id) ON DELETE CASCADE
);
CREATE INDEX idx_search_doctor_text ON search_v2.public_doctors(clinic_id,branch_id,public_visible);

CREATE TABLE search_v2.public_offerings (
  offering_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  code varchar(80) NOT NULL,
  name varchar(180) NOT NULL,
  specialty_code varchar(80),
  amount_vnd bigint CHECK(amount_vnd>=0),
  currency varchar(3) NOT NULL DEFAULT 'VND' CHECK(currency='VND'),
  price_version_id uuid,
  effective_from timestamptz,
  public_visible boolean NOT NULL,
  source_version bigint NOT NULL CHECK(source_version>=1),
  indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(offering_id,clinic_id,branch_id),
  FOREIGN KEY(branch_id) REFERENCES search_v2.public_branches(branch_id) ON DELETE CASCADE
);
CREATE INDEX idx_search_offering_text ON search_v2.public_offerings(clinic_id,branch_id,public_visible);

CREATE TABLE search_v2.projection_receipts (
  source varchar(80) NOT NULL,
  aggregate_type varchar(60) NOT NULL,
  aggregate_id uuid NOT NULL,
  source_version bigint NOT NULL CHECK(source_version>=1),
  event_id uuid,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(source,aggregate_type,aggregate_id)
);
