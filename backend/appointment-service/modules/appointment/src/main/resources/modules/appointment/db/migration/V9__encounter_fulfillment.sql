ALTER TABLE appointment_v2.appointments ADD COLUMN fulfilled_at timestamptz;
CREATE TABLE appointment_v2.fulfillment_receipts(
 event_id uuid PRIMARY KEY,clinic_id uuid NOT NULL,branch_id uuid NOT NULL,
 appointment_id uuid NOT NULL REFERENCES appointment_v2.appointments(id),
 encounter_id uuid NOT NULL,actor_user_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE appointment_v2.fulfillment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.fulfillment_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON appointment_v2.fulfillment_receipts USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
GRANT SELECT,INSERT ON appointment_v2.fulfillment_receipts TO clinic_v2_appointment_runtime;
