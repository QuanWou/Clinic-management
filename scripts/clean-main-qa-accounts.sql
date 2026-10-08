-- Reviewed account IDs for the user's request to remove QA/test patient accounts.
-- Authored clinical/audit history and clinic/doctor configuration remain historical records.
-- Execute with ON_ERROR_STOP and apply=false before apply=true; take a verified backup first.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE TEMP TABLE qa_accounts(id uuid PRIMARY KEY);
INSERT INTO qa_accounts VALUES
('b807e63a-dbc6-4391-b860-2d669790500e'),
('95d19ad0-b370-42e4-959a-9d0dd59906df'),
('8951fa5b-7633-43f7-b39b-bd7218dda5c6'),
('e40be136-0451-4484-b3dd-619b1290e4b0'),
('1b593905-bd50-4ad2-b7e3-a2ef11bede10'),
('9c7eea74-ce10-44d7-bddf-4d28035d7e61'),
('99ba414f-6251-402b-843d-8dc80969100d'),
('dcb8c546-4e43-4ffe-ae31-0575bf344f6e'),
('1f529ffb-7e7a-4aa1-9a24-3ac05351f838'),
('39298bbf-94e2-457c-b10b-12028c2d7f05');

-- Freeze writes in this transaction, including background token/notification writes.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables
 WHERE schemaname<>'information_schema' AND schemaname NOT LIKE 'pg_%'
 ORDER BY schemaname,tablename LOOP
  EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.schemaname,r.tablename);
 END LOOP;
 IF (SELECT count(*) FROM identity.users WHERE id IN(SELECT id FROM qa_accounts))<>10
 THEN RAISE EXCEPTION 'Expected exactly the ten reviewed QA accounts'; END IF;
 IF EXISTS(SELECT 1 FROM identity.users u JOIN qa_accounts q USING(id)
  WHERE u.full_name !~* '(^QA([ -]|$)|^Clinic QA Patient$|^Ki.m th.)')
 THEN RAISE EXCEPTION 'Manifest contains a non-test name'; END IF;
 IF EXISTS(SELECT 1 FROM identity.user_roles ur JOIN identity.roles role_row ON role_row.id=ur.role_id
  WHERE ur.user_id IN(SELECT id FROM qa_accounts) AND role_row.code<>'ROLE_PATIENT')
 THEN RAISE EXCEPTION 'Manifest contains a legacy staff account'; END IF;
 IF EXISTS(SELECT 1 FROM iam.memberships WHERE user_id IN(SELECT id FROM qa_accounts)
  AND status='ACTIVE' AND clinic_id='03136db2-48e0-4320-bbdd-5c49e24b6db3')
 THEN RAISE EXCEPTION 'Manifest contains active operational staff'; END IF;
 IF EXISTS(SELECT 1 FROM clinic.clinics WHERE owner_user_id IN(SELECT id FROM qa_accounts)
  AND (id='03136db2-48e0-4320-bbdd-5c49e24b6db3' OR name !~* '^QA'))
 THEN RAISE EXCEPTION 'Manifest contains an operational clinic owner'; END IF;
 IF EXISTS(SELECT 1 FROM patient_v2.platform_user_patient_links WHERE user_id IN(SELECT id FROM qa_accounts))
 THEN RAISE EXCEPTION 'Linked patient profile requires a separately reviewed clinical cleanup'; END IF;
END $$;

CREATE TEMP TABLE qa_legacy_patients AS
 SELECT id FROM patient.patients WHERE user_id IN(SELECT id FROM qa_accounts);
DO $$ DECLARE r record; n bigint; BEGIN
 FOR r IN SELECT ns.nspname,c.relname,a.attname FROM pg_attribute a
 JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace
 WHERE c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped AND a.atttypid='uuid'::regtype
 AND ns.nspname NOT LIKE 'pg_%' AND ns.nspname<>'information_schema' AND a.attname='patient_id' LOOP
  EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN(SELECT id FROM qa_legacy_patients)',r.nspname,r.relname,r.attname) INTO n;
  IF n>0 THEN RAISE EXCEPTION 'Legacy patient has dependent clinical records in %.%',r.nspname,r.relname; END IF;
 END LOOP;
