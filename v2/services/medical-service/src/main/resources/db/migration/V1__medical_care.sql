CREATE SCHEMA IF NOT EXISTS medical_v2;
CREATE TABLE medical_v2.cases(
 encounter_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,patient_id uuid NOT NULL,doctor_id uuid NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','VALIDATED')),
 row_version bigint NOT NULL DEFAULT 0,document_version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(encounter_id,clinic_id,branch_id));
CREATE TABLE medical_v2.document_versions(
 id uuid PRIMARY KEY,encounter_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,version bigint NOT NULL,
 content_json text NOT NULL,content_hash varchar(64) NOT NULL,author_user_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(encounter_id,version),FOREIGN KEY(encounter_id,clinic_id,branch_id) REFERENCES medical_v2.cases(encounter_id,clinic_id,branch_id));
CREATE TABLE medical_v2.orders(
 id uuid PRIMARY KEY,encounter_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,offering_id uuid NOT NULL,
 name varchar(220) NOT NULL,price_snapshot_json text NOT NULL,ordered_by uuid NOT NULL,accepted_by uuid,
 state varchar(24) NOT NULL CHECK(state IN ('ORDERED','ACCEPTED','PROCESSING','RESULTED','REVIEWED','REJECTED','CANCELLED')),
 row_version bigint NOT NULL DEFAULT 0,result_version bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(encounter_id,clinic_id,branch_id) REFERENCES medical_v2.cases(encounter_id,clinic_id,branch_id),UNIQUE(id,clinic_id,branch_id));
CREATE TABLE medical_v2.results(
 id uuid PRIMARY KEY,order_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,version bigint NOT NULL,
 author_user_id uuid NOT NULL,source_ref varchar(200) NOT NULL,content text NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
 content_hash varchar(64) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(order_id,version),
 FOREIGN KEY(order_id,clinic_id,branch_id) REFERENCES medical_v2.orders(id,clinic_id,branch_id));
CREATE TABLE medical_v2.reviews(
 id uuid PRIMARY KEY,order_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,result_id uuid NOT NULL,
 author_user_id uuid NOT NULL,reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(result_id),
 FOREIGN KEY(order_id,clinic_id,branch_id) REFERENCES medical_v2.orders(id,clinic_id,branch_id),
 FOREIGN KEY(result_id) REFERENCES medical_v2.results(id));
CREATE TABLE medical_v2.commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,operation varchar(60) NOT NULL,
 key varchar(120) NOT NULL,payload_hash varchar(64) NOT NULL,resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,operation,key));
CREATE TABLE medical_v2.history(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,encounter_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 action varchar(60) NOT NULL,reason varchar(500) NOT NULL,resource_id uuid NOT NULL,version bigint NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(encounter_id,clinic_id,branch_id) REFERENCES medical_v2.cases(encounter_id,clinic_id,branch_id));
CREATE TABLE medical_v2.outbox_events(
 event_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,aggregate_id uuid NOT NULL,event_type varchar(100) NOT NULL,
 payload_json text NOT NULL,status varchar(24) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),
 published_at timestamptz,last_error varchar(120));
CREATE INDEX lab_worklist ON medical_v2.orders(clinic_id,branch_id,state,created_at);
CREATE INDEX case_orders ON medical_v2.orders(encounter_id,created_at);
CREATE FUNCTION medical_v2.current_clinic_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.clinic_id',true),'')::uuid $$;
CREATE FUNCTION medical_v2.current_branch_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.branch_id',true),'')::uuid $$;
DO $$ DECLARE table_name text; BEGIN
 FOREACH table_name IN ARRAY ARRAY['cases','document_versions','orders','results','reviews','commands','history','outbox_events'] LOOP
  EXECUTE format('ALTER TABLE medical_v2.%I ENABLE ROW LEVEL SECURITY',table_name);
  EXECUTE format('ALTER TABLE medical_v2.%I FORCE ROW LEVEL SECURITY',table_name);
  EXECUTE format('CREATE POLICY tenant_scope ON medical_v2.%I USING(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id()) WITH CHECK(clinic_id=medical_v2.current_clinic_id() AND branch_id=medical_v2.current_branch_id())',table_name);
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='clinic_v2_medical_runtime') THEN CREATE ROLE clinic_v2_medical_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE; END IF;
END $$;
GRANT USAGE ON SCHEMA medical_v2 TO clinic_v2_medical_runtime;
GRANT SELECT,INSERT,UPDATE ON medical_v2.cases,medical_v2.orders TO clinic_v2_medical_runtime;
GRANT SELECT,INSERT ON medical_v2.document_versions,medical_v2.results,medical_v2.reviews,medical_v2.commands,medical_v2.history,medical_v2.outbox_events TO clinic_v2_medical_runtime;
GRANT UPDATE(status,attempts,next_attempt_at,published_at,last_error) ON medical_v2.outbox_events TO clinic_v2_medical_runtime;
CREATE POLICY relay_delivery ON medical_v2.outbox_events USING(current_setting('app.medical_mode',true)='relay') WITH CHECK(current_setting('app.medical_mode',true)='relay');
