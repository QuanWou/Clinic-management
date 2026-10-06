-- Canonical staff roles for the accepted four-role academic scope.
-- PATIENT is an authenticated account with its own patient relationship,
-- not a clinic staff membership. Keep original membership IDs and events.
ALTER TABLE iam.memberships ADD COLUMN clinic_owner boolean NOT NULL DEFAULT false;
ALTER TABLE iam.memberships DROP CONSTRAINT memberships_role_check;
DROP INDEX iam.uq_membership_live_role;
DROP INDEX iam.uq_clinic_live_owner;

CREATE TEMP TABLE original_membership_roles ON COMMIT DROP AS
SELECT id, role, status FROM iam.memberships;

UPDATE iam.memberships SET clinic_owner = true WHERE role = 'CLINIC_OWNER';

-- Removing nursing from scope must not silently grant clinical doctor access.
UPDATE iam.memberships SET status = 'REVOKED', revoked_at = now(),
    revoke_reason = 'Nursing role retired from academic scope; explicit reassignment required',
    version = version + 1, updated_at = now()
WHERE role = 'NURSE' AND status <> 'REVOKED';
UPDATE iam.membership_branch_grants g SET active = false, revoked_at = now()
FROM original_membership_roles old WHERE g.membership_id = old.id AND old.role = 'NURSE' AND g.active;

UPDATE iam.memberships SET role = CASE role
    WHEN 'CLINIC_OWNER' THEN 'ADMIN' WHEN 'CLINIC_MANAGER' THEN 'ADMIN'
    WHEN 'RECEPTIONIST' THEN 'STAFF' WHEN 'CASHIER' THEN 'STAFF'
    WHEN 'LAB' THEN 'DOCTOR' WHEN 'NURSE' THEN 'DOCTOR' ELSE role END,
    version = version + 1, updated_at = now()
WHERE role <> 'DOCTOR';

CREATE TEMP TABLE membership_role_merges ON COMMIT DROP AS
SELECT id AS duplicate_id, survivor_id FROM (
    SELECT id, first_value(id) OVER grouped AS survivor_id,
           row_number() OVER grouped AS position
    FROM iam.memberships WHERE status <> 'REVOKED'
    WINDOW grouped AS (PARTITION BY user_id, clinic_id, role
        ORDER BY clinic_owner DESC, (status = 'ACTIVE') DESC, invited_at, id)
) ranked WHERE position > 1;

-- Only merge grants of the same activation status: an unaccepted invitation
-- must never enlarge an already-active membership.
UPDATE iam.memberships survivor SET all_branches = true,
    version = survivor.version + 1, updated_at = now()
FROM membership_role_merges merge, iam.memberships duplicate
WHERE survivor.id = merge.survivor_id AND duplicate.id = merge.duplicate_id
  AND duplicate.status = survivor.status AND duplicate.all_branches;

INSERT INTO iam.membership_branch_grants
    (id,membership_id,user_id,clinic_id,branch_id,active,granted_by,granted_at)
SELECT DISTINCT ON (merge.survivor_id,g.branch_id)
    gen_random_uuid(),merge.survivor_id,survivor.user_id,survivor.clinic_id,
    g.branch_id,true,g.granted_by,g.granted_at
FROM membership_role_merges merge
JOIN iam.memberships duplicate ON duplicate.id = merge.duplicate_id
JOIN iam.memberships survivor ON survivor.id = merge.survivor_id AND survivor.status = duplicate.status
JOIN iam.membership_branch_grants g ON g.membership_id = duplicate.id AND g.active
ORDER BY merge.survivor_id,g.branch_id,g.granted_at
ON CONFLICT (membership_id,branch_id) DO UPDATE SET active = true, revoked_by = NULL, revoked_at = NULL;

UPDATE iam.memberships duplicate SET status = 'REVOKED', revoked_at = now(),
    revoke_reason = 'Consolidated into canonical membership ' || merge.survivor_id::text,
    version = duplicate.version + 1, updated_at = now()
FROM membership_role_merges merge WHERE duplicate.id = merge.duplicate_id;
UPDATE iam.membership_branch_grants g SET active = false, revoked_at = now()
FROM membership_role_merges merge WHERE g.membership_id = merge.duplicate_id AND g.active;

INSERT INTO iam.membership_events (id,clinic_id,membership_id,actor_user_id,target_user_id,action,reason)
SELECT gen_random_uuid(),m.clinic_id,m.id,'00000000-0000-0000-0000-000000000000',m.user_id,
    'ACADEMIC_ROLE_MIGRATED', 'Migration V2: ' || old.role || ' -> ' || m.role || '; ' || old.status || ' -> ' || m.status
FROM iam.memberships m JOIN original_membership_roles old ON old.id = m.id
WHERE old.role <> m.role OR old.status <> m.status;

ALTER TABLE iam.memberships ADD CONSTRAINT memberships_role_check CHECK (role IN ('ADMIN','STAFF','DOCTOR'));
ALTER TABLE iam.memberships ADD CONSTRAINT membership_owner_is_admin CHECK (NOT clinic_owner OR role = 'ADMIN');
CREATE UNIQUE INDEX uq_membership_live_role ON iam.memberships(user_id,clinic_id,role) WHERE status <> 'REVOKED';
CREATE UNIQUE INDEX uq_clinic_live_owner ON iam.memberships(clinic_id) WHERE clinic_owner AND status <> 'REVOKED';
