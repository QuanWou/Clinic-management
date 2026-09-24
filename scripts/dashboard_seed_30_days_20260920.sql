-- CLINIC DASHBOARD: SYNTHETIC TRAINING DATA ONLY (NOT REAL CLINICAL HISTORY)
-- Inclusive window: 2026-08-22 through 2026-09-20 (30 calendar days).
-- Current demo doctor works Monday-Friday, 08:00-12:00: 20 days x 4 slots.
-- Empty-slot result: 4 synthetic walk-in profiles, 80 appointments
-- (60 COMPLETED + 20 CANCELLED), 60 matching COMPLETED reception visits.
-- Only the specifically named demo doctor is eligible. Real patient profiles,
-- accounts, clinical records, invoices, and payment data are never modified.
-- PostgreSQL / pgAdmin: choose database clinic_db, run the ENTIRE script.
-- Idempotent: reruns don't duplicate rows. Existing slots are NEVER replaced.
-- Synthetic history is not evidence of actual care or financial transactions.

BEGIN;

DO $seed_check$
BEGIN
    IF current_database() <> 'clinic_db' THEN
        RAISE EXCEPTION 'Expected database clinic_db, got %', current_database();
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM doctor.doctors d
        JOIN identity.users u ON u.id = d.user_id
        WHERE d.id = 'f2000000-0000-4000-8000-000000000002'::uuid
          AND u.email = 'doctor.demo@clinic-demo.invalid'
          AND d.active
    ) THEN
        RAISE EXCEPTION 'Demo doctor missing/inactive: no records inserted';
    END IF;

    IF EXISTS (
        SELECT 1 FROM patient.patients p
        WHERE p.id IN (
            'd3000000-0000-4000-8000-000000000001'::uuid,
            'd3000000-0000-4000-8000-000000000002'::uuid,
            'd3000000-0000-4000-8000-000000000003'::uuid,
            'd3000000-0000-4000-8000-000000000004'::uuid
        ) AND (p.user_id IS NOT NULL OR p.full_name NOT LIKE 'DASHBOARD_SEED_30D_20260920%')
    ) THEN
        RAISE EXCEPTION 'Synthetic patient UUID collision; no records inserted';
    END IF;
END;
$seed_check$;

-- Walk-in test profiles with no Identity accounts, phone, address, or medical data.
INSERT INTO patient.patients (id, user_id, full_name, phone, dob, gender, address,
                              blood_type, created_at, updated_at)
