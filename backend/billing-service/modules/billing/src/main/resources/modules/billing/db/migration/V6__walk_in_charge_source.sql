ALTER TABLE billing_v2.charges DROP CONSTRAINT charges_source_type_check;
ALTER TABLE billing_v2.charges ADD CONSTRAINT charges_source_type_check
  CHECK (source_type IN ('APPOINTMENT','MEDICAL_ORDER','WALK_IN'));
