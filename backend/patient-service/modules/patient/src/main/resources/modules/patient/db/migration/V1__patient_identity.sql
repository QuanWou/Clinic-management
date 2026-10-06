CREATE SCHEMA IF NOT EXISTS patient_v2;

CREATE TABLE patient_v2.patient_identities(
  id uuid PRIMARY KEY,
  full_name varchar(180) NOT NULL,
  date_of_birth date NOT NULL,
  sex varchar(20),
  phone varchar(30),
  email varchar(180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 0
);

CREATE TABLE patient_v2.platform_user_patient_links(
  user_id uuid PRIMARY KEY,
  patient_id uuid NOT NULL UNIQUE REFERENCES patient_v2.patient_identities(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE patient_v2.clinic_patient_links(
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  patient_id uuid NOT NULL REFERENCES patient_v2.patient_identities(id),
  patient_code varchar(40) NOT NULL,
  status varchar(24) NOT NULL CHECK(status IN ('PROVISIONAL','VERIFIED','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0,
  UNIQUE(clinic_id,patient_id),
  UNIQUE(clinic_id,patient_code)
);
CREATE INDEX idx_patient_link_clinic ON patient_v2.clinic_patient_links(clinic_id,status);
