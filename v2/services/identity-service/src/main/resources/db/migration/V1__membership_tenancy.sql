CREATE SCHEMA IF NOT EXISTS iam;
CREATE SCHEMA IF NOT EXISTS app_security;

CREATE OR REPLACE FUNCTION app_security.current_user_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_security.current_clinic_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.clinic_id', true), '')::uuid
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_iam_runtime') THEN
    CREATE ROLE clinic_v2_iam_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END $$;

CREATE TABLE iam.memberships (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    role varchar(32) NOT NULL CHECK (role IN ('CLINIC_OWNER','CLINIC_MANAGER','RECEPTIONIST','CASHIER','DOCTOR','NURSE','LAB')),
    status varchar(16) NOT NULL CHECK (status IN ('INVITED','ACTIVE','REVOKED')),
    all_branches boolean NOT NULL DEFAULT false,
    version bigint NOT NULL DEFAULT 0,
    invited_by uuid NOT NULL,
    invited_at timestamptz NOT NULL DEFAULT now(),
    activated_at timestamptz,
    revoked_at timestamptz,
    revoked_by uuid,
    revoke_reason varchar(500),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, clinic_id, user_id)
);

CREATE UNIQUE INDEX uq_membership_live_role
  ON iam.memberships(user_id,clinic_id,role) WHERE status <> 'REVOKED';
CREATE UNIQUE INDEX uq_clinic_live_owner
  ON iam.memberships(clinic_id) WHERE role='CLINIC_OWNER' AND status <> 'REVOKED';
CREATE INDEX idx_membership_user_status ON iam.memberships(user_id,status);
CREATE INDEX idx_membership_clinic_status ON iam.memberships(clinic_id,status);

CREATE TABLE iam.membership_branch_grants (
    id uuid PRIMARY KEY,
    membership_id uuid NOT NULL,
    user_id uuid NOT NULL,
    clinic_id uuid NOT NULL,
    branch_id uuid NOT NULL,
    active boolean NOT NULL DEFAULT true,
    granted_by uuid NOT NULL,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_by uuid,
    revoked_at timestamptz,
    CONSTRAINT fk_branch_grant_membership
      FOREIGN KEY (membership_id,clinic_id,user_id) REFERENCES iam.memberships(id,clinic_id,user_id),
    UNIQUE (membership_id,branch_id)
);
CREATE INDEX idx_branch_grant_user ON iam.membership_branch_grants(user_id,clinic_id,active);
CREATE INDEX idx_branch_grant_branch ON iam.membership_branch_grants(clinic_id,branch_id,active);

CREATE TABLE iam.user_security_state (
    user_id uuid PRIMARY KEY,
    invalid_before timestamptz,
    version bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE iam.platform_operators (
    user_id uuid PRIMARY KEY,
    active boolean NOT NULL DEFAULT true,
    version bigint NOT NULL DEFAULT 0,
    granted_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz
);

CREATE TABLE iam.membership_events (
    id uuid PRIMARY KEY,
    clinic_id uuid NOT NULL,
    membership_id uuid,
    actor_user_id uuid NOT NULL,
    target_user_id uuid NOT NULL,
    action varchar(40) NOT NULL,
    reason varchar(500) NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_membership_event_clinic ON iam.membership_events(clinic_id,occurred_at DESC);

ALTER TABLE iam.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_scope ON iam.memberships
  FOR ALL TO clinic_v2_iam_runtime
  USING ((app_security.current_clinic_id() IS NOT NULL AND clinic_id = app_security.current_clinic_id())
      OR (app_security.current_clinic_id() IS NULL AND user_id = app_security.current_user_id()))
  WITH CHECK ((app_security.current_clinic_id() IS NOT NULL AND clinic_id = app_security.current_clinic_id())
      OR (app_security.current_clinic_id() IS NULL AND user_id = app_security.current_user_id()));

ALTER TABLE iam.membership_branch_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership_branch_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY branch_grant_scope ON iam.membership_branch_grants
  FOR ALL TO clinic_v2_iam_runtime
  USING ((app_security.current_clinic_id() IS NOT NULL AND clinic_id = app_security.current_clinic_id())
      OR (app_security.current_clinic_id() IS NULL AND user_id = app_security.current_user_id()))
  WITH CHECK ((app_security.current_clinic_id() IS NOT NULL AND clinic_id = app_security.current_clinic_id())
      OR (app_security.current_clinic_id() IS NULL AND user_id = app_security.current_user_id()));

ALTER TABLE iam.user_security_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.user_security_state FORCE ROW LEVEL SECURITY;
CREATE POLICY user_security_self ON iam.user_security_state
  FOR ALL TO clinic_v2_iam_runtime
  USING (user_id = app_security.current_user_id())
  WITH CHECK (user_id = app_security.current_user_id());

ALTER TABLE iam.membership_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE iam.membership_events FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_event_scope ON iam.membership_events
  FOR SELECT TO clinic_v2_iam_runtime
  USING ((app_security.current_clinic_id() IS NOT NULL AND clinic_id = app_security.current_clinic_id())
      OR (app_security.current_clinic_id() IS NULL AND
          (actor_user_id = app_security.current_user_id() OR target_user_id = app_security.current_user_id())));
CREATE POLICY membership_event_insert ON iam.membership_events
  FOR INSERT TO clinic_v2_iam_runtime
  WITH CHECK (actor_user_id = app_security.current_user_id()
      AND clinic_id = app_security.current_clinic_id());

REVOKE ALL ON SCHEMA iam FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA iam FROM PUBLIC;
GRANT USAGE ON SCHEMA iam, app_security TO clinic_v2_iam_runtime;
GRANT EXECUTE ON FUNCTION app_security.current_user_id(), app_security.current_clinic_id() TO clinic_v2_iam_runtime;
GRANT SELECT,INSERT,UPDATE ON iam.memberships,iam.membership_branch_grants,iam.user_security_state,iam.membership_events TO clinic_v2_iam_runtime;
GRANT SELECT ON iam.platform_operators TO clinic_v2_iam_runtime;
