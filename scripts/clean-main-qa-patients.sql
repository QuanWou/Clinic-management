-- One-time, reviewed QA manifest. Never select deletion targets by name alone.
-- Run with psql -v ON_ERROR_STOP=1 -v apply=false first, then apply=true.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';
CREATE TEMP TABLE qa_patients(id uuid PRIMARY KEY);
INSERT INTO qa_patients VALUES
('0408b959-b482-4c60-889c-996a08302440'),
('2284078a-8383-4874-8312-20eee355d2a1'),
('95643d22-1450-4079-8b11-cf216060eedd'),
('7de5f2c5-21dd-42b9-a89d-a686d5e446a5'),
('69671295-b617-4bb4-b6af-df56caf9b0b3'),
('51e3552e-bb7b-4ab5-8643-3642d3aee43c'),
('5262d6be-add6-41a0-9010-3e3d76ff1305'),
('9365e95d-ffcf-4afb-8415-a274127d2eaa'),
('363e0638-1a7f-4c1d-ac4c-38db0e1c2492'),
('cbbeb73c-0bf8-4d75-b593-0a208b4af17c'),
('aa4e4baf-2d8d-4c3f-a124-10ddf5d4954d'),
('6216c922-d3bb-48c2-bfdf-ee183daa05fd');
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM patient_v2.patient_identities p JOIN qa_patients q USING(id)
   WHERE p.full_name !~* '(^QA([ -]|$)|^Clinic QA Patient$)') THEN RAISE EXCEPTION 'Manifest contains a non-QA identity'; END IF;
 IF EXISTS(SELECT 1 FROM patient_v2.clinic_patient_links l JOIN qa_patients q ON q.id=l.patient_id
   WHERE l.clinic_id <> '03136db2-48e0-4320-bbdd-5c49e24b6db3') THEN RAISE EXCEPTION 'Unexpected clinic'; END IF;
END $$;
CREATE TEMP TABLE qa_appointments AS SELECT id FROM appointment_v2.appointments WHERE patient_id IN(SELECT id FROM qa_patients);
CREATE TEMP TABLE qa_visits AS SELECT id FROM encounter_v2.visits WHERE patient_id IN(SELECT id FROM qa_patients);
CREATE TEMP TABLE qa_orders AS SELECT id FROM medical_v2.orders WHERE encounter_id IN(SELECT id FROM qa_visits);
CREATE TEMP TABLE qa_bills AS SELECT id FROM billing_v2.bills WHERE patient_id IN(SELECT id FROM qa_patients);
CREATE TEMP TABLE qa_payments AS SELECT id FROM billing_v2.payments WHERE bill_id IN(SELECT id FROM qa_bills);
CREATE TEMP TABLE qa_shifts AS SELECT DISTINCT shift_id id FROM billing_v2.payments WHERE id IN(SELECT id FROM qa_payments);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM billing_v2.payments WHERE shift_id IN(SELECT id FROM qa_shifts)
   AND id NOT IN(SELECT id FROM qa_payments)) THEN RAISE EXCEPTION 'Mixed operational/QA shift; manual reconciliation required'; END IF;
END $$;
CREATE TEMP TABLE qa_resources(id uuid PRIMARY KEY);
INSERT INTO qa_resources
 SELECT id FROM qa_patients UNION SELECT id FROM qa_appointments UNION SELECT id FROM qa_visits
 UNION SELECT id FROM qa_orders UNION SELECT id FROM qa_bills UNION SELECT id FROM qa_payments
 UNION SELECT id FROM qa_shifts
 UNION SELECT id FROM billing_v2.adjustments WHERE bill_id IN(SELECT id FROM qa_bills)
 UNION SELECT id FROM billing_v2.charges WHERE encounter_id IN(SELECT id FROM qa_visits)
 UNION SELECT id FROM billing_v2.payment_intents WHERE bill_id IN(SELECT id FROM qa_bills)
 UNION SELECT id FROM medical_v2.results WHERE order_id IN(SELECT id FROM qa_orders)
 UNION SELECT id FROM medical_v2.document_versions WHERE encounter_id IN(SELECT id FROM qa_visits);
INSERT INTO qa_resources SELECT id FROM billing_v2.journals WHERE source_id IN(SELECT id FROM qa_resources) ON CONFLICT DO NOTHING;
CREATE TEMP TABLE qa_events(id uuid PRIMARY KEY);
DO $$ DECLARE s text; BEGIN
 FOREACH s IN ARRAY ARRAY['appointment_v2','encounter_v2','medical_v2','billing_v2'] LOOP
  EXECUTE format('INSERT INTO qa_events SELECT event_id FROM %I.outbox_events o WHERE aggregate_id IN(SELECT id FROM qa_resources) OR EXISTS(SELECT 1 FROM qa_resources q WHERE strpos(o.payload_json,q.id::text)>0) ON CONFLICT DO NOTHING',s);
 END LOOP;
