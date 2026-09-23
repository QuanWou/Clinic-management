-- DEVELOPMENT / UI DEMO ONLY. Entirely fictional data; never run in production.
-- Extend, do not replace, the small demo fixture. Existing non-demo rows are untouched.
-- Stable reserved UUIDs and ON CONFLICT make repeated runs idempotent.
-- Reference date is 2026-09-21; historic weekday appointments span 2026-08-24..09-18,
-- future weekday appointments span 2026-09-22..10-05.
\set ON_ERROR_STOP on
BEGIN;

DO $$
BEGIN
    IF current_database() <> 'clinic_db' THEN
        RAISE EXCEPTION 'Refusing bulk demo seed outside clinic_db';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'pgcrypto is required for randomly generated, unusable demo passwords';
    END IF;
    IF (SELECT count(*) FROM doctor.specialties WHERE id::text LIKE '10000000-0000-0000-0000-%') < 6
       OR NOT EXISTS (SELECT 1 FROM identity.roles WHERE code = 'ROLE_DOCTOR') THEN
        RAISE EXCEPTION 'Required specialty and identity-role migrations are missing';
    END IF;
END $$;

-- 18 synthetic Identity accounts are never assigned a shared/public password.
INSERT INTO identity.users
    (id, email, password_hash, full_name, phone, status, created_at, updated_at)
SELECT ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       'demo-clinic-bulk-doctor-' || n || '@example.invalid',
       crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf', 10)),
       'DEMO Doctor Bulk ' || lpad(n::text, 3, '0'),
       NULL, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM generate_series(1, 18) AS seq(n)
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.user_roles (user_id, role_id)
SELECT ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, r.id
FROM generate_series(1, 18) AS seq(n)
JOIN identity.roles r ON r.code = 'ROLE_DOCTOR'
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 18 doctors distributed across the six migrated specialties, all at zero demo fee.
INSERT INTO doctor.doctors
    (id, user_id, specialty_id, biography, consultation_fee, active)
SELECT ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('10000000-0000-0000-0000-' || lpad((1 + ((n - 1) % 6))::text, 12, '0'))::uuid,
       'DEMO ONLY - fictional doctor for local dashboard and appointment testing.',
       0, TRUE
FROM generate_series(1, 18) AS seq(n)
ON CONFLICT (id) DO NOTHING;

-- Each demo doctor works weekdays 08:00-12:00 and 13:00-17:00.
INSERT INTO doctor.schedules (id, doctor_id, day_of_week, start_time, end_time)
SELECT ('e7000000-0000-4000-8000-' || lpad(((n - 1) * 10 + day * 2 + slot)::text, 12, '0'))::uuid,
       ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       day,
       CASE WHEN slot = 0 THEN TIME '08:00' ELSE TIME '13:00' END,
       CASE WHEN slot = 0 THEN TIME '12:00' ELSE TIME '17:00' END
FROM generate_series(1, 18) AS doctors(n)
CROSS JOIN generate_series(1, 5) AS days(day)
CROSS JOIN generate_series(0, 1) AS sessions(slot)
ON CONFLICT (id) DO NOTHING;

-- 500 fictional walk-in patient profiles; no real contact details or login accounts.
INSERT INTO patient.patients
    (id, user_id, full_name, phone, dob, gender, address, blood_type)
