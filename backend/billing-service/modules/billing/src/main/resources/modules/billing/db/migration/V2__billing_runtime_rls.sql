CREATE FUNCTION billing_v2.current_clinic_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.clinic_id',true),'')::uuid $$;
CREATE FUNCTION billing_v2.current_branch_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.branch_id',true),'')::uuid $$;
DO $$ DECLARE task_table text; BEGIN
 FOREACH task_table IN ARRAY ARRAY['bills','charges','bill_lines','shifts','payments','adjustments','journals','journal_lines','commands','history','outbox_events'] LOOP
  EXECUTE format('ALTER TABLE billing_v2.%I ENABLE ROW LEVEL SECURITY',task_table);
  EXECUTE format('ALTER TABLE billing_v2.%I FORCE ROW LEVEL SECURITY',task_table);
  EXECUTE format('CREATE POLICY tenant_scope ON billing_v2.%I USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id()) WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id())',task_table);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_billing_runtime') THEN CREATE ROLE clinic_v2_billing_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF;
END $$;
GRANT USAGE ON SCHEMA billing_v2 TO clinic_v2_billing_runtime;
GRANT SELECT,INSERT,UPDATE ON billing_v2.bills,billing_v2.shifts TO clinic_v2_billing_runtime;
GRANT SELECT,INSERT ON billing_v2.charges,billing_v2.bill_lines,billing_v2.payments,billing_v2.adjustments,billing_v2.journal_lines,billing_v2.commands,billing_v2.history,billing_v2.outbox_events TO clinic_v2_billing_runtime;
GRANT SELECT ON billing_v2.journals TO clinic_v2_billing_runtime;
GRANT INSERT(id,clinic_id,branch_id,source_type,source_id,actor_user_id,reason) ON billing_v2.journals TO clinic_v2_billing_runtime;
CREATE POLICY relay_read ON billing_v2.outbox_events FOR SELECT USING(current_setting('app.billing_mode',true)='relay');
CREATE POLICY relay_update ON billing_v2.outbox_events FOR UPDATE USING(current_setting('app.billing_mode',true)='relay') WITH CHECK(current_setting('app.billing_mode',true)='relay');
GRANT UPDATE(status,attempts,next_attempt_at,published_at,last_error) ON billing_v2.outbox_events TO clinic_v2_billing_runtime;
