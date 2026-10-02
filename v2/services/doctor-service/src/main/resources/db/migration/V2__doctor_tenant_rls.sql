CREATE OR REPLACE FUNCTION doctor.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.clinic_id', true), '')::uuid
$$;

ALTER TABLE doctor.doctor_affiliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor.doctor_affiliations FORCE ROW LEVEL SECURITY;
ALTER TABLE doctor.working_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor.working_schedules FORCE ROW LEVEL SECURITY;

CREATE POLICY affiliation_tenant ON doctor.doctor_affiliations
  USING (clinic_id = doctor.current_clinic_id())
  WITH CHECK (clinic_id = doctor.current_clinic_id());

CREATE POLICY schedule_tenant ON doctor.working_schedules
  USING (clinic_id = doctor.current_clinic_id())
  WITH CHECK (clinic_id = doctor.current_clinic_id());
