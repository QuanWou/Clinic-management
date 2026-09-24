-- CLINIC: SYNTHETIC BILLING TEST FIXTURE ONLY. NEVER RUN AGAINST REAL PATIENT DATA.
-- Run against the local clinic_db AFTER scripts/dashboard_seed_30_days_20260920.sql.
-- Deterministic, additive and repeatable. No real patients, payments, refunds or receipts.
-- 60 completed demo appointments -> 60 UNPAID demo invoices with 100 priced SERVICE items.
-- Seed source evidence and empty finalized laboratory sets are confined to synthetic visits.
-- An invoice is NOT proof of real care, actual payment, or actual money owed.
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('clinic-billing-demo-20260922'));

CREATE TEMP TABLE billing_demo_appointments ON COMMIT DROP AS
SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.start_time, a.end_time
FROM appointment.appointments a
JOIN patient.patients p ON p.id = a.patient_id
WHERE a.reason = '[DASHBOARD_SEED_30D_20260920] Lịch giả lập dùng để thử giao diện'
  AND a.status = 'COMPLETED'
  AND a.appointment_date BETWEEN DATE '2026-08-22' AND DATE '2026-09-20'
  AND a.doctor_id = 'f2000000-0000-4000-8000-000000000002'::uuid
  AND p.user_id IS NULL
  AND p.full_name LIKE 'DASHBOARD_SEED_30D_20260920 - Bệnh nhân thử %'
  AND p.id IN ('d3000000-0000-4000-8000-000000000001'::uuid,
               'd3000000-0000-4000-8000-000000000002'::uuid,
               'd3000000-0000-4000-8000-000000000003'::uuid);

CREATE TEMP TABLE billing_demo_services ON COMMIT DROP AS
SELECT code, title, amount::numeric(12,2) AS amount,
       md5('clinic-billing-demo-20260922:service:' || code)::uuid AS service_id,
       md5('clinic-billing-demo-20260922:price:' || code)::uuid AS price_id
FROM (VALUES
  ('DEMO-CONSULT', 'DỮ LIỆU THỬ - Khám tổng quát', 180000),
  ('DEMO-ECG', 'DỮ LIỆU THỬ - Đo điện tim', 220000),
  ('DEMO-ULTRASOUND', 'DỮ LIỆU THỬ - Siêu âm', 350000)
) AS fixtures(code, title, amount);

DO $guard$
BEGIN
  IF current_database() <> 'clinic_db' THEN
    RAISE EXCEPTION 'Demo seed refused: expected clinic_db';
  END IF;
  IF (SELECT count(*) FROM billing_demo_appointments) <> 60 THEN
    RAISE EXCEPTION 'Demo seed refused: expected exactly 60 matching synthetic completed appointments';
  END IF;
  IF EXISTS (
    SELECT 1 FROM billing_demo_services d JOIN catalog.medical_services s
       ON s.code=d.code OR s.id=d.service_id
    WHERE s.id <> d.service_id OR s.code <> d.code OR s.name <> d.title OR NOT s.active
  ) OR EXISTS (
    SELECT 1 FROM billing_demo_services d JOIN catalog.service_prices p
      ON p.id=d.price_id OR (p.service_id=d.service_id AND p.effective_from=DATE '2026-01-01')
    WHERE p.id <> d.price_id OR p.service_id <> d.service_id OR p.amount <> d.amount
      OR p.currency <> 'VND' OR p.effective_from <> DATE '2026-01-01' OR p.effective_until IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Demo seed refused: demo catalog code, ID or price was changed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM billing_demo_appointments a JOIN billing.invoices i ON i.appointment_id=a.id
    WHERE i.id <> md5('clinic-billing-demo-20260922:invoice:' || a.id::text)::uuid
  ) OR EXISTS (
    SELECT 1 FROM billing_demo_appointments a JOIN medical_record.medical_records r ON r.appointment_id=a.id
    WHERE r.id <> md5('clinic-billing-demo-20260922:medical:' || a.id::text)::uuid
  ) OR EXISTS (
    SELECT 1 FROM billing_demo_appointments a JOIN appointment.performed_services s ON s.appointment_id=a.id
    WHERE s.id NOT IN (
      md5('clinic-billing-demo-20260922:performed:' || a.id::text || ':DEMO-CONSULT')::uuid,
      md5('clinic-billing-demo-20260922:performed:' || a.id::text || ':DEMO-ECG')::uuid,
      md5('clinic-billing-demo-20260922:performed:' || a.id::text || ':DEMO-ULTRASOUND')::uuid)
  ) OR EXISTS (
    SELECT 1 FROM billing_demo_appointments a JOIN medical_record.lab_orders l
      ON l.medical_record_id=md5('clinic-billing-demo-20260922:medical:' || a.id::text)::uuid
  ) THEN
    RAISE EXCEPTION 'Demo seed refused: an appointment already has non-demo billing/clinical data';
  END IF;
