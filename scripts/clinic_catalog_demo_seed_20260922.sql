-- Clinic local DEV / QA catalog fixtures ONLY (NOT an approved clinical formulary or real price list).
-- Apply ONLY to the local Docker clinic_db: docker cp scripts/... clinic-postgres:/tmp/clinic_catalog_demo_seed.sql
-- then docker exec clinic-postgres psql -X -v ON_ERROR_STOP=1 -U postgres -d clinic_db -f /tmp/clinic_catalog_demo_seed.sql
-- Additive, repeatable and transactionally guarded. Does not modify existing catalog rows,
-- specialties, patients, appointments, invoices, prescriptions, stock or payment transactions.
-- No drug instructions or clinical recommendations are provided by these sample names.
\set ON_ERROR_STOP on
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('clinic-catalog-demo-seed-20260922'));

CREATE TEMP TABLE fixture_services ON COMMIT DROP AS
SELECT code, 'DỮ LIỆU THỬ - ' || label AS name,
       '[DEMO / QA] Nhóm ' || category || '; giá minh họa phục vụ kiểm thử, không phải báo giá thực tế hay bằng chứng đã cung cấp dịch vụ.' AS description,
       amount::numeric(12,2) AS amount,
       md5('clinic-catalog-demo-v1:service:' || code)::uuid AS id,
       md5('clinic-catalog-demo-v1:price:' || code)::uuid AS price_id
FROM (VALUES
 ('DEMO-CAT-S001','Khám nội tổng quát','khám',180000),
 ('DEMO-CAT-S002','Khám tim mạch','khám',250000),
 ('DEMO-CAT-S003','Khám thần kinh','khám',260000),
 ('DEMO-CAT-S004','Khám ung bướu','khám',320000),
 ('DEMO-CAT-S005','Khám cơ xương khớp','khám',230000),
 ('DEMO-CAT-S006','Khám nhi','khám',200000),
 ('DEMO-CAT-S007','Tái khám nội tổng quát','khám',120000),
 ('DEMO-CAT-S008','Khám trước phẫu thuật','khám',320000),
 ('DEMO-CAT-S009','Khám da liễu','khám',220000),
 ('DEMO-CAT-S010','Khám tai mũi họng','khám',220000),
 ('DEMO-CAT-S011','Khám mắt','khám',230000),
 ('DEMO-CAT-S012','Khám sức khỏe định kỳ','khám',450000),
 ('DEMO-CAT-S013','Điện tim 12 chuyển đạo','thăm dò chức năng',150000),
 ('DEMO-CAT-S014','Siêu âm ổ bụng','chẩn đoán hình ảnh',260000),
 ('DEMO-CAT-S015','Siêu âm tim','chẩn đoán hình ảnh',420000),
 ('DEMO-CAT-S016','Siêu âm tuyến giáp','chẩn đoán hình ảnh',250000),
 ('DEMO-CAT-S017','X-quang ngực thẳng','chẩn đoán hình ảnh',220000),
 ('DEMO-CAT-S018','X-quang cột sống','chẩn đoán hình ảnh',280000),
 ('DEMO-CAT-S019','Công thức máu','xét nghiệm',110000),
 ('DEMO-CAT-S020','Đường huyết','xét nghiệm',65000),
 ('DEMO-CAT-S021','HbA1c','xét nghiệm',180000),
 ('DEMO-CAT-S022','Bộ mỡ máu','xét nghiệm',165000),
 ('DEMO-CAT-S023','Bộ chức năng gan','xét nghiệm',220000),
 ('DEMO-CAT-S024','Bộ chức năng thận','xét nghiệm',190000),
 ('DEMO-CAT-S025','Tổng phân tích nước tiểu','xét nghiệm',90000),
 ('DEMO-CAT-S026','CRP','xét nghiệm',120000),
 ('DEMO-CAT-S027','TSH','xét nghiệm',220000),
 ('DEMO-CAT-S028','Test nhanh cúm','xét nghiệm',170000),
 ('DEMO-CAT-S029','Điện giải đồ','xét nghiệm',175000),
 ('DEMO-CAT-S030','Đo huyết áp và tư vấn','theo dõi',80000)
) AS v(code,label,category,amount);

