ALTER TABLE appointment_v2.capacity_slots ADD CONSTRAINT slot_interval CHECK(ends_at>starts_at);
ALTER TABLE appointment_v2.capacity_slots ADD UNIQUE(id,clinic_id,branch_id);
ALTER TABLE appointment_v2.capacity_slots ADD UNIQUE(id,clinic_id,branch_id,offering_id,doctor_id);
ALTER TABLE appointment_v2.slot_reservations ADD UNIQUE(id,clinic_id,branch_id,patient_id);
ALTER TABLE appointment_v2.slot_reservations ADD FOREIGN KEY(slot_id,clinic_id,branch_id)
 REFERENCES appointment_v2.capacity_slots(id,clinic_id,branch_id);
ALTER TABLE appointment_v2.appointments ADD FOREIGN KEY(slot_id,clinic_id,branch_id,offering_id,doctor_id)
 REFERENCES appointment_v2.capacity_slots(id,clinic_id,branch_id,offering_id,doctor_id);
ALTER TABLE appointment_v2.appointments ADD FOREIGN KEY(reservation_id,clinic_id,branch_id,patient_id)
 REFERENCES appointment_v2.slot_reservations(id,clinic_id,branch_id,patient_id);
ALTER TABLE appointment_v2.slot_reservations DROP CONSTRAINT slot_reservations_patient_id_idempotency_key_key;
ALTER TABLE appointment_v2.slot_reservations ADD UNIQUE(clinic_id,patient_id,idempotency_key);
ALTER TABLE appointment_v2.appointments DROP CONSTRAINT appointments_patient_id_confirmation_key_key;
ALTER TABLE appointment_v2.appointments ADD UNIQUE(clinic_id,patient_id,confirmation_key);
