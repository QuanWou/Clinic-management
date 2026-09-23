# LOCAL DEVELOPMENT ONLY. Creates four isolated, role-specific accounts with distinct random secrets.
# Does not reset any existing password. Writes credentials outside the Git checkout, under LocalAppData.
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$credentialsDir = Join-Path $env:LOCALAPPDATA 'ClinicManagement'
$credentialsPath = Join-Path $credentialsDir 'test-accounts.json'
if (Test-Path $credentialsPath) { throw "Test logins already provisioned. Credentials are at $credentialsPath. Refusing to rotate them." }

$definitions = @(
    @{ role='ROLE_ADMIN'; email='qa-admin@example.invalid'; name='Clinic QA Administrator' },
    @{ role='ROLE_DOCTOR'; email='qa-doctor@example.invalid'; name='Clinic QA Doctor' },
    @{ role='ROLE_RECEPTIONIST'; email='qa-reception@example.invalid'; name='Clinic QA Receptionist' },
    @{ role='ROLE_PATIENT'; email='qa-patient@example.invalid'; name='Clinic QA Patient' }
)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$credentials = @()
foreach ($item in $definitions) {
    $bytes = New-Object byte[] 24
    $rng.GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
    $credentials += [pscustomobject]@{ role=$item.role; email=$item.email; password=$secret }
}
$rng.Dispose()

# Only fixed literals and base64url CSPRNG output enter SQL; no credentials are put in command arguments or logs.
$values = @()
for ($i=0; $i -lt $definitions.Count; $i++) {
    $d=$definitions[$i]; $secret=$credentials[$i].password
    $values += "('$($d.email)','$secret','$($d.name)','$($d.role)')"
}
$rows = $values -join ",`n"
$sql = @'
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $guard$
BEGIN
    IF current_database() <> 'clinic_db'
       OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto')
       OR (SELECT count(*) FROM information_schema.columns WHERE (table_schema,table_name,column_name) IN
           (('identity','users','account_code'),('doctor','doctors','doctor_code'),('patient','patients','patient_code'))) <> 3
       OR EXISTS (SELECT 1 FROM identity.users WHERE email IN
           ('qa-admin@example.invalid','qa-doctor@example.invalid','qa-reception@example.invalid','qa-patient@example.invalid'))
    THEN RAISE EXCEPTION 'Expected local database/schema or fixture preconditions not met'; END IF;
END $guard$;
INSERT INTO identity.users (id,email,password_hash,full_name,phone,status,created_at,updated_at)
SELECT gen_random_uuid(), v.email, crypt(v.secret,gen_salt('bf',12)), v.full_name, NULL,
       'ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM (VALUES __ROWS__) AS v(email,secret,full_name,role_code);
INSERT INTO identity.user_roles (user_id,role_id)
SELECT u.id,r.id FROM (VALUES __ROWS__) AS v(email,secret,full_name,role_code)
JOIN identity.users u ON u.email=v.email JOIN identity.roles r ON r.code=v.role_code;
INSERT INTO patient.patients (id,user_id,full_name,phone,dob,gender,address,blood_type)
SELECT gen_random_uuid(),u.id,u.full_name,NULL,DATE '1995-05-15','FEMALE',
       'LOCAL TEST FIXTURE - NOT REAL',NULL
FROM identity.users u WHERE u.email='qa-patient@example.invalid';
INSERT INTO doctor.doctors (id,user_id,specialty_id,biography,consultation_fee,active)
SELECT gen_random_uuid(),u.id,s.id,'LOCAL TEST FIXTURE - NOT REAL DOCTOR',0,TRUE
FROM identity.users u JOIN doctor.specialties s ON s.id='10000000-0000-0000-0000-000000000002'::uuid
WHERE u.email='qa-doctor@example.invalid';
INSERT INTO doctor.schedules (id,doctor_id,day_of_week,start_time,end_time)
SELECT gen_random_uuid(),d.id,day.n,slot.start_at,slot.end_at
FROM doctor.doctors d JOIN identity.users u ON u.id=d.user_id
CROSS JOIN generate_series(1,5) AS day(n)
CROSS JOIN (VALUES (TIME '08:00',TIME '12:00'),(TIME '13:00',TIME '17:00')) AS slot(start_at,end_at)
WHERE u.email='qa-doctor@example.invalid';
DO $verify$
BEGIN
    IF (SELECT count(*) FROM identity.users WHERE email IN
          ('qa-admin@example.invalid','qa-doctor@example.invalid','qa-reception@example.invalid','qa-patient@example.invalid')) <> 4
       OR (SELECT count(*) FROM patient.patients p JOIN identity.users u ON u.id=p.user_id
           WHERE u.email='qa-patient@example.invalid') <> 1
       OR (SELECT count(*) FROM doctor.doctors d JOIN identity.users u ON u.id=d.user_id
           WHERE u.email='qa-doctor@example.invalid') <> 1
    THEN RAISE EXCEPTION 'Test account linkage verification failed'; END IF;
END $verify$;
COMMIT;
'@
$sql = $sql.Replace('__ROWS__',$rows)
$sql | docker compose exec -T postgres psql -X -U postgres -d clinic_db -v ON_ERROR_STOP=1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Database transaction failed; no credential file was created.' }

New-Item -ItemType Directory -Path $credentialsDir -Force | Out-Null
$credentials | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $credentialsPath -Encoding UTF8
# Restrict the file to the current Windows account instead of inheriting broad directory permissions.
$acl = Get-Acl -LiteralPath $credentialsPath
$acl.SetAccessRuleProtection($true,$false)
$owner = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule($owner,'FullControl','Allow')
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $credentialsPath -AclObject $acl
Write-Output "Created four role-specific QA logins. Credentials (local user access only): $credentialsPath"
Write-Output 'Existing account passwords and UUIDs were not changed.'