CREATE TEMP TABLE fixture_medicines ON COMMIT DROP AS
SELECT code, 'DỮ LIỆU THỬ - ' || label AS name, unit,
       '[DEMO / QA] Chỉ để thử tra cứu danh mục, không dùng để kê đơn, cấp phát, chỉ định hay hướng dẫn điều trị.' AS description,
       md5('clinic-catalog-demo-v1:medicine:' || code)::uuid AS id
FROM (VALUES
 ('DEMO-CAT-M001','Paracetamol 500 mg','Viên'),
 ('DEMO-CAT-M002','Ibuprofen 200 mg','Viên'),
 ('DEMO-CAT-M003','Amoxicillin 500 mg','Viên'),
 ('DEMO-CAT-M004','Azithromycin 250 mg','Viên'),
 ('DEMO-CAT-M005','Cefuroxime 500 mg','Viên'),
 ('DEMO-CAT-M006','Cetirizine 10 mg','Viên'),
 ('DEMO-CAT-M007','Loratadine 10 mg','Viên'),
 ('DEMO-CAT-M008','Omeprazole 20 mg','Viên'),
 ('DEMO-CAT-M009','Esomeprazole 20 mg','Viên'),
 ('DEMO-CAT-M010','Pantoprazole 40 mg','Viên'),
 ('DEMO-CAT-M011','Metformin 500 mg','Viên'),
 ('DEMO-CAT-M012','Amlodipine 5 mg','Viên'),
 ('DEMO-CAT-M013','Losartan 50 mg','Viên'),
 ('DEMO-CAT-M014','Atorvastatin 10 mg','Viên'),
 ('DEMO-CAT-M015','Rosuvastatin 10 mg','Viên'),
 ('DEMO-CAT-M016','Salbutamol bình xịt 100 microgam','Bình'),
 ('DEMO-CAT-M017','Budesonide xịt mũi 64 microgam','Chai'),
 ('DEMO-CAT-M018','Gói bù nước và điện giải','Gói'),
 ('DEMO-CAT-M019','Natri clorid 0,9% 500 ml','Chai'),
 ('DEMO-CAT-M020','Glucose 5% 500 ml','Chai'),
 ('DEMO-CAT-M021','Kẽm sulfat 20 mg','Viên'),
 ('DEMO-CAT-M022','Sắt fumarat 200 mg','Viên'),
 ('DEMO-CAT-M023','Acid folic 5 mg','Viên'),
 ('DEMO-CAT-M024','Vitamin D3 1000 IU','Viên'),
 ('DEMO-CAT-M025','Vitamin B1 100 mg','Viên'),
 ('DEMO-CAT-M026','Calci carbonat 500 mg','Viên'),
 ('DEMO-CAT-M027','Acetylcysteine 200 mg','Gói'),
 ('DEMO-CAT-M028','Ambroxol 30 mg','Viên'),
 ('DEMO-CAT-M029','Domperidone 10 mg','Viên'),
 ('DEMO-CAT-M030','Simethicone 80 mg','Viên')
) AS v(code,label,unit);

