CREATE SCHEMA IF NOT EXISTS doctor;
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE doctor.practitioners (
    id uuid PRIMARY KEY,
    platform_user_id uuid NOT NULL UNIQUE,
    display_name varchar(180) NOT NULL,
    registration_code varchar(100),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    row_version bigint NOT NULL DEFAULT 0
);

CREATE TABLE doctor.doctor_affiliations (
    id uuid PRIMARY KEY,
    practitioner_id uuid NOT NULL REFERENCES doctor.practitioners(id),
    clinic_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    specialty_code varchar(60) NOT NULL,
    specialty_name varchar(160) NOT NULL,
    professional_title varchar(120),
    public_visible boolean NOT NULL DEFAULT false,
    effective_from date NOT NULL,
    effective_until date,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    row_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT ck_affiliation_range CHECK (effective_until IS NULL OR effective_until > effective_from),
    CONSTRAINT uk_affiliation_scope UNIQUE (id,clinic_id,branch_id),
    EXCLUDE USING gist (
      practitioner_id WITH =,
      clinic_id WITH =,
      branch_id WITH =,
      daterange(effective_from,effective_until,'[)') WITH &&
    )
);

CREATE INDEX idx_affiliation_branch ON doctor.doctor_affiliations(clinic_id,branch_id,active);
CREATE INDEX idx_affiliation_practitioner ON doctor.doctor_affiliations(practitioner_id,clinic_id,branch_id);

CREATE TABLE doctor.working_schedules (
    id uuid PRIMARY KEY,
    affiliation_id uuid NOT NULL,
    practitioner_id uuid NOT NULL REFERENCES doctor.practitioners(id),
    clinic_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
    end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
    timezone varchar(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    effective_from date NOT NULL,
    effective_until date,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    row_version bigint NOT NULL DEFAULT 0,
    CONSTRAINT fk_schedule_affiliation_scope FOREIGN KEY (affiliation_id,clinic_id,branch_id)
      REFERENCES doctor.doctor_affiliations(id,clinic_id,branch_id),
    CONSTRAINT ck_schedule_time CHECK (start_minute < end_minute),
    CONSTRAINT ck_schedule_range CHECK (effective_until IS NULL OR effective_until > effective_from),
    EXCLUDE USING gist (
      practitioner_id WITH =,
      clinic_id WITH =,
      branch_id WITH =,
      day_of_week WITH =,
      daterange(effective_from,effective_until,'[)') WITH &&,
      int4range(start_minute,end_minute,'[)') WITH &&
    )
);

CREATE INDEX idx_schedule_branch_doctor ON doctor.working_schedules(clinic_id,branch_id,practitioner_id,day_of_week);
