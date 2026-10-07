CREATE OR REPLACE FUNCTION appointment_v2.current_clinic_id() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.clinic_id',true),'')::uuid $$;

ALTER TABLE appointment_v2.capacity_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.capacity_slots FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.slot_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.slot_reservations FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.outbox_events FORCE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.appointment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_v2.appointment_history FORCE ROW LEVEL SECURITY;

CREATE POLICY slot_tenant ON appointment_v2.capacity_slots USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
CREATE POLICY hold_tenant ON appointment_v2.slot_reservations USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
CREATE POLICY appointment_tenant ON appointment_v2.appointments USING(clinic_id=appointment_v2.current_clinic_id()) WITH CHECK(clinic_id=appointment_v2.current_clinic_id());
CREATE POLICY outbox_tenant ON appointment_v2.outbox_events USING(EXISTS(
  SELECT 1 FROM appointment_v2.appointments a WHERE a.id=aggregate_id AND a.clinic_id=appointment_v2.current_clinic_id()
)) WITH CHECK(EXISTS(
  SELECT 1 FROM appointment_v2.appointments a WHERE a.id=aggregate_id AND a.clinic_id=appointment_v2.current_clinic_id()
));

CREATE POLICY history_tenant ON appointment_v2.appointment_history USING(EXISTS(
  SELECT 1 FROM appointment_v2.appointments a WHERE a.id=appointment_id AND a.clinic_id=appointment_v2.current_clinic_id()
)) WITH CHECK(EXISTS(
  SELECT 1 FROM appointment_v2.appointments a WHERE a.id=appointment_id AND a.clinic_id=appointment_v2.current_clinic_id()
));