END $$;
INSERT INTO qa_events SELECT event_id FROM billing_v2.charge_event_inbox
 WHERE patient_id IN(SELECT id FROM qa_patients) OR encounter_id IN(SELECT id FROM qa_visits) ON CONFLICT DO NOTHING;

-- Explicit child-first deletion plan. Shared staff, slots, counters, services,
-- configuration, original V1 data and immutable audit history are not targets.
CREATE TEMP TABLE qa_plan(seq serial, relation text PRIMARY KEY, predicate text);
INSERT INTO qa_plan(relation,predicate) VALUES
('notification_v2.notifications','appointment_id IN(SELECT id FROM qa_appointments) OR billing_id IN(SELECT id FROM qa_bills)'),
('notification_v2.appointment_states','appointment_id IN(SELECT id FROM qa_appointments)'),
('notification_v2.financial_event_inbox','billing_id IN(SELECT id FROM qa_bills) OR event_id IN(SELECT id FROM qa_events)'),
('notification_v2.event_inbox','event_id IN(SELECT id FROM qa_events)'),
('billing_v2.charge_recovery_commands','event_id IN(SELECT id FROM qa_events)'),
('billing_v2.charge_event_inbox','event_id IN(SELECT id FROM qa_events)'),
('billing_v2.notification_deliveries','bill_id IN(SELECT id FROM qa_bills) OR event_id IN(SELECT id FROM qa_events)'),
('billing_v2.outbox_events','event_id IN(SELECT id FROM qa_events)'),
('billing_v2.commands','resource_id IN(SELECT id FROM qa_resources)'),
('billing_v2.history','resource_id IN(SELECT id FROM qa_resources)'),
('billing_v2.journal_lines','journal_id IN(SELECT id FROM qa_resources)'),
('billing_v2.journals','id IN(SELECT id FROM qa_resources)'),
('billing_v2.payment_intents','bill_id IN(SELECT id FROM qa_bills)'),
('billing_v2.payments','id IN(SELECT id FROM qa_payments)'),
('billing_v2.adjustments','bill_id IN(SELECT id FROM qa_bills)'),
('billing_v2.bill_lines','bill_id IN(SELECT id FROM qa_bills)'),
('billing_v2.bills','id IN(SELECT id FROM qa_bills)'),
('billing_v2.charges','encounter_id IN(SELECT id FROM qa_visits)'),
('billing_v2.shifts','id IN(SELECT id FROM qa_shifts)'),
('medical_v2.charge_recovery_commands','event_id IN(SELECT id FROM qa_events)'),
('medical_v2.billing_deliveries','event_id IN(SELECT id FROM qa_events)'),
('medical_v2.outbox_events','event_id IN(SELECT id FROM qa_events)'),
('medical_v2.commands','resource_id IN(SELECT id FROM qa_resources)'),
('medical_v2.history','encounter_id IN(SELECT id FROM qa_visits)'),
('medical_v2.reviews','order_id IN(SELECT id FROM qa_orders)'),
('medical_v2.results','order_id IN(SELECT id FROM qa_orders)'),
('medical_v2.orders','id IN(SELECT id FROM qa_orders)'),
('medical_v2.document_versions','encounter_id IN(SELECT id FROM qa_visits)'),
('medical_v2.cases','patient_id IN(SELECT id FROM qa_patients)'),
('encounter_v2.charge_recovery_commands','event_id IN(SELECT id FROM qa_events)'),
('encounter_v2.billing_deliveries','event_id IN(SELECT id FROM qa_events)'),
('encounter_v2.appointment_deliveries','encounter_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.outbox_events','event_id IN(SELECT id FROM qa_events)'),
('encounter_v2.care_commands','visit_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.command_receipts','visit_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.visit_history','visit_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.check_ins','visit_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.queue_tickets','visit_id IN(SELECT id FROM qa_visits)'),
('encounter_v2.visits','id IN(SELECT id FROM qa_visits)'),
('appointment_v2.exception_resolution_commands','exception_id IN(SELECT id FROM appointment_v2.reception_exceptions WHERE appointment_id IN(SELECT id FROM qa_appointments))'),
('appointment_v2.reception_exceptions','appointment_id IN(SELECT id FROM qa_appointments)'),
('appointment_v2.fulfillment_receipts','appointment_id IN(SELECT id FROM qa_appointments)'),
('appointment_v2.appointment_history','appointment_id IN(SELECT id FROM qa_appointments)'),
('appointment_v2.outbox_events','event_id IN(SELECT id FROM qa_events)'),
('appointment_v2.appointments','id IN(SELECT id FROM qa_appointments)'),
('appointment_v2.slot_reservations','patient_id IN(SELECT id FROM qa_patients)'),
('patient_v2.reception_receipts','patient_id IN(SELECT id FROM qa_patients)'),
('patient_v2.patient_reviews','patient_id IN(SELECT id FROM qa_patients)'),
('patient_v2.platform_user_patient_links','patient_id IN(SELECT id FROM qa_patients)'),
('patient_v2.clinic_patient_links','patient_id IN(SELECT id FROM qa_patients)'),
('patient_v2.patient_identities','id IN(SELECT id FROM qa_patients)');