END;
$guard$;

INSERT INTO catalog.medical_services (id, code, name, description, active)
SELECT service_id, code, title, 'Dữ liệu thử nghiệm, không phải dịch vụ đã thực hiện thực tế', true
FROM billing_demo_services ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.service_prices (id, service_id, amount, currency, effective_from, effective_until)
SELECT price_id, service_id, amount, 'VND', DATE '2026-01-01', NULL
FROM billing_demo_services ON CONFLICT (id) DO NOTHING;

-- Placeholder synthetic records only so lab finalization has its usual parent record.
-- No genuine symptoms, diagnosis, tests or prescriptions are invented.
INSERT INTO medical_record.medical_records
  (id, appointment_id, patient_id, doctor_id, diagnosis, notes, created_at, updated_at)
SELECT md5('clinic-billing-demo-20260922:medical:' || a.id::text)::uuid,
       a.id, a.patient_id, a.doctor_id,
       '[DEMO] Không phải chẩn đoán y khoa',
       '[DEMO] Hồ sơ mẫu chỉ để kiểm thử phát hành hóa đơn; không có khám bệnh thật.',
       a.appointment_date + a.end_time, a.appointment_date + a.end_time
FROM billing_demo_appointments a ON CONFLICT (appointment_id) DO NOTHING;

-- Every synthetic visit has a consultation; visits at 09:00 also have ECG,
-- visits at 10:00 also have ultrasound. Catalog prices are authoritative.
INSERT INTO appointment.performed_services
  (id, appointment_id, service_id, quantity, service_date, created_at)
SELECT md5('clinic-billing-demo-20260922:performed:' || a.id::text || ':' || s.code)::uuid,
       a.id, s.service_id, 1, a.appointment_date, a.appointment_date + a.end_time
FROM billing_demo_appointments a CROSS JOIN billing_demo_services s
WHERE s.code='DEMO-CONSULT'
   OR (s.code='DEMO-ECG' AND a.start_time=TIME '09:00')
   OR (s.code='DEMO-ULTRASOUND' AND a.start_time=TIME '10:00')
ON CONFLICT (id) DO NOTHING;

INSERT INTO appointment.appointment_billing_closures
  (appointment_id, finalized, revision, finalized_at, version)
SELECT a.id, true, md5('clinic-billing-demo-20260922:performed-revision:' || a.id::text)::uuid::text,
       a.appointment_date + a.end_time + INTERVAL '5 minutes', 0
FROM billing_demo_appointments a ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO medical_record.lab_billing_closures
  (appointment_id, finalized, revision, finalized_at, version)
SELECT a.id, true, md5('clinic-billing-demo-20260922:lab-revision:' || a.id::text)::uuid::text,
       a.appointment_date + a.end_time + INTERVAL '6 minutes', 0
FROM billing_demo_appointments a ON CONFLICT (appointment_id) DO NOTHING;

-- All invoices remain UNPAID. Never invent CAPTURE transactions or mark PAID.
WITH priced AS (
  SELECT a.id AS appointment_id, a.patient_id, a.appointment_date, a.end_time,
         SUM(s.quantity * p.amount)::numeric(12,2) AS total_amount
  FROM billing_demo_appointments a
  JOIN appointment.performed_services s ON s.appointment_id=a.id
  JOIN catalog.service_prices p ON p.service_id=s.service_id
    AND p.effective_from<=s.service_date
    AND (p.effective_until IS NULL OR s.service_date<p.effective_until)
  GROUP BY a.id, a.patient_id, a.appointment_date, a.end_time
)
INSERT INTO billing.invoices
  (id, patient_id, appointment_id, total_amount, status, payment_method,
   catalog_revision, currency, performed_revision, lab_revision, created_at, updated_at)
