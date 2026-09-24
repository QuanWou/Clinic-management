-- Read-only account/identifier audit for local clinic_db.
-- Do not expose password hashes, refresh tokens, patient names or emails.
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'identity_accounts' AS metric, count(*) AS total FROM identity.users
UNION ALL SELECT 'unreachable_demo_accounts', count(*) FROM identity.users WHERE email LIKE '%@example.invalid'
UNION ALL SELECT 'patients_without_login_by_design', count(*) FROM patient.patients WHERE user_id IS NULL
UNION ALL SELECT 'doctors_without_identity', count(*) FROM doctor.doctors d LEFT JOIN identity.users u ON u.id=d.user_id WHERE u.id IS NULL
UNION ALL SELECT 'linked_patients_without_identity', count(*) FROM patient.patients p LEFT JOIN identity.users u ON u.id=p.user_id WHERE p.user_id IS NOT NULL AND u.id IS NULL
UNION ALL SELECT 'doctors_without_doctor_role', count(*) FROM doctor.doctors d WHERE NOT EXISTS (SELECT 1 FROM identity.user_roles ur JOIN identity.roles r ON r.id=ur.role_id WHERE ur.user_id=d.user_id AND r.code='ROLE_DOCTOR')
UNION ALL SELECT 'linked_patients_without_patient_role', count(*) FROM patient.patients p WHERE p.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM identity.user_roles ur JOIN identity.roles r ON r.id=ur.role_id WHERE ur.user_id=p.user_id AND r.code='ROLE_PATIENT')
UNION ALL SELECT 'accounts_without_any_role', count(*) FROM identity.users u WHERE NOT EXISTS (SELECT 1 FROM identity.user_roles ur WHERE ur.user_id=u.id)
UNION ALL SELECT 'case_insensitive_email_collisions', count(*) FROM (SELECT lower(email) FROM identity.users GROUP BY lower(email) HAVING count(*)>1) duplicates
ORDER BY metric;
SELECT r.code AS role, count(*) AS total_accounts,
       count(*) FILTER (WHERE u.email LIKE '%@example.invalid') AS unreachable_demo_accounts
FROM identity.users u
JOIN identity.user_roles ur ON ur.user_id=u.id
JOIN identity.roles r ON r.id=ur.role_id
GROUP BY r.code ORDER BY r.code;
SELECT 'identifier_columns_present' AS metric, count(*) AS value
FROM information_schema.columns
WHERE (table_schema,table_name,column_name) IN
 (('identity','users','account_code'),('patient','patients','patient_code'),('doctor','doctors','doctor_code'));
SELECT 'identity' AS entity, count(*) AS total, count(account_code) AS coded,
       count(DISTINCT account_code) AS unique_codes,
       count(*) FILTER (WHERE account_code !~ '^TK[0-9]{6,}' ) AS invalid_format
FROM identity.users
UNION ALL SELECT 'patient',count(*),count(patient_code),count(DISTINCT patient_code),
                 count(*) FILTER (WHERE patient_code !~ '^BN[0-9]{6,}' ) FROM patient.patients
UNION ALL SELECT 'doctor',count(*),count(doctor_code),count(DISTINCT doctor_code),
                 count(*) FILTER (WHERE doctor_code !~ '^BS[0-9]{6,}' ) FROM doctor.doctors;
SELECT 'qa_accounts' AS metric, count(*) AS total FROM identity.users
 WHERE email IN ('qa-admin@example.invalid','qa-doctor@example.invalid',
                 'qa-reception@example.invalid','qa-patient@example.invalid')
UNION ALL SELECT 'qa_patient_profiles',count(*) FROM patient.patients p JOIN identity.users u ON u.id=p.user_id
 WHERE u.email='qa-patient@example.invalid'
UNION ALL SELECT 'qa_doctor_profiles',count(*) FROM doctor.doctors d JOIN identity.users u ON u.id=d.user_id
 WHERE u.email='qa-doctor@example.invalid';
COMMIT;