DO $guard$
BEGIN
  IF current_database() <> 'clinic_db' THEN
    RAISE EXCEPTION 'Demo catalog seed refused: expected local clinic_db';
  END IF;
  IF (SELECT count(*) FROM fixture_services) <> 30 OR (SELECT count(*) FROM fixture_medicines) <> 30
     OR (SELECT count(DISTINCT code) FROM fixture_services) <> 30
     OR (SELECT count(DISTINCT code) FROM fixture_medicines) <> 30 THEN
    RAISE EXCEPTION 'Demo catalog seed refused: fixture counts or codes have changed';
  END IF;
  -- Never take over a real row's code/ID, even with different capitalization.
  IF EXISTS (SELECT 1 FROM fixture_services f JOIN catalog.medical_services s
             ON lower(s.code)=lower(f.code) OR s.id=f.id
             WHERE s.code<>f.code OR s.id<>f.id)
     OR EXISTS (SELECT 1 FROM fixture_medicines f JOIN catalog.medicines m
             ON lower(m.code)=lower(f.code) OR m.id=f.id
             WHERE m.code<>f.code OR m.id<>f.id) THEN
    RAISE EXCEPTION 'Demo catalog seed refused: ID/code collides with pre-existing catalog';
  END IF;
  -- Respect the DB exclusion constraint: never overlap a colleague's price interval.
  IF EXISTS (SELECT 1 FROM fixture_services f JOIN catalog.service_prices p
             ON p.id=f.price_id OR (p.service_id=f.id AND
                 daterange(p.effective_from,p.effective_until,'[)') && daterange(DATE '2026-01-01',NULL,'[)'))
             WHERE p.id<>f.price_id OR p.service_id<>f.id OR p.effective_from<>DATE '2026-01-01'
               OR p.effective_until IS NOT NULL) THEN
    RAISE EXCEPTION 'Demo catalog seed refused: conflicting/overlapping price for demo service';
  END IF;
END;
$guard$;

INSERT INTO catalog.medical_services (id,code,name,description,active)
SELECT id,code,name,description,true FROM fixture_services
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.medicines (id,code,name,unit,description,active)
SELECT id,code,name,unit,description,true FROM fixture_medicines
ON CONFLICT (id) DO NOTHING;

INSERT INTO catalog.service_prices (id,service_id,amount,currency,effective_from,effective_until)
SELECT price_id,id,amount,'VND',DATE '2026-01-01',NULL FROM fixture_services
WHERE NOT EXISTS (SELECT 1 FROM catalog.service_prices p WHERE p.service_id=fixture_services.id)
ON CONFLICT (id) DO NOTHING;

DO $verify$
BEGIN
  IF (SELECT count(*) FROM fixture_services f JOIN catalog.medical_services s ON s.id=f.id AND s.code=f.code) <> 30
     OR (SELECT count(*) FROM fixture_medicines f JOIN catalog.medicines m ON m.id=f.id AND m.code=f.code) <> 30
     OR (SELECT count(*) FROM fixture_services f JOIN catalog.service_prices p ON p.id=f.price_id AND p.service_id=f.id) <> 30 THEN
    RAISE EXCEPTION 'Demo catalog seed verification failed: expected all 30 services, 30 medicines and 30 prices';
  END IF;
  IF EXISTS (SELECT 1 FROM fixture_services f JOIN catalog.service_prices p ON p.id=f.price_id
             WHERE p.amount<>f.amount OR p.currency<>'VND' OR p.effective_from<>DATE '2026-01-01' OR p.effective_until IS NOT NULL) THEN
    RAISE EXCEPTION 'Demo catalog seed verification failed: fixture prices were modified; no overwrites performed';
  END IF;
END;
$verify$;
COMMIT;

SELECT 'medical_services' AS section, count(*) AS rows FROM catalog.medical_services
UNION ALL SELECT 'medicines',count(*) FROM catalog.medicines
UNION ALL SELECT 'service_prices',count(*) FROM catalog.service_prices
UNION ALL SELECT 'specialties',count(*) FROM doctor.specialties;
SELECT 'catalog_demo_services' AS section, count(*) AS rows FROM catalog.medical_services WHERE code LIKE 'DEMO-CAT-S%'
UNION ALL SELECT 'catalog_demo_medicines',count(*) FROM catalog.medicines WHERE code LIKE 'DEMO-CAT-M%';