SELECT md5('clinic-billing-demo-20260922:invoice:' || a.appointment_id::text)::uuid,
       a.patient_id, a.appointment_id, a.total_amount, 'UNPAID', NULL,
       'PRICE_IDS_PER_ITEM', 'VND', c.revision, lab.revision,
       a.appointment_date + a.end_time + INTERVAL '7 minutes',
       a.appointment_date + a.end_time + INTERVAL '7 minutes'
FROM priced a
JOIN appointment.appointment_billing_closures c ON c.appointment_id=a.appointment_id AND c.finalized
JOIN medical_record.lab_billing_closures lab ON lab.appointment_id=a.appointment_id AND lab.finalized
ON CONFLICT (appointment_id) DO NOTHING;

INSERT INTO billing.invoice_items
  (id, invoice_id, source_type, source_id, service_id, service_code, service_name,
   price_id, service_date, unit_price, quantity, line_amount, currency, created_at, updated_at)
SELECT md5('clinic-billing-demo-20260922:item:' || s.id::text)::uuid,
       i.id, 'SERVICE', s.id, s.service_id, catalog.code, catalog.name,
       p.id, s.service_date, p.amount, s.quantity, p.amount*s.quantity, 'VND',
       a.appointment_date + a.end_time + INTERVAL '7 minutes',
       a.appointment_date + a.end_time + INTERVAL '7 minutes'
FROM billing_demo_appointments a
JOIN appointment.performed_services s ON s.appointment_id=a.id
JOIN billing.invoices i ON i.appointment_id=a.id
JOIN catalog.medical_services catalog ON catalog.id=s.service_id
JOIN catalog.service_prices p ON p.service_id=s.service_id
  AND p.effective_from<=s.service_date
  AND (p.effective_until IS NULL OR s.service_date<p.effective_until)
ON CONFLICT (source_type, source_id) DO NOTHING;

DO $verify$
DECLARE invoice_count INTEGER; item_count INTEGER;
BEGIN
  SELECT count(*) INTO invoice_count FROM billing.invoices i
    JOIN billing_demo_appointments a ON a.id=i.appointment_id;
  SELECT count(*) INTO item_count FROM billing.invoice_items item
    JOIN billing.invoices i ON i.id=item.invoice_id
    JOIN billing_demo_appointments a ON a.id=i.appointment_id;
  IF invoice_count<>60 OR item_count<>100 THEN
    RAISE EXCEPTION 'Demo seed rolled back: expected 60 invoices/100 items, got %/%', invoice_count,item_count;
  END IF;
  IF EXISTS (
    SELECT 1 FROM billing.invoices i JOIN billing_demo_appointments a ON a.id=i.appointment_id
    LEFT JOIN billing.invoice_items item ON item.invoice_id=i.id
    GROUP BY i.id HAVING i.total_amount<>COALESCE(SUM(item.line_amount),0)
  ) THEN
    RAISE EXCEPTION 'Demo seed rolled back: invoice totals differ from item snapshots';
  END IF;
END;
$verify$;
COMMIT;

SELECT p.patient_code, p.full_name, COUNT(*) AS demo_invoices,
       COUNT(*) FILTER (WHERE i.status='UNPAID') AS unpaid,
       SUM(i.total_amount) AS sample_total_vnd
FROM billing.invoices i
JOIN patient.patients p ON p.id=i.patient_id
WHERE i.id IN (SELECT md5('clinic-billing-demo-20260922:invoice:' || a.id::text)::uuid
               FROM appointment.appointments a
               WHERE a.reason='[DASHBOARD_SEED_30D_20260920] Lịch giả lập dùng để thử giao diện'
                 AND a.status='COMPLETED')
GROUP BY p.patient_code, p.full_name ORDER BY p.patient_code;
