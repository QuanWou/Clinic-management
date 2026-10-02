-- DESIGN REFERENCE ONLY: separate Billing database, not a production migration.
-- All money in VND integer đồng. Only verified server-side source snapshots.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE TABLE billing.charge (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL, branch_id uuid NOT NULL,
 source_type text NOT NULL, source_id uuid NOT NULL, source_version bigint NOT NULL,
 offering_id uuid, price_version_id uuid,
 amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
 posted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id), UNIQUE(clinic_id,source_type,source_id,source_version)
);
CREATE TABLE billing.bill (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL, branch_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('draft','issued','partially_paid','paid','disputed','voided')),
 total_vnd bigint NOT NULL DEFAULT 0 CHECK(total_vnd>=0),
 version bigint NOT NULL DEFAULT 1,
 UNIQUE(clinic_id,id)
);
CREATE TABLE billing.bill_line (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 bill_id uuid NOT NULL, charge_id uuid NOT NULL,
 amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
 UNIQUE(clinic_id,charge_id),
 FOREIGN KEY(clinic_id,bill_id) REFERENCES billing.bill(clinic_id,id),
 FOREIGN KEY(clinic_id,charge_id) REFERENCES billing.charge(clinic_id,id)
);
CREATE TABLE billing.payment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 collector text NOT NULL CHECK(collector IN ('clinic','platform_on_behalf')),
 beneficiary_id uuid NOT NULL, merchant_id text,
 provider text, provider_payment_id text,
 amount_vnd bigint NOT NULL CHECK(amount_vnd>0),
 status text NOT NULL CHECK(status IN ('pending','succeeded','failed','unknown')),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id), UNIQUE(provider,merchant_id,provider_payment_id)
);
CREATE TABLE billing.payment_allocation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 payment_id uuid NOT NULL, bill_id uuid NOT NULL,
 amount_vnd bigint NOT NULL CHECK(amount_vnd>0),
 FOREIGN KEY(clinic_id,payment_id) REFERENCES billing.payment(clinic_id,id),
 FOREIGN KEY(clinic_id,bill_id) REFERENCES billing.bill(clinic_id,id)
);
CREATE TABLE billing.refund (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 payment_id uuid NOT NULL, amount_vnd bigint NOT NULL CHECK(amount_vnd>0),
 reason text NOT NULL, approved_by uuid,
 status text NOT NULL CHECK(status IN ('requested','approved','processing','succeeded','failed')),
 UNIQUE(clinic_id,id),
 FOREIGN KEY(clinic_id,payment_id) REFERENCES billing.payment(clinic_id,id)
);
CREATE TABLE billing.provider_event_inbox (
 provider text NOT NULL, merchant_id text NOT NULL, provider_event_id text NOT NULL,
 body_sha256 text NOT NULL, received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (provider,merchant_id,provider_event_id)
);
CREATE TABLE billing.journal_entry (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 currency text NOT NULL DEFAULT 'VND' CHECK(currency='VND'),
 cause_type text NOT NULL, cause_id uuid NOT NULL,
 reverses_entry_id uuid REFERENCES billing.journal_entry(id),
 posted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(clinic_id,id), UNIQUE(clinic_id,cause_type,cause_id)
);
CREATE TABLE billing.journal_line (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), clinic_id uuid NOT NULL,
 entry_id uuid NOT NULL, account_code text NOT NULL,
 debit_vnd bigint NOT NULL DEFAULT 0 CHECK(debit_vnd>=0),
 credit_vnd bigint NOT NULL DEFAULT 0 CHECK(credit_vnd>=0),
 CHECK ((debit_vnd>0 AND credit_vnd=0) OR (credit_vnd>0 AND debit_vnd=0)),
 FOREIGN KEY(clinic_id,entry_id) REFERENCES billing.journal_entry(clinic_id,id)
);
-- In real implementation add a DEFERRABLE constraint trigger validating
-- SUM(debit_vnd)=SUM(credit_vnd) per journal_entry at commit, and prohibit
-- UPDATE/DELETE of posted journal rows; reversals create NEW journal_entry.
-- Payment and refund limits require transaction locks on bill/payment rows.
-- Provider verification must happen BEFORE inserting into provider_event_inbox.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['charge','bill','bill_line','payment','payment_allocation','refund','journal_entry','journal_line']) LOOP
  EXECUTE format('ALTER TABLE billing.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE billing.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scope ON billing.%I FOR ALL USING (clinic_id = app_security.current_clinic_id()) WITH CHECK (clinic_id = app_security.current_clinic_id())',t);
 END LOOP;
END $$;
-- provider_event_inbox is a gateway-internal global table: isolate to a
-- dedicated webhook processing DB role with no generic tenant API access.