VALUES
    ('d3000000-0000-4000-8000-000000000001', NULL, 'DASHBOARD_SEED_30D_20260920 - Bệnh nhân thử 01', NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
    ('d3000000-0000-4000-8000-000000000002', NULL, 'DASHBOARD_SEED_30D_20260920 - Bệnh nhân thử 02', NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
    ('d3000000-0000-4000-8000-000000000003', NULL, 'DASHBOARD_SEED_30D_20260920 - Bệnh nhân thử 03', NULL, NULL, NULL, NULL, NULL, NOW(), NOW()),
    ('d3000000-0000-4000-8000-000000000004', NULL, 'DASHBOARD_SEED_30D_20260920 - Bệnh nhân thử 04', NULL, NULL, NULL, NULL, NULL, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Only working days and slots actually covered by the demo doctor's schedule.
-- Deterministic UUIDs and overlap checks protect pre-existing appointments.
WITH days AS (
    SELECT day::date AS appointment_date
    FROM generate_series(DATE '2026-08-22', DATE '2026-09-20', INTERVAL '1 day') AS calendar(day)
),
slots (slot_no, start_time, end_time) AS (
    VALUES
        (1, TIME '08:00', TIME '08:45'),
        (2, TIME '09:00', TIME '09:45'),
        (3, TIME '10:00', TIME '10:45'),
        (4, TIME '11:00', TIME '11:45')
),
eligible AS (
    SELECT d.appointment_date, s.slot_no, s.start_time, s.end_time
    FROM days d CROSS JOIN slots s
    WHERE EXISTS (
        SELECT 1 FROM doctor.schedules schedule
        WHERE schedule.doctor_id = 'f2000000-0000-4000-8000-000000000002'::uuid
          AND schedule.day_of_week = EXTRACT(ISODOW FROM d.appointment_date)::int
          AND schedule.start_time <= s.start_time AND schedule.end_time >= s.end_time
    )
      AND NOT EXISTS (
          SELECT 1 FROM appointment.appointments existing
          WHERE existing.doctor_id = 'f2000000-0000-4000-8000-000000000002'::uuid
            AND existing.appointment_date = d.appointment_date
            AND existing.start_time < s.end_time AND existing.end_time > s.start_time
      )
)
INSERT INTO appointment.appointments (
    id, patient_id, patient_user_id, doctor_id, appointment_date,
    start_time, end_time, status, reason, created_at, updated_at
)
SELECT
    md5('clinic-dashboard-20260920:appointment:' || e.appointment_date::text || ':' || e.slot_no)::uuid,
    ('d3000000-0000-4000-8000-00000000000' || e.slot_no)::uuid,
    NULL,
    'f2000000-0000-4000-8000-000000000002'::uuid,
    e.appointment_date, e.start_time, e.end_time,
    CASE WHEN e.slot_no = 4 THEN 'CANCELLED' ELSE 'COMPLETED' END,
    '[DASHBOARD_SEED_30D_20260920] Lịch giả lập dùng để thử giao diện',
    e.appointment_date::timestamp - INTERVAL '2 days',
    e.appointment_date + e.end_time
FROM eligible e
JOIN patient.patients p
  ON p.id = ('d3000000-0000-4000-8000-00000000000' || e.slot_no)::uuid
 AND p.user_id IS NULL
 AND p.full_name LIKE 'DASHBOARD_SEED_30D_20260920%'
ON CONFLICT (id) DO NOTHING;

-- Matching synthetic visits, with queue numbers greater than existing tickets.
WITH missing_visits AS (
    SELECT a.*,
           ROW_NUMBER() OVER (
               PARTITION BY a.doctor_id, a.appointment_date
               ORDER BY a.start_time, a.id
           )::int AS offset_no
    FROM appointment.appointments a
    WHERE a.reason = '[DASHBOARD_SEED_30D_20260920] Lịch giả lập dùng để thử giao diện'
      AND a.appointment_date BETWEEN DATE '2026-08-22' AND DATE '2026-09-20'
      AND a.doctor_id = 'f2000000-0000-4000-8000-000000000002'::uuid
      AND a.status = 'COMPLETED'
      AND NOT EXISTS (
          SELECT 1 FROM appointment.reception_visits existing
          WHERE existing.appointment_id = a.id
      )
),
numbered AS (
    SELECT m.*,
           (SELECT COALESCE(MAX(existing.queue_number), 0)
            FROM appointment.reception_visits existing
            WHERE existing.doctor_id = m.doctor_id
              AND existing.visit_date = m.appointment_date
           ) + m.offset_no AS ticket_no
    FROM missing_visits m
)
INSERT INTO appointment.reception_visits (
    id, appointment_id, patient_id, doctor_id, visit_date, queue_number,
    status, checked_in_at, started_at, completed_at, created_at, updated_at
)
SELECT
    md5('clinic-dashboard-20260920:visit:' || n.id::text)::uuid,
    n.id, n.patient_id, n.doctor_id, n.appointment_date, n.ticket_no,
    'COMPLETED',
    n.appointment_date + n.start_time - INTERVAL '10 minutes',
    n.appointment_date + n.start_time + INTERVAL '5 minutes',
    n.appointment_date + n.end_time - INTERVAL '5 minutes',
    n.appointment_date + n.start_time - INTERVAL '10 minutes',
    n.appointment_date + n.end_time - INTERVAL '5 minutes'
FROM numbered n
ON CONFLICT DO NOTHING;

COMMIT;

-- Full 30-day pgAdmin result: weekends = zero because no demo-doctor shift.
SELECT calendar.day::date AS ngay,
       COUNT(a.id) AS lich_hen_thu,
       COUNT(a.id) FILTER (WHERE a.status = 'COMPLETED') AS lich_hoan_thanh,
       COUNT(a.id) FILTER (WHERE a.status = 'CANCELLED') AS lich_da_huy,
       COUNT(v.id) AS luot_checkin_thu
FROM generate_series(DATE '2026-08-22', DATE '2026-09-20', INTERVAL '1 day') AS calendar(day)
LEFT JOIN appointment.appointments a
       ON a.appointment_date = calendar.day::date
      AND a.reason = '[DASHBOARD_SEED_30D_20260920] Lịch giả lập dùng để thử giao diện'
LEFT JOIN appointment.reception_visits v ON v.appointment_id = a.id
GROUP BY calendar.day ORDER BY ngay;

-- Note: the current frontend dashboard requests only TODAY's data. Historic
-- 30-day charts require a separate date-range API/query and UI integration.