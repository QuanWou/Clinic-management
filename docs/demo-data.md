# Synthetic patient, doctor and medical-record fixtures (development only)

The existing PostgreSQL database is `clinic_db`, with independent `identity`, `patient`, `doctor`, `appointment` and `medical_record` schemas created and versioned by Flyway. **Do not create another database or replay baseline migrations into the running instance.** This fixture adds synthetic rows to the existing schemas without modifying existing patients, doctors, appointments or clinical records.

From the repository root, with Docker Compose running and all migrations successfully applied:

```powershell
Get-Content -Raw -Encoding UTF8 .\scripts\demo-patient-doctor-records.sql | docker compose exec -T postgres psql -X -U postgres -d clinic_db -v ON_ERROR_STOP=1
```

The script adds 8 fictional walk-in patients (without login accounts), 3 fictional doctors and their independent Identity accounts/roles, 30 weekly work-schedule blocks, 12 completed historical appointments (September 2026), and 12 medical records linked to precisely those appointments. It does not add medical records to pre-existing visits, prescriptions, lab orders or invoices. Diagnoses, notes, names, addresses and appointment reasons are explicitly prefixed `DEMO` / `Synthetic`, and **must never be interpreted as clinical information**.

Demo doctor accounts use `@example.invalid`, random BCrypt passwords and no shared or exposed login password. If they must be used for interactive testing, use the application's authorized account reset procedure. The walk-in patients have no patient login. Existing accounts and credentials are unchanged.

The fixture uses reserved deterministic UUID prefixes (`d000...` for Identity, `d100...` doctors, `d200...` patients, `d300...` appointments, `d400...` records, `d700...` schedules), `ON CONFLICT (id) DO NOTHING`, a transaction, and relationship/count assertions, so it can be run more than once without duplicating data. Do not run this seed against real patient data or production environments.

Verification, without revealing patient data:

```powershell
docker compose exec -T postgres psql -U postgres -d clinic_db -c "SELECT 'patients' AS entity, COUNT(*) FROM patient.patients UNION ALL SELECT 'doctors', COUNT(*) FROM doctor.doctors UNION ALL SELECT 'appointments', COUNT(*) FROM appointment.appointments UNION ALL SELECT 'medical_records', COUNT(*) FROM medical_record.medical_records;"
```

The schema remains managed by each microservice's Flyway migrations. These SQL fixtures are for local demonstration; normal clinical data should be created through authenticated APIs, respecting permissions and auditing.

## Larger dataset for dashboard/UI testing (2026-09-21)

After the small fixture above, use the **separate**, non-destructive bulk script to insert more synthetic data into the same `clinic_db`:

```powershell
Get-Content -Raw -Encoding UTF8 .\scripts\demo-bulk-clinic-data.sql | docker compose exec -T postgres psql -X -U postgres -d clinic_db -v ON_ERROR_STOP=1
```

The bulk fixture adds 500 fictional walk-in patients, 18 fictional doctors with distinct Identity accounts and `ROLE_DOCTOR`, 180 weekday schedule blocks, 2,400 appointments and 1,600 medical records. Its 2,000 past appointments are spread across weekdays from **August 24 through September 18, 2026** (1,600 completed and 400 cancelled); 400 future appointments run from **September 22 through October 5, 2026** (250 confirmed and 150 pending). Only newly seeded completed appointments receive records. All new names and clinical text explicitly say DEMO, there are no real contact details, no fake lab test results, no payment captures and no invented clinical records for existing users. Demo doctor passwords are random BCrypt strings and are not displayed or shared; demo walk-in patients have no accounts.

Verified totals with both fixtures in the existing local database on September 21, 2026: **514 patients, 22 doctors, 215 schedule blocks, 2,493 appointments and 1,612 medical records**. Re-running the bulk script inserted **zero** duplicate rows, and runtime frontend/Gateway smoke tests passed. The script uses reserved `e000/e100/e200/e300/e400/e700` UUID prefixes, transaction rollback on failed integrity checks, and `ON CONFLICT (id) DO NOTHING`. It does not modify any pre-existing rows or change Flyway migration files. Use this only in an isolated **development/test** database, never with real clinical data; its appointments and diagnoses must not be interpreted as real healthcare activity or production financial statistics.

## Realistic synthetic workflow extension (run after the bulk script)

```powershell
# PowerShell 5.1 defaults to OEM encoding when piping to native executables.
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
Get-Content -Raw -Encoding UTF8 .\scripts\demo-realistic-clinic-data.sql | docker compose exec -T postgres psql -X -U postgres -d clinic_db -v ON_ERROR_STOP=1
```

The UTF-8 setup is required to preserve Vietnamese names/clinical display strings; simply adding `-Encoding UTF8` to `Get-Content` is **not enough** in Windows PowerShell 5.1. If previously imported with the wrong encoding, re-run this script with the UTF-8 setup: it repairs display names and prescription placeholders on reserved demo rows without duplicating records.

This separate fixture enriches **only** the reserved `e` demo rows, without changing real/other existing patients, staff or encounters. It replaces numbered demo display names with fictional Vietnamese names; includes pediatric and adult age cohorts, diverse broad district-only addresses explicitly marked fictional, coherent pediatric patient matching, specialty-linked appointment complaints and 18 scenario families of synthetic symptoms/diagnoses. Doctors have realistic-looking specialty biographies and **fictional** consultation fees. It adds 100 linked patient Identity accounts (`@example.invalid`, randomized unknown BCrypt passwords), while the other 400 new patients remain walk-in without accounts. The fixture never prints passwords, does not create an easy/shared login and intentionally leaves patient phone numbers blank rather than risk generating someone's real number.

For lifecycle/UI coverage, it adds 1,600 completed reception queue visits (consistent with completed appointments), 533 mock prescriptions and 533 **non-dispensable placeholder** prescription items. These medicines have no real drug names, doses or clinical instructions; all records include a clear synthetic clinical disclaimer. The script also aligns appointment status timestamps and appointment/record/queue patient ownership. No original non-demo records receive fabricated medical content. The new IDs use reserved `e500/e600/e610/e800` prefixes and assertions/transactions; re-running it creates zero duplicate rows. Bulk volume is unchanged: 514 patients, 22 doctors, 2,493 appointments and 1,612 medical records. Totals after enrichment: **103 patient-role Identity accounts**, **1,660 reception visits**, **533 prescriptions and 533 items**.

**Coverage limits:** The catalog currently has zero active services, so this fixture intentionally does **not** invent lab results, billable service snapshots, finalized invoices, payment captures, financial revenue or realistic medicine doses. This is a UI/integration demonstration seed, not evidence of real end-to-end billing, lab, clinical or login verification. If patient-role interactive login testing is needed, create or reset one expressly authorized development account through the application. Never apply the seed to a production database or export this data as actual clinical or financial activity.
