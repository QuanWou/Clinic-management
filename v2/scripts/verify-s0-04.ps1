param(
    [string]$EvidenceDirectory
)

$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $EvidenceDirectory) {
    $EvidenceDirectory = Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S0-04/verification'
}
$EvidenceDirectory = [IO.Path]::GetFullPath($EvidenceDirectory)
New-Item -ItemType Directory -Force -Path $EvidenceDirectory | Out-Null
$verificationId = [guid]::NewGuid().ToString('N')
$taskContainer = "clinic-v2-s004-verify-$($verificationId.Substring(0,12))"
$taskPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$savedEnvironment = @{}
$summary = [ordered]@{
    task = 'P05-S0-04'
    startedAt = [DateTimeOffset]::UtcNow.ToString('o')
    container = $taskContainer
    postgresImage = 'postgres:16-alpine'
    syntheticOnly = $true
    modules = @()
    status = 'RUNNING'
    cleanup = 'PENDING'
}

function Set-VerificationEnvironment([string]$Name, [string]$Value) {
    if (-not $savedEnvironment.ContainsKey($Name)) {
        $savedEnvironment[$Name] = [Environment]::GetEnvironmentVariable($Name, 'Process')
    }
    [Environment]::SetEnvironmentVariable($Name, $Value, 'Process')
}

function Invoke-Checked([string]$File, [string[]]$Arguments, [string]$Log) {
    & $File @Arguments 2>&1 | Tee-Object -FilePath $Log
    if ($LASTEXITCODE -ne 0) {
        throw "$File failed with exit code $LASTEXITCODE. See $Log"
    }
}

