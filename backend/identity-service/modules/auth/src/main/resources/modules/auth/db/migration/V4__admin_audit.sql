-- Production already applied V3__seed_local_admin_user.sql. Never replace that history.
-- Other lineages may have applied the audit migration as V3; accept only these known values.
DO $$
BEGIN
    -- Identity V1 and V2 must be the exact audited migrations, even where
    -- Flyway's normal validation is disabled solely for the legacy V3 conflict.
    IF (
        SELECT count(*) FROM identity.flyway_schema_history
        WHERE success = TRUE AND (
            (version = '1' AND checksum = -1887348813)
            OR (version = '2' AND checksum = 1629767021)
        )
    ) <> 2 THEN
        RAISE EXCEPTION 'Unknown identity V1/V2 migration history; refusing to upgrade';
    END IF;

    IF EXISTS (
        SELECT 1 FROM identity.flyway_schema_history
        WHERE version = '3'
          AND NOT (
              (description = 'seed local admin user' AND checksum = 881842750)
              OR (description = 'admin audit' AND checksum = 1702430032)
          )
    ) THEN
        RAISE EXCEPTION 'Unknown identity V3 migration; refusing to upgrade';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS identity.admin_audit (
    id UUID PRIMARY KEY,
    actor_user_id UUID NOT NULL REFERENCES identity.users(id),
    target_user_id UUID NOT NULL REFERENCES identity.users(id),
    action VARCHAR(40) NOT NULL,
    old_value VARCHAR(1000),
    new_value VARCHAR(1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target_created ON identity.admin_audit (target_user_id, created_at DESC);