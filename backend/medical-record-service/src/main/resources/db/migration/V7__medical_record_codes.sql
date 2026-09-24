-- Human-readable chart numbers are display identifiers only. Preserve UUID keys and all links.
CREATE SEQUENCE medical_record.record_code_seq AS BIGINT START WITH 1;
ALTER TABLE medical_record.medical_records ADD COLUMN record_code VARCHAR(24);
WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS n
    FROM medical_record.medical_records
)
UPDATE medical_record.medical_records m
SET record_code = 'BA' || lpad(numbered.n::text, 6, '0')
FROM numbered WHERE numbered.id = m.id;
SELECT setval('medical_record.record_code_seq',
              COALESCE((SELECT max(substring(record_code FROM 3)::bigint)
                        FROM medical_record.medical_records), 0) + 1, false);
CREATE FUNCTION medical_record.next_record_code() RETURNS VARCHAR(24)
LANGUAGE SQL VOLATILE AS $$
    SELECT 'BA' || lpad(v::text, greatest(6, length(v::text)), '0')
    FROM (SELECT nextval('medical_record.record_code_seq') AS v) generated;
$$;
ALTER TABLE medical_record.medical_records ALTER COLUMN record_code SET DEFAULT medical_record.next_record_code();
ALTER TABLE medical_record.medical_records ALTER COLUMN record_code SET NOT NULL;
ALTER TABLE medical_record.medical_records ADD CONSTRAINT uq_record_code UNIQUE (record_code);
ALTER TABLE medical_record.medical_records ADD CONSTRAINT ck_record_code CHECK (record_code ~ '^BA[0-9]{6,}$');
