CREATE FUNCTION encounter_v2.current_clinic_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.clinic_id',true),'')::uuid $$;
CREATE FUNCTION encounter_v2.current_branch_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.branch_id',true),'')::uuid $$;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['service_points','visits','check_ins','queue_counters','queue_tickets','command_receipts','visit_history','outbox_events'] LOOP
  EXECUTE format('ALTER TABLE encounter_v2.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE encounter_v2.%I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY tenant_scope ON encounter_v2.%I USING(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id()) WITH CHECK(clinic_id=encounter_v2.current_clinic_id() AND branch_id=encounter_v2.current_branch_id())',table_name);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_encounter_runtime') THEN CREATE ROLE clinic_v2_encounter_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF;
END $$;
GRANT USAGE ON SCHEMA encounter_v2 TO clinic_v2_encounter_runtime;
GRANT SELECT,INSERT,UPDATE ON encounter_v2.service_points,encounter_v2.visits,encounter_v2.queue_counters,encounter_v2.queue_tickets TO clinic_v2_encounter_runtime;
GRANT SELECT,INSERT ON encounter_v2.check_ins,encounter_v2.command_receipts,encounter_v2.visit_history,encounter_v2.outbox_events TO clinic_v2_encounter_runtime;
