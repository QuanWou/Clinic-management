-- Public account identifiers are stable display keys, never authentication secrets or cross-service FKs.
-- Do not change the UUID primary keys or existing email/password credentials.
CREATE SEQUENCE identity.account_code_seq AS BIGINT START WITH 1;
ALTER TABLE identity.users ADD COLUMN account_code VARCHAR(24);

WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM identity.users
)
UPDATE identity.users u SET account_code = 'TK' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE u.id = numbered.id;

SELECT setval('identity.account_code_seq',
              COALESCE((SELECT max(substring(account_code FROM 3)::bigint) FROM identity.users), 0) + 1,
              false);

CREATE FUNCTION identity.next_account_code() RETURNS VARCHAR(24)
LANGUAGE SQL VOLATILE AS $$
    SELECT 'TK' || lpad(v::text, greatest(6, length(v::text)), '0')
    FROM (SELECT nextval('identity.account_code_seq') AS v) generated;
$$;
ALTER TABLE identity.users ALTER COLUMN account_code SET DEFAULT identity.next_account_code();
ALTER TABLE identity.users ALTER COLUMN account_code SET NOT NULL;
ALTER TABLE identity.users ADD CONSTRAINT uq_identity_account_code UNIQUE (account_code);
ALTER TABLE identity.users ADD CONSTRAINT ck_identity_account_code CHECK (account_code ~ '^TK[0-9]{6,}$');
