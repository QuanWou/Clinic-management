-- Walk-in patients do not need an identity account. Linked profiles remain unique by user_id.
ALTER TABLE patients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE patients ADD COLUMN full_name VARCHAR(150);
ALTER TABLE patients ADD COLUMN phone VARCHAR(20);
CREATE INDEX idx_patients_phone ON patients (phone);
CREATE INDEX idx_patients_full_name_lower ON patients (lower(full_name));