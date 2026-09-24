-- FICTIONAL DATA ONLY. Run AFTER demo-bulk-clinic-data.sql, never in production.
-- Enrich only reserved e-prefix fixtures, preserve all other patients/appointments.
-- Safe to repeat: deterministic updates and idempotent inserts.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF current_database() <> 'clinic_db' OR
     (SELECT count(*) FROM patient.patients WHERE id::text LIKE 'e2000000-0000-4000-8000-%') <> 500 OR
     (SELECT count(*) FROM doctor.doctors WHERE id::text LIKE 'e1000000-0000-4000-8000-%') <> 18 OR
     (SELECT count(*) FROM appointment.appointments WHERE id::text LIKE 'e3000000-0000-4000-8000-%') <> 2400 OR
     (SELECT count(*) FROM medical_record.medical_records WHERE id::text LIKE 'e4000000-0000-4000-8000-%') <> 1600 OR
     EXISTS (SELECT 1 FROM identity.users WHERE id::text LIKE 'e0000000-0000-4000-8000-%' AND email NOT LIKE 'demo-clinic-bulk-doctor-%@example.invalid') OR
     EXISTS (SELECT 1 FROM patient.patients p WHERE p.id::text LIKE 'e2000000-0000-4000-8000-%' AND p.user_id IS NOT NULL AND p.user_id <> ('e8000000-0000-4000-8000-' || right(p.id::text, 12))::uuid) THEN
    RAISE EXCEPTION 'Fixture ownership/size mismatch: refusing to modify data';
  END IF;
END $$;

-- Realistic fictional Vietnamese names, age bands and broad locations; no actual contacts.
WITH numbered AS (
  SELECT p.id, right(p.id::text,12)::integer AS n FROM patient.patients p
  WHERE p.id::text LIKE 'e2000000-0000-4000-8000-%'
), names AS (
  SELECT id,n,
    (ARRAY['Nguyễn','Trần','Lê','Phạm','Hoàng','Huỳnh','Phan','Vũ','Võ','Đặng','Bùi','Đỗ','Hồ'])[1 + ((n*7)%13)] AS family,
    CASE WHEN n%2=0 THEN (ARRAY['Thị','Ngọc','Thanh','Thu','Mai'])[1+(n%5)]
         ELSE (ARRAY['Văn','Minh','Quốc','Đức','Gia'])[1+(n%5)] END AS middle,
    CASE WHEN n%2=0 THEN (ARRAY['Anh','Bích','Châu','Dung','Giang','Hà','Hạnh','Hoa','Hương','Khánh','Lan','Linh','Mai','My','Nga','Ngân','Ngọc','Nhung','Oanh','Phương','Quỳnh','Thảo','Thủy','Trang','Trâm','Trinh','Tú','Uyên','Vy','Yến','Diệp'])[1+((n*17)%31)]
         ELSE (ARRAY['An','Bách','Bình','Cường','Dân','Đạt','Dũng','Đức','Hải','Hiếu','Hoàng','Huy','Hùng','Khang','Khánh','Kiên','Long','Minh','Nam','Nghĩa','Phong','Phúc','Quân','Sơn','Thành','Thiện','Trí','Trung','Tuấn','Việt','Vinh'])[1+((n*17)%31)] END AS given
  FROM numbered
)
UPDATE patient.patients p SET
 full_name = names.family || ' ' || names.middle || ' ' || names.given,
 dob = CASE WHEN names.n <= 80 THEN DATE '2010-01-01' + ((names.n*179)%4700)
            ELSE DATE '1945-01-01' + ((names.n*97)%22500) END,
 gender = CASE WHEN names.n%2=0 THEN 'FEMALE' ELSE 'MALE' END,
 address = (ARRAY['Ba Đình, Hà Nội','Cầu Giấy, Hà Nội','Thanh Xuân, Hà Nội','Hai Bà Trưng, Hà Nội','Đống Đa, Hà Nội','Hà Đông, Hà Nội','Long Biên, Hà Nội','Hoàng Mai, Hà Nội','Tây Hồ, Hà Nội','Nam Từ Liêm, Hà Nội'])[1+(names.n%10)] || ' [ĐỊA CHỈ GIẢ LẬP]',
 phone = NULL,
 blood_type = NULL
