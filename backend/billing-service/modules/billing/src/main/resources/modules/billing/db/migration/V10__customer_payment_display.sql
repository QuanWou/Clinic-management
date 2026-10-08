CREATE TABLE billing_v2.payment_display_sessions(
 id uuid PRIMARY KEY,
 token_hash char(64) NOT NULL UNIQUE,
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 bill_id uuid NOT NULL,
 payment_intent_id uuid,
 method varchar(20) NOT NULL CHECK(method IN ('BANK_TRANSFER','PAYOS')),
 amount_vnd bigint NOT NULL CHECK(amount_vnd>0 AND amount_vnd<=9999999999),
 bank_name varchar(120),
 account_number varchar(80),
 account_name varchar(160),
 transfer_content varchar(120),
 qr_value text,
 created_by uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 last_presented_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,clinic_id,branch_id),
 FOREIGN KEY(bill_id,clinic_id,branch_id) REFERENCES billing_v2.bills(id,clinic_id,branch_id),
 FOREIGN KEY(payment_intent_id,clinic_id,branch_id) REFERENCES billing_v2.payment_intents(id,clinic_id,branch_id)
);
CREATE INDEX payment_display_bill ON billing_v2.payment_display_sessions(clinic_id,branch_id,bill_id,created_at DESC);
ALTER TABLE billing_v2.payment_display_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_v2.payment_display_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON billing_v2.payment_display_sessions
 USING(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id())
 WITH CHECK(clinic_id=billing_v2.current_clinic_id() AND branch_id=billing_v2.current_branch_id());
GRANT SELECT,INSERT ON billing_v2.payment_display_sessions TO clinic_v2_billing_runtime;
GRANT UPDATE(last_presented_at,expires_at,payment_intent_id,amount_vnd,qr_value) ON billing_v2.payment_display_sessions TO clinic_v2_billing_runtime;

CREATE OR REPLACE FUNCTION billing_v2.resolve_payment_display_scope(p_token_hash char(64))
RETURNS TABLE(clinic_id uuid,branch_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path=billing_v2,pg_temp
AS $$
 SELECT s.clinic_id,s.branch_id
 FROM billing_v2.payment_display_sessions s
 WHERE s.token_hash=p_token_hash
   AND s.expires_at>now()-interval '2 hours'
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION billing_v2.resolve_payment_display_scope(char(64)) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION billing_v2.resolve_payment_display_scope(char(64)) TO clinic_v2_billing_runtime;
