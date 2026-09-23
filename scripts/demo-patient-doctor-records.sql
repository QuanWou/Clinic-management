-- DEVELOPMENT DEMO ONLY: synthetic identities, patients and clinical notes.
-- Requires existing Flyway schemas and pgcrypto. Re-runnable, non-destructive.
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'pgcrypto required for random BCrypt demo passwords';
    END IF;
    IF (SELECT COUNT(*) FROM doctor.specialties WHERE id IN (
        '10000000-0000-0000-0000-000000000001',
        '10000000-0000-0000-0000-000000000003',
        '10000000-0000-0000-0000-000000000006')) <> 3 THEN
        RAISE EXCEPTION 'Doctor specialty migrations are not ready';
    END IF;
END $$;

-- No shared/test password. Generated secrets are not printed; reset through
-- an authorized account workflow if interactive doctor login is required.
INSERT INTO identity.users (id, email, password_hash, full_name, phone, status, created_at, updated_at)
SELECT ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-clinic-doctor-' || n || '@example.invalid',
       crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf', 12)),
       'DEMO Doctor ' || lpad(n::text, 2, '0'),
       NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 3) n
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.user_roles (user_id, role_id)
SELECT ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, r.id
FROM generate_series(1, 3) n
JOIN identity.roles r ON r.code = 'ROLE_DOCTOR'
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO doctor.doctors (id, user_id, specialty_id, biography, consultation_fee, active)
SELECT ('d1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('d0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       CASE n
           WHEN 1 THEN '10000000-0000-0000-0000-000000000001'::uuid
           WHEN 2 THEN '10000000-0000-0000-0000-000000000003'::uuid
           ELSE '10000000-0000-0000-0000-000000000006'::uuid
       END,
       'DEMO ONLY - fictional doctor for development and UI tests.', 0, TRUE
FROM generate_series(1, 3) n
ON CONFLICT (id) DO NOTHING;

-- ISO Monday-Friday, morning and afternoon sessions never overlap.
INSERT INTO doctor.schedules (id, doctor_id, day_of_week, start_time, end_time)
SELECT ('d7000000-0000-4000-8000-' || lpad(((n - 1) * 10 + day * 2 + slot)::text, 12, '0'))::uuid,
       ('d1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       day,
       CASE slot WHEN 0 THEN TIME '08:00' ELSE TIME '13:00' END,
       CASE slot WHEN 0 THEN TIME '12:00' ELSE TIME '17:00' END
FROM generate_series(1, 3) n
CROSS JOIN generate_series(1, 5) day
CROSS JOIN generate_series(0, 1) slot
ON CONFLICT (id) DO NOTHING;

-- Walk-in patients have no identity account and no real contact details.
INSERT INTO patient.patients (id, user_id, full_name, phone, dob, gender, address, blood_type)
SELECT ('d2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       NULL, 'DEMO Patient ' || lpad(n::text, 2, '0'), NULL,
       DATE '1985-01-01' + n * 365,
       CASE WHEN n % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
       'DEMO ONLY - no real address', NULL
FROM generate_series(1, 8) n
ON CONFLICT (id) DO NOTHING;

-- Twelve historical, completed demo visits: one doctor per weekday at 09:00.
WITH demo_days AS (
    SELECT row_number() OVER (ORDER BY day)::integer n, day::date visit_date
    FROM generate_series(DATE '2026-09-01', DATE '2026-09-18', INTERVAL '1 day') day
    WHERE EXTRACT(ISODOW FROM day) BETWEEN 1 AND 5
    ORDER BY day LIMIT 12
)
INSERT INTO appointment.appointments
    (id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
     reason, patient_user_id, created_at, updated_at)
SELECT ('d3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('d2000000-0000-4000-8000-' || lpad((((n - 1) % 8) + 1)::text, 12, '0'))::uuid,
       ('d1000000-0000-4000-8000-' || lpad((((n - 1) % 3) + 1)::text, 12, '0'))::uuid,
       visit_date, TIME '09:00', TIME '09:30', 'COMPLETED',
       'DEMO ONLY - fictional visit, not an actual encounter', NULL,
       visit_date + TIME '08:50', visit_date + TIME '09:30'
FROM demo_days
ON CONFLICT (id) DO NOTHING;

-- Link only the demo appointments, never fabricate records for existing patients.
INSERT INTO medical_record.medical_records
    (id, appointment_id, patient_id, doctor_id, symptoms, diagnosis, notes, created_at, updated_at)
SELECT ('d4000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       a.id, a.patient_id, a.doctor_id,
       'DEMO ONLY - no actual symptoms assessed.',
       'DEMO ONLY - not a clinical diagnosis.',
       'Synthetic medical-record fixture for UI testing. Not for patient care.',
       a.appointment_date + TIME '09:40', a.appointment_date + TIME '09:40'
FROM generate_series(1, 12) n
JOIN appointment.appointments a
  ON a.id = ('d3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid
WHERE a.status = 'COMPLETED'
ON CONFLICT (id) DO NOTHING;

-- Abort atomically if any fixture is absent or linked to the wrong patient/doctor.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM identity.users WHERE id::text LIKE 'd0000000-0000-4000-8000-%') <> 3
       OR (SELECT COUNT(*) FROM patient.patients WHERE id::text LIKE 'd2000000-0000-4000-8000-%') <> 8
       OR (SELECT COUNT(*) FROM doctor.doctors WHERE id::text LIKE 'd1000000-0000-4000-8000-%') <> 3
       OR (SELECT COUNT(*) FROM doctor.schedules WHERE id::text LIKE 'd7000000-0000-4000-8000-%') <> 30
       OR (SELECT COUNT(*) FROM appointment.appointments WHERE id::text LIKE 'd3000000-0000-4000-8000-%') <> 12
       OR (SELECT COUNT(*) FROM medical_record.medical_records WHERE id::text LIKE 'd4000000-0000-4000-8000-%') <> 12
       OR EXISTS (
           SELECT 1 FROM medical_record.medical_records m
           JOIN appointment.appointments a ON a.id = m.appointment_id
           WHERE m.id::text LIKE 'd4000000-0000-4000-8000-%'
             AND (a.status <> 'COMPLETED' OR a.patient_id <> m.patient_id OR a.doctor_id <> m.doctor_id)
       ) THEN
        RAISE EXCEPTION 'Incomplete or inconsistent DEMO fixtures; rolling back';
    END IF;
END $$;
COMMIT;

SELECT 'demo_patient' entity, count(*) rows FROM patient.patients WHERE id::text LIKE 'd2000000-0000-4000-8000-%'
UNION ALL SELECT 'demo_doctor', count(*) FROM doctor.doctors WHERE id::text LIKE 'd1000000-0000-4000-8000-%'
UNION ALL SELECT 'demo_appointment', count(*) FROM appointment.appointments WHERE id::text LIKE 'd3000000-0000-4000-8000-%'
UNION ALL SELECT 'demo_medical_record', count(*) FROM medical_record.medical_records WHERE id::text LIKE 'd4000000-0000-4000-8000-%';
