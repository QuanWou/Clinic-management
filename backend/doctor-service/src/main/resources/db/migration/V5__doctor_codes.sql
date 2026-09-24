-- Distinct public doctor/staff profile number; UUID/user_id remain the immutable linkage.
CREATE SEQUENCE doctor.doctor_code_seq AS BIGINT START WITH 1;
ALTER TABLE doctor.doctors ADD COLUMN doctor_code VARCHAR(24);
WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM doctor.doctors
)
UPDATE doctor.doctors d SET doctor_code = 'BS' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE d.id = numbered.id;
SELECT setval('doctor.doctor_code_seq',
              COALESCE((SELECT max(substring(doctor_code FROM 3)::bigint) FROM doctor.doctors), 0) + 1,
              false);
CREATE FUNCTION doctor.next_doctor_code() RETURNS VARCHAR(24)
LANGUAGE SQL VOLATILE AS $$
    SELECT 'BS' || lpad(v::text, greatest(6, length(v::text)), '0')
    FROM (SELECT nextval('doctor.doctor_code_seq') AS v) generated;
$$;
ALTER TABLE doctor.doctors ALTER COLUMN doctor_code SET DEFAULT doctor.next_doctor_code();
ALTER TABLE doctor.doctors ALTER COLUMN doctor_code SET NOT NULL;
ALTER TABLE doctor.doctors ADD CONSTRAINT uq_doctor_code UNIQUE (doctor_code);
ALTER TABLE doctor.doctors ADD CONSTRAINT ck_doctor_code CHECK (doctor_code ~ '^BS[0-9]{6,}$');
