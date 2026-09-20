INSERT INTO specialties (id, name, description)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'Cardiology', 'Heart and cardiovascular care'),
    ('10000000-0000-0000-0000-000000000002', 'General Medicine', 'Primary care and general adult medicine'),
    ('10000000-0000-0000-0000-000000000003', 'Neurology', 'Brain, spine, and nervous system care'),
    ('10000000-0000-0000-0000-000000000004', 'Oncology', 'Cancer diagnosis and treatment'),
    ('10000000-0000-0000-0000-000000000005', 'Orthopedics', 'Bone, joint, and musculoskeletal care'),
    ('10000000-0000-0000-0000-000000000006', 'Pediatrics', 'Medical care for infants, children, and adolescents')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX idx_schedules_doctor_day_time
    ON schedules (doctor_id, day_of_week, start_time, end_time);
