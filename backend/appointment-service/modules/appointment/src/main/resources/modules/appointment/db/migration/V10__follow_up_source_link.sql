ALTER TABLE appointment_v2.slot_reservations ADD COLUMN prior_encounter_id uuid, ADD COLUMN prior_branch_id uuid, ADD COLUMN prior_medical_version bigint, ADD COLUMN prior_proposed_date date;
ALTER TABLE appointment_v2.appointments ADD COLUMN prior_encounter_id uuid, ADD COLUMN prior_branch_id uuid, ADD COLUMN prior_medical_version bigint, ADD COLUMN prior_proposed_date date;
ALTER TABLE appointment_v2.slot_reservations ADD CONSTRAINT follow_up_hold_proof CHECK (
 (prior_encounter_id IS NULL AND prior_branch_id IS NULL AND prior_medical_version IS NULL AND prior_proposed_date IS NULL)
 OR (prior_encounter_id IS NOT NULL AND prior_branch_id IS NOT NULL AND prior_medical_version IS NOT NULL AND prior_medical_version>0 AND prior_proposed_date IS NOT NULL)
);
ALTER TABLE appointment_v2.appointments ADD CONSTRAINT follow_up_booking_proof CHECK (
 (prior_encounter_id IS NULL AND prior_branch_id IS NULL AND prior_medical_version IS NULL AND prior_proposed_date IS NULL)
 OR (prior_encounter_id IS NOT NULL AND prior_branch_id IS NOT NULL AND prior_medical_version IS NOT NULL AND prior_medical_version>0 AND prior_proposed_date IS NOT NULL)
);
CREATE FUNCTION appointment_v2.freeze_follow_up_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.prior_encounter_id,NEW.prior_branch_id,NEW.prior_medical_version,NEW.prior_proposed_date)
    IS DISTINCT FROM ROW(OLD.prior_encounter_id,OLD.prior_branch_id,OLD.prior_medical_version,OLD.prior_proposed_date)
 THEN RAISE EXCEPTION 'Follow-up source proof is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER freeze_hold_follow_up BEFORE UPDATE ON appointment_v2.slot_reservations FOR EACH ROW EXECUTE FUNCTION appointment_v2.freeze_follow_up_proof();
CREATE TRIGGER freeze_booking_follow_up BEFORE UPDATE ON appointment_v2.appointments FOR EACH ROW EXECUTE FUNCTION appointment_v2.freeze_follow_up_proof();