-- Freeze writers and fingerprint EVERY persistent table's preserved rows.
-- The launcher must also be stopped to avoid in-flight cross-service deliveries.
CREATE TEMP TABLE qa_targets(relation text, row_tid tid, PRIMARY KEY(relation,row_tid));
CREATE TEMP TABLE qa_preserved(relation text PRIMARY KEY, row_count bigint, digest text);
CREATE TEMP TABLE qa_removed(relation text PRIMARY KEY, row_count bigint);
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname <> 'information_schema' AND schemaname NOT LIKE 'pg_%' ORDER BY schemaname,tablename LOOP
  EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.schemaname,r.tablename);
 END LOOP;
 FOR r IN SELECT * FROM qa_plan ORDER BY seq LOOP
  EXECUTE format('INSERT INTO qa_targets SELECT %L,ctid FROM %s WHERE %s',r.relation,r.relation,r.predicate);
 END LOOP;
 FOR r IN SELECT schemaname||'.'||tablename relation FROM pg_tables WHERE schemaname <> 'information_schema' AND schemaname NOT LIKE 'pg_%' LOOP
  EXECUTE format('INSERT INTO qa_preserved SELECT %L,count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %s t WHERE NOT EXISTS(SELECT 1 FROM qa_targets q WHERE q.relation=%L AND q.row_tid=t.ctid)',r.relation,r.relation,r.relation);
 END LOOP;
END $$;
SELECT relation,count(*) AS planned_rows FROM qa_targets GROUP BY relation ORDER BY relation;
-- Break only the QA-to-QA reschedule reference; never change operational holds.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM appointment_v2.slot_reservations WHERE reschedule_appointment_id IN(SELECT id FROM qa_appointments) AND patient_id NOT IN(SELECT id FROM qa_patients)) THEN RAISE EXCEPTION 'Operational hold references QA appointment'; END IF;
END $$;
UPDATE appointment_v2.slot_reservations SET reschedule_appointment_id=NULL
 WHERE patient_id IN(SELECT id FROM qa_patients) AND reschedule_appointment_id IS NOT NULL;
-- Refresh ctids for updated target holds (all remain in the explicit manifest).
DELETE FROM qa_targets WHERE relation='appointment_v2.slot_reservations';
INSERT INTO qa_targets SELECT 'appointment_v2.slot_reservations',ctid FROM appointment_v2.slot_reservations WHERE patient_id IN(SELECT id FROM qa_patients);
DO $$ DECLARE r record; n bigint; actual_count bigint; actual_digest text; BEGIN
 FOR r IN SELECT * FROM qa_plan ORDER BY seq LOOP
  EXECUTE format('DELETE FROM %s t USING qa_targets q WHERE q.relation=%L AND q.row_tid=t.ctid',r.relation,r.relation);
  GET DIAGNOSTICS n=ROW_COUNT;
  IF n <> (SELECT count(*) FROM qa_targets WHERE relation=r.relation) THEN RAISE EXCEPTION 'Delete count mismatch: %',r.relation; END IF;
  INSERT INTO qa_removed VALUES(r.relation,n);
 END LOOP;
 FOR r IN SELECT * FROM qa_preserved LOOP
  EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text)),'''')) FROM %s t',r.relation) INTO actual_count,actual_digest;
  IF actual_count<>r.row_count OR actual_digest<>r.digest THEN RAISE EXCEPTION 'Preserved data changed: %',r.relation; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM billing_v2.journal_lines GROUP BY journal_id HAVING sum(CASE WHEN side='D' THEN amount_vnd ELSE -amount_vnd END)<>0) THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
END $$;
SELECT relation,row_count AS deleted_rows FROM qa_removed WHERE row_count>0 ORDER BY relation;
SELECT count(*) AS preserved_tables_verified FROM qa_preserved;
SELECT count(*) AS remaining_patients FROM patient_v2.patient_identities;
SELECT count(*) AS remaining_qa_patients FROM patient_v2.patient_identities WHERE full_name ~* '(QA|kiểm chứng|kiểm thử|test)';
\if :apply
COMMIT;
\else
ROLLBACK;
\endif
