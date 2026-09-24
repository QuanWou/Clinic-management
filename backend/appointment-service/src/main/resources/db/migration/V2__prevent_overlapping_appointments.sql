-- The application-level overlap check is advisory; concurrent writers need a database invariant.
-- btree_gist provides GiST equality support for the UUID doctor identifier.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
    ADD CONSTRAINT appointments_valid_time CHECK (start_time < end_time);

-- [) allows adjacent bookings, but rejects any overlapping active/completed interval.
-- A cancelled appointment releases the interval immediately.
ALTER TABLE appointments
    ADD CONSTRAINT appointments_doctor_slot_no_overlap
    EXCLUDE USING gist (
        doctor_id WITH =,
        tsrange(appointment_date + start_time, appointment_date + end_time, '[)') WITH &&
    ) WHERE (status <> 'CANCELLED');