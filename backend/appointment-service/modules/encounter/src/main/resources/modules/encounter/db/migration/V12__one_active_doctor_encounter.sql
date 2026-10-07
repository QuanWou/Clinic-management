CREATE UNIQUE INDEX one_active_encounter_per_doctor
ON encounter_v2.visits(doctor_user_id)
WHERE status='IN_PROGRESS';
