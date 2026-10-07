CREATE SCHEMA IF NOT EXISTS billing_v2;
CREATE TABLE billing_v2.bills(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,encounter_id uuid NOT NULL,patient_id uuid NOT NULL,
 currency varchar(3) NOT NULL DEFAULT 'VND' CHECK(currency='VND'),
 subtotal_vnd bigint NOT NULL CHECK(subtotal_vnd>=0),adjustment_vnd bigint NOT NULL DEFAULT 0 CHECK(adjustment_vnd>=0),
 paid_vnd bigint NOT NULL DEFAULT 0 CHECK(paid_vnd>=0),
 status varchar(20) NOT NULL CHECK(status IN ('ISSUED','PARTIALLY_PAID','PAID')),
 row_version bigint NOT NULL DEFAULT 0,issued_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id,branch_id),UNIQUE(clinic_id,branch_id,encounter_id),
 CHECK(adjustment_vnd<=subtotal_vnd AND paid_vnd<=subtotal_vnd-adjustment_vnd));
CREATE TABLE billing_v2.charges(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,encounter_id uuid NOT NULL,
 source_type varchar(20) NOT NULL CHECK(source_type IN ('APPOINTMENT','MEDICAL_ORDER')),source_id uuid NOT NULL,
 offering_id uuid NOT NULL,name varchar(220) NOT NULL,amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
 price_snapshot_json text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id,branch_id),UNIQUE(clinic_id,source_type,source_id));
CREATE TABLE billing_v2.bill_lines(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,bill_id uuid NOT NULL,charge_id uuid NOT NULL UNIQUE,
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id),
 FOREIGN KEY(charge_id,clinic_id,branch_id) REFERENCES billing_v2.charges(id,clinic_id,branch_id));
CREATE TABLE billing_v2.shifts(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,collector_user_id uuid NOT NULL,
 state varchar(20) NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','SUBMITTED','APPROVED')),
 declared_cash_vnd bigint CHECK(declared_cash_vnd>=0),declared_bank_vnd bigint CHECK(declared_bank_vnd>=0),declared_pos_vnd bigint CHECK(declared_pos_vnd>=0),
 expected_cash_vnd bigint,expected_bank_vnd bigint,expected_pos_vnd bigint,variance_vnd bigint,
 opened_at timestamptz NOT NULL DEFAULT now(),submitted_at timestamptz,approved_at timestamptz,approved_by uuid,
 row_version bigint NOT NULL DEFAULT 0,UNIQUE(id,clinic_id,branch_id));
CREATE UNIQUE INDEX one_open_shift_per_collector ON billing_v2.shifts(clinic_id,branch_id,collector_user_id) WHERE state='OPEN';
CREATE TABLE billing_v2.payments(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,bill_id uuid NOT NULL,shift_id uuid NOT NULL,
 collector_user_id uuid NOT NULL,amount_vnd bigint NOT NULL CHECK(amount_vnd>0),
 method varchar(20) NOT NULL CHECK(method IN ('CASH','BANK_TRANSFER','POS')),external_ref varchar(200),reason varchar(500) NOT NULL,
 receipt_code varchar(50) NOT NULL UNIQUE,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id,branch_id),UNIQUE(clinic_id,branch_id,method,external_ref),
 CHECK(method='CASH' OR (external_ref IS NOT NULL AND length(trim(external_ref))>0)),
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id),
 FOREIGN KEY(shift_id,clinic_id,branch_id) REFERENCES billing_v2.shifts(id,clinic_id,branch_id));
CREATE TABLE billing_v2.adjustments(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,bill_id uuid NOT NULL,
 amount_vnd bigint NOT NULL CHECK(amount_vnd>0),approved_by uuid NOT NULL,reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id));
CREATE TABLE billing_v2.journals(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,source_type varchar(20) NOT NULL CHECK(source_type IN ('BILL','PAYMENT','ADJUSTMENT')),
 source_id uuid NOT NULL,actor_user_id uuid NOT NULL,reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 creation_tx bigint NOT NULL DEFAULT txid_current(),UNIQUE(id,clinic_id,branch_id),UNIQUE(clinic_id,source_type,source_id));
CREATE TABLE billing_v2.journal_lines(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,journal_id uuid NOT NULL,
 account varchar(20) NOT NULL CHECK(account IN ('RECEIVABLE','REVENUE','CASH','BANK','POS','DISCOUNT')),
 side char(1) NOT NULL CHECK(side IN ('D','C')),amount_vnd bigint NOT NULL CHECK(amount_vnd>0),
 FOREIGN KEY(journal_id,clinic_id,branch_id) REFERENCES billing_v2.journals(id,clinic_id,branch_id));
CREATE FUNCTION billing_v2.require_new_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM billing_v2.journals WHERE id=NEW.journal_id AND creation_tx=txid_current()) THEN RAISE EXCEPTION 'Journal lines must be posted in their source transaction'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER new_journal_lines BEFORE INSERT ON billing_v2.journal_lines FOR EACH ROW EXECUTE FUNCTION billing_v2.require_new_journal();
CREATE FUNCTION billing_v2.require_balanced_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE task_id uuid;task_count integer;task_debit numeric;task_credit numeric;
BEGIN
 IF TG_TABLE_NAME='journals' THEN task_id:=NEW.id; ELSE task_id:=NEW.journal_id; END IF;
 SELECT count(*),coalesce(sum(amount_vnd) FILTER(WHERE side='D'),0),coalesce(sum(amount_vnd) FILTER(WHERE side='C'),0)
 INTO task_count,task_debit,task_credit FROM billing_v2.journal_lines WHERE journal_id=task_id;
 IF task_count<2 OR task_debit<=0 OR task_debit<>task_credit THEN RAISE EXCEPTION 'Posted journal must have balanced debit and credit'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER balanced_journal_header AFTER INSERT ON billing_v2.journals DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION billing_v2.require_balanced_journal();
CREATE CONSTRAINT TRIGGER balanced_journal_lines AFTER INSERT ON billing_v2.journal_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION billing_v2.require_balanced_journal();
CREATE TABLE billing_v2.commands(
 clinic_id uuid NOT NULL,branch_id uuid NOT NULL,actor_user_id uuid NOT NULL,operation varchar(32) NOT NULL,key varchar(120) NOT NULL,
 payload_hash varchar(64) NOT NULL,resource_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clinic_id,branch_id,actor_user_id,operation,key));
CREATE TABLE billing_v2.history(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,resource_id uuid NOT NULL,actor_user_id uuid NOT NULL,
 action varchar(40) NOT NULL,reason varchar(500) NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE billing_v2.outbox_events(
 event_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,aggregate_id uuid NOT NULL,event_type varchar(100) NOT NULL,payload_json text NOT NULL,
 status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','DLQ')),attempts integer NOT NULL DEFAULT 0,
 next_attempt_at timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now(),published_at timestamptz,last_error varchar(80));
