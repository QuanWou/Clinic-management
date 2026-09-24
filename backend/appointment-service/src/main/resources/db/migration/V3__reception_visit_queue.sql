-- Separate visit state from booking state; doctor/day plus queue_number uniquely identify a ticket.
CREATE TABLE reception_visits (
    id UUID PRIMARY KEY,
    appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id),
    patient_id UUID NOT NULL,
    doctor_id UUID NOT NULL,
    visit_date DATE NOT NULL,
    queue_number INTEGER NOT NULL CHECK (queue_number > 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    checked_in_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_reception_doctor_day_number UNIQUE (doctor_id, visit_date, queue_number)
);

CREATE INDEX idx_reception_visits_day_status ON reception_visits (visit_date, status);
CREATE INDEX idx_reception_visits_doctor_day ON reception_visits (doctor_id, visit_date, queue_number);