try {
    Set-VerificationEnvironment 'POSTGRES_PASSWORD' $taskPassword
    Invoke-Checked 'docker' @(
        'run', '-d', '--name', $taskContainer,
        '--label', 'clinic.v2.task=P05-S0-04',
        '--label', "clinic.v2.verification=$verificationId",
        '--env', 'POSTGRES_PASSWORD',
        '--publish', '127.0.0.1::5432',
        '--tmpfs', '/var/lib/postgresql/data:rw',
        'postgres:16-alpine'
    ) (Join-Path $EvidenceDirectory 'container.txt')

    $ready = $false
    for ($attempt = 0; $attempt -lt 80; $attempt++) {
        & docker exec $taskContainer pg_isready -h 127.0.0.1 -U postgres *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw 'Disposable PostgreSQL did not become ready' }
    $binding = & docker port $taskContainer 5432/tcp
    if ($LASTEXITCODE -ne 0 -or $binding -notmatch '^127\.0\.0\.1:(\d+)$') {
        throw 'Disposable PostgreSQL must be bound only to loopback'
    }
    $taskPort = $Matches[1]
    $summary.port = [int]$taskPort
    $bootstrap = @"
CREATE DATABASE clinic_v2_s004_doctor_sandbox;
CREATE DATABASE clinic_v2_s004_catalog_sandbox;
CREATE ROLE s004_doctor_verify LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$taskPassword';
CREATE ROLE s004_catalog_verify LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$taskPassword';
"@
    $bootstrap | & docker exec -i $taskContainer psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 |
        Tee-Object -FilePath (Join-Path $EvidenceDirectory 'bootstrap.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Disposable database bootstrap failed' }

    foreach ($service in @('doctor', 'catalog')) {
        $prefix = $service.ToUpperInvariant()
        $schema = if ($service -eq 'doctor') { 'doctor' } else { 'catalog_v2' }
        $database = "clinic_v2_s004_${service}_sandbox"
        $pom = Join-Path $taskRoot "v2/services/$service-service/pom.xml"
        Set-VerificationEnvironment "${prefix}_IT_RUNTIME_USER" "s004_${service}_verify"
        Set-VerificationEnvironment "${prefix}_IT_RUNTIME_PASSWORD" $taskPassword
        Set-VerificationEnvironment "${prefix}_IT_MIGRATION_USER" 'postgres'
        Set-VerificationEnvironment "${prefix}_IT_MIGRATION_PASSWORD" $taskPassword
        Write-Output "Verifying $service with fresh Flyway migrations and a non-bypass runtime login"
        Invoke-Checked 'mvn.cmd' @(
            '-B', '-ntp', '-f', $pom, 'test',
            "-D$service.it.enabled=true",
            "-D$service.it.migrate=true",
            "-D$service.it.jdbc-url=jdbc:postgresql://127.0.0.1:$taskPort/$database"
        ) (Join-Path $EvidenceDirectory "$service-test.txt")
        $reports = Join-Path $taskRoot "v2/services/$service-service/target/surefire-reports"
        $tests = 0; $failures = 0; $errors = 0; $skipped = 0
        foreach ($report in Get-ChildItem -LiteralPath $reports -Filter 'TEST-*.xml') {
            [xml]$testReport = Get-Content -Raw -LiteralPath $report.FullName
            $tests += [int]$testReport.testsuite.tests
            $failures += [int]$testReport.testsuite.failures
            $errors += [int]$testReport.testsuite.errors
            $skipped += [int]$testReport.testsuite.skipped
        }
        if ($tests -eq 0 -or $failures -ne 0 -or $errors -ne 0 -or $skipped -ne 0) {
            throw "$service verification requires passing tests with no skips"
        }
        Get-ChildItem -LiteralPath $reports -Filter '*.txt' |
            Copy-Item -Destination $EvidenceDirectory -Force
        Invoke-Checked 'docker' @(
            'exec', $taskContainer, 'psql', '-X', '-U', 'postgres', '-d', $database,
            '-v', 'ON_ERROR_STOP=1', '-c',
            "SELECT current_database(),version(); SELECT version,description,success FROM $schema.flyway_schema_history ORDER BY installed_rank; SELECT rolname,rolsuper,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname IN ('clinic_v2_${service}_runtime','s004_${service}_verify'); SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='$schema' AND c.relkind='r' ORDER BY c.relname;"
        ) (Join-Path $EvidenceDirectory "$service-database.txt")
        Invoke-Checked 'mvn.cmd' @('-B', '-ntp', '-f', $pom, '-DskipTests', 'package') (
            Join-Path $EvidenceDirectory "$service-package.txt"
        )
        $jar = Join-Path $taskRoot "v2/services/$service-service/target/$service-service-0.1.0-SNAPSHOT.jar"
        $summary.modules += [ordered]@{
            service = $service; tests = $tests; failures = $failures; errors = $errors; skipped = $skipped
            migrations = @('1', '2', '3'); package = 'PASS'
            jarSha256 = (Get-FileHash -LiteralPath $jar -Algorithm SHA256).Hash
        }
    }
    $summary.status = 'PASS'
} catch {
    $summary.status = 'FAIL'
    $summary.error = $_.Exception.Message
    throw
} finally {
    try {
        $label = & docker inspect $taskContainer --format '{{ index .Config.Labels "clinic.v2.verification" }}' 2>$null
        if ($LASTEXITCODE -eq 0 -and $label -eq $verificationId) {
            & docker rm -f -v $taskContainer | Tee-Object -FilePath (Join-Path $EvidenceDirectory 'cleanup.txt')
            if ($LASTEXITCODE -ne 0) { throw 'Disposable container removal failed' }
            $summary.cleanup = 'PASS'
        } else {
            $summary.cleanup = 'NO_OWNED_CONTAINER'
        }
    } catch {
        $summary.cleanup = 'FAIL'
        $summary.cleanupError = $_.Exception.Message
        $summary.status = 'FAIL'
    }
    foreach ($entry in $savedEnvironment.GetEnumerator()) {
        [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process')
    }
    $summary.finishedAt = [DateTimeOffset]::UtcNow.ToString('o')
    $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (
        Join-Path $EvidenceDirectory 'summary.json'
    ) -Encoding utf8
}
if ($summary.status -ne 'PASS') { throw 'S0-04 verification failed; inspect summary.json' }
