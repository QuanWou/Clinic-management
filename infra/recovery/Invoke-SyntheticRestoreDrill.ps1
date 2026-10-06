param(
  [Parameter(Mandatory=$true)][string]$Container,
  [Parameter(Mandatory=$true)][string]$SourceDatabase,
  [Parameter(Mandatory=$true)][string]$TargetDatabase,
  [string]$EvidencePath = (Join-Path $PSScriptRoot ("restore-evidence-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".json"))
)

$ErrorActionPreference='Stop'

if ($Container -notmatch '^clinic-[a-z0-9-]+$') {
  throw "Refusing non-S0 synthetic container name: $Container"
}
if ($SourceDatabase -notmatch '^clinic_v2_[a-z0-9_]+_sandbox$') {
  throw "Source database must be an explicit Clinic Management sandbox: $SourceDatabase"
}
if ($TargetDatabase -notmatch '^clinic_v2_[a-z0-9_]+_restore_sandbox$') {
  throw "Target database must end in _restore_sandbox: $TargetDatabase"
}
if ($SourceDatabase -eq $TargetDatabase) { throw 'Source and target database must differ.' }

function Invoke-Psql([string]$Db,[string]$Sql) {
  $out = & docker exec $Container psql -Atq -v ON_ERROR_STOP=1 -U postgres -d $Db -c $Sql
  if ($LASTEXITCODE -ne 0) { throw "psql failed for database $Db" }
  return @($out)
}
function Table-Counts([string]$Db) {
  $rows = Invoke-Psql $Db "select table_schema || '|' || table_name from information_schema.tables where table_type='BASE TABLE' and table_schema not in ('pg_catalog','information_schema') order by table_schema,table_name"
  $result = [ordered]@{}
  foreach($row in $rows) {
    if ([string]::IsNullOrWhiteSpace($row)) { continue }
    $parts = $row -split '\|',2
    if ($parts.Count -ne 2 -or $parts[0] -notmatch '^[a-zA-Z0-9_]+$' -or $parts[1] -notmatch '^[a-zA-Z0-9_]+$') {
      throw "Unexpected table identifier: $row"
    }
    $count = Invoke-Psql $Db ('select count(*) from "'+$parts[0]+'"."'+$parts[1]+'"')
    $result[$row] = [long]($count | Select-Object -First 1)
  }
  return $result
}

$exists = Invoke-Psql 'postgres' ("select count(*) from pg_database where datname='" + $TargetDatabase.Replace("'","''") + "'")
if ([int]($exists | Select-Object -First 1) -ne 0) {
  throw "Restore target already exists; refusing destructive reuse: $TargetDatabase"
}

$sourceCounts = Table-Counts $SourceDatabase
$dumpPath = "/tmp/$SourceDatabase-s005.dump"
$allTimer = [System.Diagnostics.Stopwatch]::StartNew()

& docker exec $Container pg_dump -U postgres -Fc -d $SourceDatabase -f $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'pg_dump failed' }

$shaLine = & docker exec $Container sha256sum $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'sha256sum failed' }
$sha256 = (($shaLine -split '\s+')[0]).Trim()

& docker exec $Container createdb -U postgres $TargetDatabase
if ($LASTEXITCODE -ne 0) { throw 'createdb failed' }

$restoreTimer = [System.Diagnostics.Stopwatch]::StartNew()
& docker exec $Container pg_restore -U postgres -d $TargetDatabase $dumpPath
if ($LASTEXITCODE -ne 0) { throw 'pg_restore failed' }
$restoreTimer.Stop()

$targetCounts = Table-Counts $TargetDatabase
$allTimer.Stop()

$integrity = $true
$diffs = New-Object System.Collections.Generic.List[string]
foreach($key in $sourceCounts.Keys) {
  if (-not $targetCounts.Contains($key)) {
    $integrity=$false; $diffs.Add("Missing table $key"); continue
  }
  if ([long]$sourceCounts[$key] -ne [long]$targetCounts[$key]) {
    $integrity=$false; $diffs.Add("Row count mismatch $key source=$($sourceCounts[$key]) target=$($targetCounts[$key])")
  }
}
foreach($key in $targetCounts.Keys) {
  if (-not $sourceCounts.Contains($key)) { $integrity=$false; $diffs.Add("Unexpected table $key") }
}

$evidence = [ordered]@{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  syntheticOnly = $true
  container = $Container
  sourceDatabase = $SourceDatabase
  targetDatabase = $TargetDatabase
  dumpSha256 = $sha256
  sourceTableCounts = $sourceCounts
  targetTableCounts = $targetCounts
  integrity = $integrity
  differences = @($diffs)
  restoreSecondsMeasured = [math]::Round($restoreTimer.Elapsed.TotalSeconds,3)
  totalDrillSecondsMeasured = [math]::Round($allTimer.Elapsed.TotalSeconds,3)
  rpoTargetStatus = "NOT_EVALUATED_OPEN_OD_09"
  rtoTargetStatus = "MEASURED_ONLY_NOT_PRODUCTION_CLAIM"
  encryptionAtRest = "NOT_APPLICABLE_SYNTHETIC_LOCAL_DRILL"
  offsiteImmutableCopy = "NOT_TESTED_IN_LOCAL_DRILL"
}
$parent = Split-Path -Parent $EvidencePath
if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
$evidence | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $EvidencePath -Encoding UTF8

if (-not $integrity) { throw ("Restore integrity mismatch: " + ($diffs -join '; ')) }
"RESTORE_DRILL_PASS evidence=$EvidencePath restore_seconds=$($evidence.restoreSecondsMeasured) sha256=$sha256"
