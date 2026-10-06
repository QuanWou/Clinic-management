CREATE SCHEMA IF NOT EXISTS appointment_v2;

CREATE TABLE appointment_v2.capacity_slots(
  id uuid PRIMARY KEY,
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  capacity integer NOT NULL CHECK(capacity>0),
  schedule_version bigint NOT NULL CHECK(schedule_version>=0),
  offering_version bigint NOT NULL CHECK(offering_version>=0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version bigint NOT NULL DEFAULT 0,
  UNIQUE(clinic_id,branch_id,offering_id,doctor_id,starts_at)
);

CREATE TABLE appointment_v2.slot_reservations(
  id uuid PRIMARY KEY,
  slot_id uuid NOT NULL REFERENCES appointment_v2.capacity_slots(id),
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  price_version_id uuid NOT NULL,
  amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
  currency varchar(3) NOT NULL CHECK(currency='VND'),
  price_effective_from timestamptz NOT NULL,
  tax_policy_code varchar(80),
  discount_policy_code varchar(80),
  state varchar(20) NOT NULL CHECK(state IN ('ACTIVE','CONSUMED','EXPIRED','RELEASED')),
  expires_at timestamptz NOT NULL,
  idempotency_key varchar(120) NOT NULL,
  payload_hash varchar(64) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz,
  released_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0,
  UNIQUE(patient_id,idempotency_key)
);
CREATE INDEX idx_hold_slot_active ON appointment_v2.slot_reservations(slot_id,state,expires_at);

CREATE TABLE appointment_v2.appointments(
  id uuid PRIMARY KEY,
  appointment_code varchar(40) NOT NULL UNIQUE,
  clinic_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  clinic_patient_link_id uuid NOT NULL,
  offering_id uuid NOT NULL,
  doctor_id uuid NOT NULL,
  slot_id uuid NOT NULL REFERENCES appointment_v2.capacity_slots(id),
  reservation_id uuid NOT NULL UNIQUE REFERENCES appointment_v2.slot_reservations(id),
  price_version_id uuid NOT NULL,
  amount_vnd bigint NOT NULL CHECK(amount_vnd>=0),
  currency varchar(3) NOT NULL CHECK(currency='VND'),
  price_effective_from timestamptz NOT NULL,
  tax_policy_code varchar(80),
  discount_policy_code varchar(80),
  status varchar(32) NOT NULL CHECK(status IN ('CONFIRMED','CANCELLED','RESCHEDULED','CHECKED_IN','FULFILLED','NO_SHOW')),
  confirmation_key varchar(120) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  row_version bigint NOT NULL DEFAULT 0,
  UNIQUE(patient_id,confirmation_key)
);
CREATE INDEX idx_appointment_slot_status ON appointment_v2.appointments(slot_id,status);
CREATE INDEX idx_appointment_patient ON appointment_v2.appointments(patient_id,created_at DESC);

CREATE TABLE appointment_v2.outbox_events(
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE,
  event_type varchar(120) NOT NULL,
  aggregate_id uuid NOT NULL,
  correlation_id varchar(128) NOT NULL,
  payload_json text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PUBLISHED','DEAD_LETTER')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX idx_appointment_outbox_due ON appointment_v2.outbox_events(status,next_attempt_at,created_at);

CREATE TABLE appointment_v2.appointment_history(
  id uuid PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES appointment_v2.appointments(id),
  from_status varchar(32),
  to_status varchar(32) NOT NULL,
  actor_user_id uuid NOT NULL,
  reason varchar(500),
  correlation_id varchar(128),
  old_slot_id uuid,
  new_slot_id uuid,
  old_reservation_id uuid,
  new_reservation_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