END $$;

CREATE TEMP TABLE qa_plan(seq serial,relation text PRIMARY KEY,predicate text);
INSERT INTO qa_plan(relation,predicate) VALUES
('identity.refresh_tokens','user_id IN(SELECT id FROM qa_accounts)'),
('identity.admin_audit','actor_user_id IN(SELECT id FROM qa_accounts) OR target_user_id IN(SELECT id FROM qa_accounts)'),
('identity.user_roles','user_id IN(SELECT id FROM qa_accounts)'),
('iam.membership_branch_grants','user_id IN(SELECT id FROM qa_accounts)'),
('iam.user_security_state','user_id IN(SELECT id FROM qa_accounts)'),
('iam.memberships','user_id IN(SELECT id FROM qa_accounts)'),
('notification.notification_preferences','user_id IN(SELECT id FROM qa_accounts)'),
('notification.notifications','recipient_user_id IN(SELECT id FROM qa_accounts)'),
('notification_v2.preferences','user_id IN(SELECT id FROM qa_accounts)'),
('notification_v2.notifications','user_id IN(SELECT id FROM qa_accounts)'),
('patient.patients','id IN(SELECT id FROM qa_legacy_patients)'),
('identity.users','id IN(SELECT id FROM qa_accounts)');

CREATE TEMP TABLE qa_targets(relation text,row_tid tid,PRIMARY KEY(relation,row_tid));
CREATE TEMP TABLE qa_preserved(relation text PRIMARY KEY,row_count bigint,digest text);
CREATE TEMP TABLE qa_removed(relation text PRIMARY KEY,row_count bigint);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT * FROM qa_plan ORDER BY seq LOOP
  EXECUTE format('INSERT INTO qa_targets SELECT %L,ctid FROM %s WHERE %s',r.relation,r.relation,r.predicate);
 END LOOP;
 FOR r IN SELECT schemaname||'.'||tablename relation FROM pg_tables
 WHERE schemaname<>'information_schema' AND schemaname NOT LIKE 'pg_%' LOOP
  EXECUTE format('INSERT INTO qa_preserved SELECT %L,count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %s t WHERE NOT EXISTS(SELECT 1 FROM qa_targets q WHERE q.relation=%L AND q.row_tid=t.ctid)',r.relation,r.relation,r.relation);
 END LOOP;
END $$;
SELECT relation,count(*) planned_rows FROM qa_targets GROUP BY relation ORDER BY relation;

DO $$ DECLARE r record; n bigint; actual_count bigint; actual_digest text; BEGIN
 FOR r IN SELECT * FROM qa_plan ORDER BY seq LOOP
  EXECUTE format('DELETE FROM %s t USING qa_targets q WHERE q.relation=%L AND q.row_tid=t.ctid',r.relation,r.relation);
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n<>(SELECT count(*) FROM qa_targets WHERE relation=r.relation) THEN RAISE EXCEPTION 'Delete count mismatch: %',r.relation; END IF;
  INSERT INTO qa_removed VALUES(r.relation,n);
 END LOOP;
 FOR r IN SELECT * FROM qa_preserved LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %s t',r.relation) INTO actual_count,actual_digest;
  IF actual_count<>r.row_count OR actual_digest<>r.digest THEN RAISE EXCEPTION 'Preserved data changed: %',r.relation; END IF;
 END LOOP;
END $$;
SELECT relation,row_count deleted_rows FROM qa_removed WHERE row_count>0 ORDER BY relation;
SELECT count(*) preserved_tables_verified FROM qa_preserved;
SELECT count(*) remaining_reviewed_accounts FROM identity.users WHERE id IN(SELECT id FROM qa_accounts);
\if :apply
COMMIT;
\else
ROLLBACK;
\endif
