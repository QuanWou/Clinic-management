-- Separate patient chart number from Identity account and UUID: walk-in patients have no account.
CREATE SEQUENCE patient.patient_code_seq AS BIGINT START WITH 1;
ALTER TABLE patient.patients ADD COLUMN patient_code VARCHAR(24);
WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n FROM patient.patients
)
UPDATE patient.patients p SET patient_code = 'BN' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE p.id = numbered.id;
SELECT setval('patient.patient_code_seq',
              COALESCE((SELECT max(substring(patient_code FROM 3)::bigint) FROM patient.patients), 0) + 1,
              false);
CREATE FUNCTION patient.next_patient_code() RETURNS VARCHAR(24)
LANGUAGE SQL VOLATILE AS $$
    SELECT 'BN' || lpad(v::text, greatest(6, length(v::text)), '0')
    FROM (SELECT nextval('patient.patient_code_seq') AS v) generated;
$$;
ALTER TABLE patient.patients ALTER COLUMN patient_code SET DEFAULT patient.next_patient_code();
ALTER TABLE patient.patients ALTER COLUMN patient_code SET NOT NULL;
ALTER TABLE patient.patients ADD CONSTRAINT uq_patient_code UNIQUE (patient_code);
ALTER TABLE patient.patients ADD CONSTRAINT ck_patient_code CHECK (patient_code ~ '^BN[0-9]{6,}$');