FROM names WHERE p.id=names.id;

-- Twenty-ish specialty-appropriate fictional doctors, Identity is display-name source.
WITH names AS (
 SELECT ('e0000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid AS user_id,
  (ARRAY['Nguyễn Minh Khôi','Trần Thanh Tùng','Lê Thị Minh Anh','Phạm Quốc Huy','Hoàng Thu Hà','Vũ Đức Long','Đặng Ngọc Mai','Bùi Văn Nam','Đỗ Thị Hạnh','Phan Quang Minh','Võ Thanh Bình','Hồ Ngọc Lan','Nguyễn Hải Đăng','Trần Thị Thu Trang','Lê Đức Anh','Phạm Thị Diệu Linh','Hoàng Gia Bảo','Vũ Thị Quỳnh Anh'])[n] AS display_name
 FROM generate_series(1,18) AS n
)
UPDATE identity.users u SET full_name=names.display_name
FROM names WHERE u.id=names.user_id;

UPDATE doctor.doctors d SET
 biography = 'Bác sĩ chuyên khoa ' || s.name || '. Hồ sơ nhân sự mô phỏng phục vụ thử nghiệm phần mềm; không đại diện người hành nghề thật.',
 consultation_fee = (150000 + (right(d.id::text,12)::integer % 6)*30000)::numeric
FROM doctor.specialties s WHERE d.specialty_id=s.id AND d.id::text LIKE 'e1000000-0000-4000-8000-%';

-- One hundred controlled linked patient profiles, with non-deliverable addresses and
-- randomized unknown BCrypt passwords. Do not treat these as interactive login fixtures.
INSERT INTO identity.users (id,email,password_hash,full_name,phone,status,created_at,updated_at)
SELECT ('e8000000-0000-4000-8000-' || right(p.id::text,12))::uuid,
       'simulated-patient-' || right(p.id::text,12)::integer || '@example.invalid',
       crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf',10)),
       p.full_name, NULL, 'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM patient.patients p
WHERE p.id::text LIKE 'e2000000-0000-4000-8000-%'
 AND right(p.id::text,12)::integer BETWEEN 81 AND 180
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity.user_roles (user_id,role_id)
SELECT u.id,r.id FROM identity.users u CROSS JOIN identity.roles r
WHERE u.id::text LIKE 'e8000000-0000-4000-8000-%' AND r.code='ROLE_PATIENT'
ON CONFLICT (user_id,role_id) DO NOTHING;

UPDATE patient.patients p SET user_id=u.id
FROM identity.users u
WHERE p.id::text LIKE 'e2000000-0000-4000-8000-%'
 AND right(p.id::text,12)::integer BETWEEN 81 AND 180
 AND u.id=('e8000000-0000-4000-8000-' || right(p.id::text,12))::uuid
 AND p.user_id IS DISTINCT FROM u.id;

-- Synchronize display names on re-run too (repairs legacy non-UTF-8 imports).
UPDATE identity.users u SET full_name=p.full_name
FROM patient.patients p
WHERE p.id::text LIKE 'e2000000-0000-4000-8000-%'
 AND right(p.id::text,12)::integer BETWEEN 81 AND 180
 AND u.id=('e8000000-0000-4000-8000-' || right(p.id::text,12))::uuid
 AND u.email LIKE 'simulated-patient-%@example.invalid'
 AND u.full_name IS DISTINCT FROM p.full_name;

-- For pediatric appointments, use children aged about 4-16; other specialties
-- use the adult patient pool. Keep clinical-record ownership in sync below.
WITH targets AS (
 SELECT a.id,
 CASE WHEN d.specialty_id='10000000-0000-0000-0000-000000000006'::uuid
 THEN ('e2000000-0000-4000-8000-' || lpad((1+((right(a.id::text,12)::integer*7)%80))::text,12,'0'))::uuid
 ELSE ('e2000000-0000-4000-8000-' || lpad((81+((right(a.id::text,12)::integer*37)%420))::text,12,'0'))::uuid END AS target_patient
 FROM appointment.appointments a JOIN doctor.doctors d ON d.id=a.doctor_id
 WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%'
)
UPDATE appointment.appointments a SET patient_id=t.target_patient
FROM targets t WHERE a.id=t.id AND a.patient_id IS DISTINCT FROM t.target_patient;

UPDATE medical_record.medical_records m SET patient_id=a.patient_id
FROM appointment.appointments a
WHERE m.appointment_id=a.id AND m.id::text LIKE 'e4000000-0000-4000-8000-%'
 AND m.patient_id IS DISTINCT FROM a.patient_id;

-- Distinct presenting complaints by specialty, with lifecycle-consistent timestamps.
WITH scenarios AS (
 SELECT a.id,a.status,a.appointment_date,a.end_time,
  right(a.id::text,12)::integer AS n,right(d.specialty_id::text,12)::integer AS specialty
 FROM appointment.appointments a JOIN doctor.doctors d ON d.id=a.doctor_id
 WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%'
), complaints AS (
 SELECT id,n,status,appointment_date,end_time,
 CASE specialty
  WHEN 1 THEN (ARRAY['Khám hồi hộp, đánh trống ngực','Đo huyết áp định kỳ','Tái khám tim mạch','Tư vấn nguy cơ tim mạch'])[1+n%4]
  WHEN 2 THEN (ARRAY['Ho và nghẹt mũi','Khám sức khỏe tổng quát','Đau họng, mệt mỏi','Tái khám nội tổng quát'])[1+n%4]
  WHEN 3 THEN (ARRAY['Đau đầu từng cơn','Khó ngủ kéo dài','Chóng mặt khi thay đổi tư thế','Tái khám thần kinh'])[1+n%4]
  WHEN 4 THEN (ARRAY['Tư vấn theo dõi sức khỏe','Đánh giá triệu chứng kéo dài','Hẹn trao đổi kế hoạch theo dõi','Tái khám theo lịch chuyên khoa'])[1+n%4]
  WHEN 5 THEN (ARRAY['Đau khớp gối khi vận động','Đau vùng vai','Căng cơ sau vận động','Tái khám cơ xương khớp'])[1+n%4]
  ELSE (ARRAY['Trẻ ho, sổ mũi','Khám tăng trưởng định kỳ','Trẻ sốt nhẹ','Tái khám nhi khoa'])[1+n%4]
 END AS complaint
 FROM scenarios
)
UPDATE appointment.appointments a SET
 reason=CASE WHEN c.status='CANCELLED' THEN 'Bệnh nhân xin hủy/đổi lịch khám'
             ELSE c.complaint END || ' [DỮ LIỆU GIẢ LẬP]',
 created_at=CASE WHEN c.appointment_date <= DATE '2026-09-21'
                 THEN c.appointment_date + TIME '09:00' - ((1+c.n%9)*INTERVAL '1 day')
                 ELSE DATE '2026-09-21' + TIME '09:00' - ((1+c.n%7)*INTERVAL '1 day') END,
 updated_at=CASE WHEN c.status='COMPLETED' THEN c.appointment_date + c.end_time + INTERVAL '10 minutes'
                 WHEN c.status='CANCELLED' THEN c.appointment_date + TIME '09:00' - INTERVAL '1 day'
                 ELSE DATE '2026-09-21' + TIME '11:00' - ((c.n%7)*INTERVAL '1 day') END
FROM complaints c WHERE a.id=c.id;

-- Specialty-aligned but obviously synthetic clinical vignettes. No treatment advice.
WITH scenario AS (
 SELECT m.id,m.appointment_id,right(m.id::text,12)::integer n,
        right(d.specialty_id::text,12)::integer specialty,
        a.appointment_date,a.end_time
 FROM medical_record.medical_records m
 JOIN doctor.doctors d ON d.id=m.doctor_id
 JOIN appointment.appointments a ON a.id=m.appointment_id
 WHERE m.id::text LIKE 'e4000000-0000-4000-8000-%'
), content AS (
 SELECT id,appointment_date,end_time,n,
 CASE specialty
  WHEN 1 THEN (ARRAY['Đánh trống ngực vài phút, không ghi nhận đau ngực trong kịch bản.','Theo dõi huyết áp tại nhà theo lời kể giả lập.','Khám lại sau lần tư vấn tim mạch trước trong kịch bản.'])[1+n%3]
  WHEN 2 THEN (ARRAY['Ho nhẹ, nghẹt mũi hai ngày.','Khám sức khỏe định kỳ, chưa ghi nhận triệu chứng nổi bật.','Đau họng và mệt mỏi thoáng qua.'])[1+n%3]
  WHEN 3 THEN (ARRAY['Đau đầu nhẹ từng đợt, chưa có dữ liệu cận lâm sàng.','Khó ngủ, mệt vào buổi sáng theo lời kể giả lập.','Chóng mặt thoáng qua khi đứng dậy.'])[1+n%3]
  WHEN 4 THEN (ARRAY['Đến khám theo lịch, dữ liệu giả lập không có kết quả xét nghiệm.','Tư vấn theo dõi triệu chứng trong hồ sơ mẫu.','Người bệnh xin đánh giá thêm, chưa có bằng chứng chẩn đoán.'])[1+n%3]
  WHEN 5 THEN (ARRAY['Đau gối khi đi bộ, chưa ghi nhận chấn thương nặng.','Mỏi vai khi làm việc kéo dài.','Căng cơ nhẹ sau vận động theo kịch bản.'])[1+n%3]
  ELSE (ARRAY['Trẻ ho và sổ mũi, phụ huynh đưa đến khám.','Khám tăng trưởng định kỳ cho trẻ trong kịch bản.','Trẻ sốt nhẹ theo thông tin phụ huynh giả lập.'])[1+n%3]
 END symptoms,
 CASE specialty
  WHEN 1 THEN 'Triệu chứng tim mạch cần đánh giá thêm (giả lập)'
  WHEN 2 THEN 'Triệu chứng hô hấp trên / khám tổng quát (giả lập)'
  WHEN 3 THEN 'Đau đầu hoặc chóng mặt chưa xác định nguyên nhân (giả lập)'
  WHEN 4 THEN 'Theo dõi chuyên khoa; không xác nhận bệnh lý ác tính (giả lập)'
  WHEN 5 THEN 'Đau cơ xương khớp chưa xác định nguyên nhân (giả lập)'
  ELSE 'Theo dõi triệu chứng nhi khoa (giả lập)'
 END diagnosis
 FROM scenario
)
UPDATE medical_record.medical_records m SET
 symptoms=c.symptoms,diagnosis=c.diagnosis,
 notes='[DỮ LIỆU Y TẾ GIẢ LẬP - KHÔNG DÙNG CHẨN ĐOÁN / ĐIỀU TRỊ] Hồ sơ phục vụ kiểm thử hiển thị, phân quyền và liên kết lịch khám. Mã tình huống: ' || lpad((c.n%24+1)::text,2,'0') || '.',
 created_at=c.appointment_date+c.end_time+INTERVAL '10 minutes',
 updated_at=c.appointment_date+c.end_time+INTERVAL '10 minutes'
FROM content c WHERE m.id=c.id;

-- Completed check-in/queue history, never check in cancelled or future bookings.
WITH ordered AS (
 SELECT a.*,row_number() OVER (PARTITION BY a.doctor_id,a.appointment_date ORDER BY a.start_time,a.id)::integer AS ticket
 FROM appointment.appointments a
 WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%' AND a.status='COMPLETED'
)
INSERT INTO appointment.reception_visits
(id,appointment_id,patient_id,doctor_id,visit_date,queue_number,status,checked_in_at,started_at,completed_at,created_at,updated_at)
SELECT ('e5000000-0000-4000-8000-'||right(a.id::text,12))::uuid,
 a.id,a.patient_id,a.doctor_id,a.appointment_date,a.ticket,'COMPLETED',
 a.appointment_date+a.start_time-INTERVAL '12 minutes',
 a.appointment_date+a.start_time,
 a.appointment_date+a.end_time,
 a.appointment_date+a.start_time-INTERVAL '12 minutes',
 a.appointment_date+a.end_time
FROM ordered a ON CONFLICT (id) DO NOTHING;

-- Mock prescription UI only. No real medication, dose, frequency, duration or advice.
INSERT INTO medical_record.prescriptions (id,medical_record_id,created_at)
SELECT ('e6000000-0000-4000-8000-'||right(m.id::text,12))::uuid,m.id,m.created_at
FROM medical_record.medical_records m
WHERE m.id::text LIKE 'e4000000-0000-4000-8000-%'
 AND right(m.id::text,12)::integer%3=0
ON CONFLICT (id) DO NOTHING;

INSERT INTO medical_record.prescription_items
(id,prescription_id,medicine_name,dosage,frequency,duration,note)
SELECT ('e6100000-0000-4000-8000-'||right(rx.id::text,12))::uuid,
 rx.id,'THUỐC MẪU - KHÔNG CẤP PHÁT','Không áp dụng (demo)',
 'Không áp dụng (demo)','Không áp dụng (demo)',
 '[DỮ LIỆU GIẢ LẬP] Chỉ để kiểm tra giao diện đơn thuốc; không dùng điều trị.'
FROM medical_record.prescriptions rx
WHERE rx.id::text LIKE 'e6000000-0000-4000-8000-%'
ON CONFLICT (id) DO UPDATE SET
 medicine_name=EXCLUDED.medicine_name, dosage=EXCLUDED.dosage,
 frequency=EXCLUDED.frequency, duration=EXCLUDED.duration, note=EXCLUDED.note;

DO $check$
BEGIN
 IF (SELECT count(*) FROM identity.users WHERE id::text LIKE 'e8000000-0000-4000-8000-%') <>100
 OR (SELECT count(*) FROM appointment.reception_visits WHERE id::text LIKE 'e5000000-0000-4000-8000-%') <>1600
 OR (SELECT count(*) FROM medical_record.medical_records WHERE id::text LIKE 'e4000000-0000-4000-8000-%') <>1600
 OR EXISTS (SELECT 1 FROM medical_record.medical_records m JOIN appointment.appointments a ON a.id=m.appointment_id
            WHERE m.id::text LIKE 'e4000000-0000-4000-8000-%'
              AND (m.patient_id<>a.patient_id OR m.doctor_id<>a.doctor_id OR a.status<>'COMPLETED'))
 OR EXISTS (SELECT 1 FROM appointment.appointments a JOIN doctor.doctors d ON d.id=a.doctor_id JOIN patient.patients p ON p.id=a.patient_id
            WHERE a.id::text LIKE 'e3000000-0000-4000-8000-%'
              AND ((d.specialty_id='10000000-0000-0000-0000-000000000006'::uuid AND p.dob>DATE '2010-01-01'+4700)
                OR (a.status='COMPLETED' AND a.appointment_date>DATE '2026-09-21')))
 THEN RAISE EXCEPTION 'Realistic DEMO consistency assertion failed; rollback'; END IF;
END $check$;
COMMIT;

SELECT 'demo_patients' AS metric,count(*) FROM patient.patients WHERE id::text LIKE 'e2000000-0000-4000-8000-%'
UNION ALL SELECT 'linked_demo_patient_accounts',count(*) FROM identity.users WHERE id::text LIKE 'e8000000-0000-4000-8000-%'
UNION ALL SELECT 'completed_demo_queue_visits',count(*) FROM appointment.reception_visits WHERE id::text LIKE 'e5000000-0000-4000-8000-%'
UNION ALL SELECT 'demo_prescriptions',count(*) FROM medical_record.prescriptions WHERE id::text LIKE 'e6000000-0000-4000-8000-%'
UNION ALL SELECT 'demo_prescription_items',count(*) FROM medical_record.prescription_items WHERE id::text LIKE 'e6100000-0000-4000-8000-%';
