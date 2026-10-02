-- DESIGN REFERENCE ONLY: targeted to Appointment service DB; requires
-- app_security.current_clinic_id() from 01_tenancy_reference.sql or equivalent.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS scheduling;
CREATE TABLE scheduling.capacity_slot (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 doctor_id uuid NOT NULL, -- external Doctor reference, not a database FK
 starts_at timestamptz NOT NULL,
 ends_at timestamptz NOT NULL,
 capacity integer NOT NULL CHECK(capacity > 0),
 occupied_count integer NOT NULL DEFAULT 0 CHECK (occupied_count >= 0 AND occupied_count <= capacity),
 version bigint NOT NULL DEFAULT 1,
 CHECK (ends_at > starts_at),
 UNIQUE (clinic_id,id),
 UNIQUE (clinic_id,branch_id,doctor_id,starts_at,ends_at)
);
CREATE TABLE scheduling.slot_reservation (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 slot_id uuid NOT NULL,
 patient_id uuid NOT NULL, -- external Patient reference
 state text NOT NULL CHECK (state IN ('active','consumed','expired','released')),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (clinic_id,id),
 FOREIGN KEY (clinic_id,slot_id) REFERENCES scheduling.capacity_slot(clinic_id,id)
);
CREATE INDEX idx_hold_expiry ON scheduling.slot_reservation(expires_at) WHERE state='active';
CREATE TABLE scheduling.appointment (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 clinic_id uuid NOT NULL,
 branch_id uuid NOT NULL,
 patient_id uuid NOT NULL,
 hold_id uuid NOT NULL,
 display_code text NOT NULL,
 state text NOT NULL CHECK(state IN ('pending_confirmation','pending_payment','confirmed','checked_in','fulfilled','cancelled','rescheduled','no_show')),
 version bigint NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (clinic_id,id), UNIQUE (clinic_id,hold_id), UNIQUE(clinic_id,display_code),
 FOREIGN KEY (clinic_id,hold_id) REFERENCES scheduling.slot_reservation(clinic_id,id)
);
-- Reference algorithm (single local DB transaction):
-- 1. UPDATE capacity_slot SET occupied_count=occupied_count+1, version=version+1
--    WHERE clinic_id=:trusted_clinic AND id=:slot AND occupied_count<capacity
--    RETURNING id; if 0 rows: SLOT_UNAVAILABLE.
-- 2. INSERT active slot_reservation; INSERT outbox; COMMIT.
-- 3. TTL worker CAS active->expired and decrement occupancy in SAME transaction.
-- 4. consume active->consumed: occupancy remains held by confirmed appointment.
-- 5. cancel confirmed appointment: decrement occupancy once, status CAS + outbox.
-- 6. Do not count expired holds as capacity until TTL release transaction commits.
-- 7. A late PaymentSucceeded cannot consume a released hold.
DO $$ DECLARE t text; BEGIN
 FOR t IN SELECT unnest(ARRAY['capacity_slot','slot_reservation','appointment']) LOOP
  EXECUTE format('ALTER TABLE scheduling.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE scheduling.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY tenant_scope ON scheduling.%I FOR ALL USING (clinic_id = app_security.current_clinic_id()) WITH CHECK (clinic_id = app_security.current_clinic_id())',t);
 END LOOP;
END $$;