SELECT ('e2000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       NULL, 'DEMO Patient Bulk ' || lpad(n::text, 4, '0'), NULL,
       DATE '1968-01-01' + ((n * 137) % 16000),
       CASE WHEN n % 2 = 0 THEN 'FEMALE' ELSE 'MALE' END,
       'DEMO ONLY - no real patient address', NULL
FROM generate_series(1, 500) AS seq(n)
ON CONFLICT (id) DO NOTHING;

-- 2,000 historic bookings spread across every weekday of a 30-day reporting window.
-- 1,600 COMPLETED + 400 CANCELLED; unique (day, doctor, half-hour slot).
WITH past_days AS (
    SELECT day::date AS visit_date,
           (row_number() OVER (ORDER BY day) - 1)::integer AS day_index
    FROM generate_series(DATE '2026-08-24', DATE '2026-09-18', INTERVAL '1 day') AS day
    WHERE extract(isodow FROM day) BETWEEN 1 AND 5
)
INSERT INTO appointment.appointments
    (id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
     reason, patient_user_id, created_at, updated_at)
SELECT ('e3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('e2000000-0000-4000-8000-' || lpad((1 + ((n - 1) * 37) % 500)::text, 12, '0'))::uuid,
       ('e1000000-0000-4000-8000-' || lpad((1 + (((n - 1) / 20) % 18))::text, 12, '0'))::uuid,
       visit_date,
       TIME '08:00' + (((n - 1) / 360) * INTERVAL '30 minutes'),
       TIME '08:30' + (((n - 1) / 360) * INTERVAL '30 minutes'),
       CASE WHEN n % 5 = 0 THEN 'CANCELLED' ELSE 'COMPLETED' END,
       'DEMO ONLY - fictional historical visit; not real patient care', NULL,
       visit_date - INTERVAL '3 days', visit_date + TIME '12:00'
FROM generate_series(1, 2000) AS seq(n)
JOIN past_days ON day_index = (n - 1) % 20
ON CONFLICT (id) DO NOTHING;

-- 400 forthcoming bookings: 250 CONFIRMED and 150 PENDING.
WITH future_days AS (
    SELECT day::date AS visit_date,
           (row_number() OVER (ORDER BY day) - 1)::integer AS day_index
    FROM generate_series(DATE '2026-09-22', DATE '2026-10-05', INTERVAL '1 day') AS day
    WHERE extract(isodow FROM day) BETWEEN 1 AND 5
)
INSERT INTO appointment.appointments
    (id, patient_id, doctor_id, appointment_date, start_time, end_time, status,
     reason, patient_user_id, created_at, updated_at)
SELECT ('e3000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       ('e2000000-0000-4000-8000-' || lpad((1 + ((n - 1) * 37) % 500)::text, 12, '0'))::uuid,
       ('e1000000-0000-4000-8000-' || lpad((1 + (((n - 2001) / 10) % 18))::text, 12, '0'))::uuid,
       visit_date,
       TIME '13:00' + (((n - 2001) / 180) * INTERVAL '30 minutes'),
       TIME '13:30' + (((n - 2001) / 180) * INTERVAL '30 minutes'),
       CASE WHEN (n - 2001) % 8 < 5 THEN 'CONFIRMED' ELSE 'PENDING' END,
       'DEMO ONLY - fictional future booking; not real patient care', NULL,
       DATE '2026-09-21' - INTERVAL '1 day', DATE '2026-09-21' - INTERVAL '1 day'
FROM generate_series(2001, 2400) AS seq(n)
JOIN future_days ON day_index = (n - 2001) % 10
ON CONFLICT (id) DO NOTHING;

-- Only completed NEW demo appointments receive synthetic clinical records.
-- No invented diagnoses for real patients or for old demo visits.
INSERT INTO medical_record.medical_records
    (id, appointment_id, patient_id, doctor_id, symptoms, diagnosis, notes, created_at, updated_at)
SELECT ('e4000000-0000-4000-8000-' || right(a.id::text, 12))::uuid,
       a.id, a.patient_id, a.doctor_id,
       'DEMO ONLY - synthetic symptoms; no symptoms were assessed.',
       'DEMO ONLY - not a clinical diagnosis.',
       'Synthetic fixture for development and display. Do not use for patient care.',
       a.appointment_date + a.end_time + INTERVAL '10 minutes',
       a.appointment_date + a.end_time + INTERVAL '10 minutes'
FROM appointment.appointments a
WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%'
  AND a.status = 'COMPLETED'
ON CONFLICT (id) DO NOTHING;

-- Assert fixture size, role links, true appointment ownership, schedule fit and
-- valid clinical record links. Any issue aborts and rolls back the ENTIRE run.
DO $$
BEGIN
    IF (SELECT count(*) FROM identity.users WHERE id::text LIKE 'e0000000-0000-4000-8000-%') <> 18
       OR (SELECT count(*) FROM identity.user_roles ur JOIN identity.users u ON u.id = ur.user_id JOIN identity.roles r ON r.id = ur.role_id WHERE u.id::text LIKE 'e0000000-0000-4000-8000-%' AND r.code = 'ROLE_DOCTOR') <> 18
       OR (SELECT count(*) FROM patient.patients WHERE id::text LIKE 'e2000000-0000-4000-8000-%') <> 500
       OR (SELECT count(*) FROM doctor.doctors WHERE id::text LIKE 'e1000000-0000-4000-8000-%') <> 18
       OR (SELECT count(*) FROM doctor.schedules WHERE id::text LIKE 'e7000000-0000-4000-8000-%') <> 180
       OR (SELECT count(*) FROM appointment.appointments WHERE id::text LIKE 'e3000000-0000-4000-8000-%') <> 2400
       OR (SELECT count(*) FROM medical_record.medical_records WHERE id::text LIKE 'e4000000-0000-4000-8000-%') <> 1600
       OR EXISTS (
           SELECT 1 FROM appointment.appointments a
           LEFT JOIN patient.patients p ON p.id = a.patient_id
           LEFT JOIN doctor.doctors d ON d.id = a.doctor_id
           WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%'
             AND (p.id IS NULL OR d.id IS NULL OR a.start_time >= a.end_time
                  OR NOT EXISTS (
                      SELECT 1 FROM doctor.schedules s
                      WHERE s.doctor_id = a.doctor_id
                        AND s.day_of_week = extract(isodow FROM a.appointment_date)::integer
                        AND a.start_time >= s.start_time AND a.end_time <= s.end_time
                  ))
       )
       OR EXISTS (
           SELECT 1 FROM medical_record.medical_records m
           LEFT JOIN appointment.appointments a ON a.id = m.appointment_id
           WHERE m.id::text LIKE 'e4000000-0000-4000-8000-%'
             AND (a.id IS NULL OR a.status <> 'COMPLETED'
                  OR a.patient_id <> m.patient_id OR a.doctor_id <> m.doctor_id)
       ) THEN
        RAISE EXCEPTION 'Bulk DEMO fixture incomplete or inconsistent: transaction rolled back';
    END IF;
END $$;

COMMIT;

-- Print only aggregate statistics; never output existing patient/account details.
SELECT 'bulk_demo_patients' AS entity, count(*) AS rows FROM patient.patients WHERE id::text LIKE 'e2000000-0000-4000-8000-%'
UNION ALL SELECT 'bulk_demo_doctors', count(*) FROM doctor.doctors WHERE id::text LIKE 'e1000000-0000-4000-8000-%'
UNION ALL SELECT 'bulk_demo_schedules', count(*) FROM doctor.schedules WHERE id::text LIKE 'e7000000-0000-4000-8000-%'
UNION ALL SELECT 'bulk_demo_appointments', count(*) FROM appointment.appointments WHERE id::text LIKE 'e3000000-0000-4000-8000-%'
UNION ALL SELECT 'bulk_demo_medical_records', count(*) FROM medical_record.medical_records WHERE id::text LIKE 'e4000000-0000-4000-8000-%';
