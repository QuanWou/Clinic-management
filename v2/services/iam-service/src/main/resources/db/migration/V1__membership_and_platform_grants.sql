CREATE SCHEMA IF NOT EXISTS iam;

CREATE TABLE iam.memberships (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  role varchar(40) NOT NULL CHECK (role IN ('CLINIC_OWNER','CLINIC_MANAGER','RECEPTIONIST','CASHIER','DOCTOR','NURSE','LAB')),
  status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  all_branches boolean NOT NULL DEFAULT false,
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid NOT NULL,
  revoked_by uuid,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id,clinic_id,role),
  UNIQUE (id,clinic_id),
  CHECK ((status='ACTIVE' AND revoked_at IS NULL) OR status='REVOKED')
);
CREATE INDEX idx_membership_user_active ON iam.memberships(user_id,clinic_id,status);
CREATE INDEX idx_membership_clinic_active ON iam.memberships(clinic_id,status);

CREATE TABLE iam.membership_branch_grants (
  membership_id uuid NOT NULL,
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (membership_id,branch_id),
  FOREIGN KEY (membership_id,clinic_id) REFERENCES iam.memberships(id,clinic_id) ON DELETE CASCADE
);
CREATE INDEX idx_branch_grant_scope ON iam.membership_branch_grants(clinic_id,branch_id);

CREATE TABLE iam.platform_grants (
  user_id uuid NOT NULL,
  capability varchar(60) NOT NULL CHECK (capability IN ('PLATFORM_CLINIC_REVIEW','PLATFORM_SUPPORT','PLATFORM_SECURITY_AUDIT')),
  status varchar(16) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','REVOKED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  granted_by varchar(100) NOT NULL,
  revoked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,capability)
);

CREATE TABLE iam.security_events (
  id uuid PRIMARY KEY,
  actor_user_id uuid,
  workload_subject varchar(100),
  target_user_id uuid,
  clinic_id uuid,
  membership_id uuid,
  action varchar(60) NOT NULL,
  reason varchar(500) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_iam_events_clinic_time ON iam.security_events(clinic_id,occurred_at DESC);
CREATE INDEX idx_iam_events_target_time ON iam.security_events(target_user_id,occurred_at DESC);
