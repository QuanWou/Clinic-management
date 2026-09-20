# Entity Relationship Diagram (ERD)

## 1. Identity Service (Schema: `identity`)
- **users**: id (UUID), email, password_hash, full_name, phone, status.
- **roles**: id, code (PATIENT, DOCTOR, ADMIN, RECEPTIONIST), name.
- **user_roles**: user_id, role_id.
- **refresh_tokens**: id, user_id, token, expires_at, revoked.

## 2. Patient Service (Schema: `patient`)
- **patients**: id (UUID), user_id (UUID nullable, unique identity reference, không phải cross-schema FK), full_name, phone, dob, gender, address, blood_type. Bệnh nhân walk-in không cần tài khoản identity.

## 3. Doctor Service (Schema: `doctor`)
- **specialties**: id, name, description.
- **doctors**: id (UUID), user_id (FK), specialty_id, biography, consultation_fee.
- **schedules**: id, doctor_id, day_of_week, start_time, end_time.

## 4. Appointment Service (Schema: `appointment`)
- **appointments**: id (UUID), patient_id, doctor_id, appointment_date, start_time, status (PENDING, CONFIRMED, COMPLETED, CANCELLED), reason.
- **reception_visits**: id (UUID), appointment_id (unique, FK nội bộ tới appointments), patient_id, doctor_id, visit_date, queue_number, status (WAITING, CALLED, IN_PROGRESS, COMPLETED, SKIPPED), checked_in_at, started_at, completed_at, created_at, updated_at. Unique (doctor_id, visit_date, queue_number) để bảo đảm không trùng số thứ tự.

## 5. Medical Record Service (Schema: `medical_record`)
- **medical_records**: id, appointment_id, patient_id, doctor_id, diagnosis, symptoms, notes.
- **prescriptions**: id, medical_record_id, created_at.
- **prescription_items**: id, prescription_id, medicine_name, dosage, frequency, duration.

## 6. Billing Service (Schema: `billing`)
- **invoices**: id, patient_id, appointment_id, total_amount, status (UNPAID, PAID), payment_method.
