-- Online collection is independent of a receptionist's cash drawer.
ALTER TABLE billing_v2.payments ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE billing_v2.payments ALTER COLUMN collector_user_id DROP NOT NULL;
DO $$ DECLARE task_constraint record; BEGIN
 FOR task_constraint IN SELECT conname FROM pg_constraint WHERE conrelid='billing_v2.payments'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%method%' LOOP
  EXECUTE format('ALTER TABLE billing_v2.payments DROP CONSTRAINT %I',task_constraint.conname);
 END LOOP;
END $$;
ALTER TABLE billing_v2.payments ADD CONSTRAINT supported_payment_method CHECK(method IN ('CASH','BANK_TRANSFER','POS','PAYOS','VNPAY'));
ALTER TABLE billing_v2.payments ADD CONSTRAINT verified_payment_reference CHECK(method='CASH' OR nullif(trim(external_ref),'') IS NOT NULL);
ALTER TABLE billing_v2.payments ADD CONSTRAINT payment_collection_origin CHECK(
 (method IN ('CASH','BANK_TRANSFER','POS') AND shift_id IS NOT NULL AND collector_user_id IS NOT NULL) OR
 (method IN ('PAYOS','VNPAY') AND shift_id IS NULL AND collector_user_id IS NULL));
ALTER TABLE billing_v2.journal_lines DROP CONSTRAINT journal_lines_account_check;
ALTER TABLE billing_v2.journal_lines ADD CONSTRAINT journal_lines_account_check CHECK(account IN ('RECEIVABLE','REVENUE','CASH','BANK','POS','DISCOUNT','GATEWAY_CLEARING'));

CREATE TABLE billing_v2.payment_intents(
 id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,bill_id uuid NOT NULL,patient_id uuid NOT NULL,initiated_by uuid NOT NULL,
 provider varchar(12) NOT NULL CHECK(provider IN ('PAYOS','VNPAY')),
 provider_order_code varchar(48) NOT NULL,amount_vnd bigint NOT NULL CHECK(amount_vnd>0 AND amount_vnd<=9999999999),
 status varchar(24) NOT NULL DEFAULT 'CREATING' CHECK(status IN ('CREATING','PENDING','PAID','FAILED','CANCELLED','EXPIRED','REVIEW_REQUIRED')),
 client_ip varchar(45) NOT NULL,checkout_url text,qr_code text,payment_link_id varchar(120),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 receipt_id uuid,last_error varchar(80),confirmed_reference varchar(200),confirmed_amount_vnd bigint,confirmed_at timestamptz,
 UNIQUE(provider,provider_order_code),UNIQUE(provider,confirmed_reference),UNIQUE(id,clinic_id,branch_id),
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id),
 FOREIGN KEY(receipt_id,clinic_id,branch_id) REFERENCES billing_v2.payments(id,clinic_id,branch_id));
CREATE INDEX payment_intents_bill ON billing_v2.payment_intents(clinic_id,branch_id,bill_id,created_at DESC);
ALTER TABLE billing_v2.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_v2.payment_intents FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON billing_v2.payment_intents USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id()) WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id());
GRANT SELECT,INSERT ON billing_v2.payment_intents TO clinic_v2_billing_runtime;
GRANT UPDATE(status,checkout_url,qr_code,payment_link_id,receipt_id,last_error,confirmed_reference,confirmed_amount_vnd,confirmed_at) ON billing_v2.payment_intents TO clinic_v2_billing_runtime;

CREATE OR REPLACE FUNCTION billing_v2.enqueue_financial_notification() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.event_type IN ('clinic.billing.bill_issued.v1','clinic.billing.onsite_collected.v1','clinic.billing.online_collected.v1','clinic.billing.adjustment_approved.v1') THEN
  INSERT INTO billing_v2.notification_deliveries(event_id,clinic_id,branch_id,bill_id,patient_id,payload_json)
  SELECT NEW.event_id,NEW.clinic_id,NEW.branch_id,id,patient_id,NEW.payload_json FROM billing_v2.bills WHERE id=NEW.aggregate_id AND clinic_id=NEW.clinic_id AND branch_id=NEW.branch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Financial notification requires an owned bill'; END IF;
 END IF;RETURN NEW;
END $$;
