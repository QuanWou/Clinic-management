ALTER TABLE appointment_v2.reception_exceptions ADD COLUMN source_absence_id uuid;
CREATE UNIQUE INDEX absence_exception_once ON appointment_v2.reception_exceptions(appointment_id,source_absence_id) WHERE source_absence_id IS NOT NULL;
