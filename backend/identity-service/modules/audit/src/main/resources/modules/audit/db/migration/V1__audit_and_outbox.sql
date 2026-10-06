CREATE SCHEMA IF NOT EXISTS audit_v2;

CREATE TABLE audit_v2.audit_chain_heads (
    scope_key varchar(80) PRIMARY KEY,
    last_event_id uuid,
    last_hash varchar(64),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_v2.audit_events (
    id uuid PRIMARY KEY,
    scope_key varchar(80) NOT NULL,
    clinic_id uuid,
    branch_id uuid,
    actor_user_id uuid NOT NULL,
    delegated_actor_id uuid,
    category varchar(40) NOT NULL,
    action varchar(100) NOT NULL,
    resource_type varchar(80) NOT NULL,
    resource_id varchar(160) NOT NULL,
    outcome varchar(24) NOT NULL CHECK (outcome IN ('SUCCESS','DENIED','FAILED','PENDING')),
    reason varchar(500),
    correlation_id varchar(128) NOT NULL,
    occurred_at timestamptz NOT NULL,
    previous_hash varchar(64),
    event_hash varchar(64) NOT NULL UNIQUE,
    metadata_json text NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_scope_time ON audit_v2.audit_events(scope_key,occurred_at,id);
CREATE INDEX idx_audit_correlation ON audit_v2.audit_events(correlation_id,occurred_at,id);
CREATE INDEX idx_audit_resource ON audit_v2.audit_events(resource_type,resource_id,occurred_at);

CREATE TABLE audit_v2.outbox_events (
    id uuid PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE,
    event_json text NOT NULL,
    status varchar(20) NOT NULL DEFAULT 'PENDING'
      CHECK (status IN ('PENDING','PUBLISHED','DEAD_LETTER')),
    attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    next_attempt_at timestamptz NOT NULL DEFAULT now(),
    last_error varchar(500),
    created_at timestamptz NOT NULL DEFAULT now(),
    published_at timestamptz
);
CREATE INDEX idx_outbox_due ON audit_v2.outbox_events(status,next_attempt_at,created_at);

CREATE OR REPLACE FUNCTION audit_v2.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only audit row cannot be modified or deleted';
END $$;

CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_v2.audit_events FOR EACH ROW EXECUTE FUNCTION audit_v2.reject_mutation();
CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_v2.audit_events FOR EACH ROW EXECUTE FUNCTION audit_v2.reject_mutation();
