CREATE SCHEMA IF NOT EXISTS encounter_v2;
CREATE TABLE encounter_v2.service_points(
 id uuid PRIMARY KEY, clinic_id uuid NOT NULL, branch_id uuid NOT NULL,
 code varchar(8) NOT NULL CHECK(code ~ '^[A-Z0-9]{1,8}$'), name varchar(100) NOT NULL,
 active boolean NOT NULL DEFAULT true, UNIQUE(clinic_id,branch_id,code), UNIQUE(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.visits(
 id uuid PRIMARY KEY, clinic_id uuid NOT NULL, branch_id uuid NOT NULL, patient_id uuid NOT NULL,
 clinic_patient_link_id uuid NOT NULL, appointment_id uuid, doctor_id uuid NOT NULL, doctor_user_id uuid NOT NULL, service_point_id uuid NOT NULL,
 status varchar(32) NOT NULL CHECK(status IN ('ARRIVAL_PENDING','WAITING','IN_PROGRESS','AWAITING_RESULTS','CLINICALLY_COMPLETED','CLOSED','CANCELLED','INTERRUPTED')),
 created_at timestamptz NOT NULL DEFAULT now(), checked_in_at timestamptz, row_version bigint NOT NULL DEFAULT 0,
 UNIQUE(clinic_id,appointment_id), UNIQUE(id,clinic_id,branch_id),
 FOREIGN KEY(service_point_id,clinic_id,branch_id) REFERENCES encounter_v2.service_points(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.check_ins(
 visit_id uuid PRIMARY KEY, clinic_id uuid NOT NULL, branch_id uuid NOT NULL, actor_user_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.queue_counters(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,service_point_id uuid NOT NULL,queue_date date NOT NULL,value integer NOT NULL CHECK(value>0),
 PRIMARY KEY(clinic_id,branch_id,service_point_id,queue_date),
 FOREIGN KEY(service_point_id,clinic_id,branch_id) REFERENCES encounter_v2.service_points(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.queue_tickets(
 id uuid PRIMARY KEY,visit_id uuid NOT NULL,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,service_point_id uuid NOT NULL,
 queue_date date NOT NULL,number integer NOT NULL CHECK(number>0),code varchar(40) NOT NULL,
 state varchar(24) NOT NULL CHECK(state IN ('WAITING','CALLED','SERVING','DONE','SKIPPED','TRANSFERRED','CANCELLED')),
 row_version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id),
 FOREIGN KEY(service_point_id,clinic_id,branch_id) REFERENCES encounter_v2.service_points(id,clinic_id,branch_id),
 UNIQUE(clinic_id,branch_id,service_point_id,queue_date,number));
CREATE UNIQUE INDEX one_active_ticket_per_visit ON encounter_v2.queue_tickets(visit_id) WHERE state IN ('WAITING','CALLED','SERVING');
CREATE UNIQUE INDEX one_served_ticket_per_point ON encounter_v2.queue_tickets(service_point_id,queue_date) WHERE state IN ('CALLED','SERVING');
CREATE TABLE encounter_v2.command_receipts(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,operation varchar(32) NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,visit_id uuid NOT NULL,service_point_id uuid NOT NULL,
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,operation,key),
 FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.visit_history(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,visit_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 action varchar(40) NOT NULL,reason varchar(500) NOT NULL,from_state varchar(32),to_state varchar(32),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(visit_id,clinic_id,branch_id) REFERENCES encounter_v2.visits(id,clinic_id,branch_id));
CREATE TABLE encounter_v2.outbox_events(
 event_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,aggregate_id uuid NOT NULL,event_type varchar(100) NOT NULL,
 payload_json text NOT NULL,status varchar(24) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','DLQ')),
 attempts integer NOT NULL DEFAULT 0,next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now());
