CREATE TABLE identity.admin_audit (
    id UUID PRIMARY KEY,
    actor_user_id UUID NOT NULL REFERENCES identity.users(id),
    target_user_id UUID NOT NULL REFERENCES identity.users(id),
    action VARCHAR(40) NOT NULL,
    old_value VARCHAR(1000),
    new_value VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admin_audit_target_created ON identity.admin_audit (target_user_id, created_at DESC);