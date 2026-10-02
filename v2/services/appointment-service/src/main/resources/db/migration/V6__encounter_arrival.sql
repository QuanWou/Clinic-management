ALTER TABLE appointment_v2.appointments ADD COLUMN encounter_id uuid;
CREATE UNIQUE INDEX appointment_encounter_once ON appointment_v2.appointments(encounter_id) WHERE encounter_id IS NOT NULL;
ALTER TABLE appointment_v2.appointments ADD CONSTRAINT checked_in_has_encounter CHECK(status <> 'CHECKED_IN' OR encounter_id IS NOT NULL) NOT VALID;
