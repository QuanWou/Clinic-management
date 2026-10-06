-- Keep the original appointment binding across reloads and recovery.
ALTER TABLE appointment_v2.slot_reservations
  ADD COLUMN reschedule_appointment_id uuid REFERENCES appointment_v2.appointments(id);
ALTER TABLE appointment_v2.slot_reservations
  ADD CONSTRAINT reservation_single_purpose CHECK
    (reschedule_appointment_id IS NULL OR prior_encounter_id IS NULL);
