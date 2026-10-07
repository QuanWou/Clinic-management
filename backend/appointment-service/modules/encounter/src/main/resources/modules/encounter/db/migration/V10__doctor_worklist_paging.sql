CREATE INDEX doctor_active_worklist_page
ON encounter_v2.visits(clinic_id,branch_id,doctor_user_id,created_at,id)
WHERE status IN ('WAITING','IN_PROGRESS','AWAITING_RESULTS','CLINICALLY_COMPLETED');
