param([switch]$Apply)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=Join-Path $taskRoot '.runtime/main'
$taskConfig=Get-Content (Join-Path $taskRuntime 'config.json') -Raw | ConvertFrom-Json -AsHashtable
$taskState=Get-Content (Join-Path $taskRuntime 'processes.json') -Raw | ConvertFrom-Json -AsHashtable
if($taskState.workspace -ne $taskRoot -or $taskState.runtimeRoot -ne $taskRuntime){throw 'Runtime ownership mismatch'}
if($taskConfig.databaseName -ne 'clinic_db' -or $taskConfig.databaseHost -ne '127.0.0.1' -or $taskConfig.clinic -ne '03136db2-48e0-4320-bbdd-5c49e24b6db3'){throw 'Reviewed cleanup only supports the verified local An Nhien database'}
$taskOutput=Join-Path $taskRuntime ('qa-cleanup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $taskOutput | Out-Null
$taskDatabaseArgs=@('-h',$taskConfig.databaseHost,'-p',"$($taskConfig.databasePort)",'-U',$taskConfig.databaseUser,'-d',$taskConfig.databaseName,'-w')
$taskPreviousPassword=$env:PGPASSWORD
$taskRestart=$taskState.status -eq 'RUNNING'
$taskStopped=$false
try {
 & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'stop-main.ps1')
 if($LASTEXITCODE -ne 0){throw 'Failed to stop owned runtime'}
 $taskStopped=$true
 $env:PGPASSWORD=$taskConfig.databasePassword
 $taskBackup=Join-Path $taskOutput 'before.dump'
 & (Join-Path $taskConfig.postgresBin 'pg_dump.exe') @taskDatabaseArgs -Fc -f $taskBackup
 if($LASTEXITCODE -ne 0 -or (Get-Item $taskBackup).Length -eq 0){throw 'Backup failed; no cleanup performed'}
 & (Join-Path $taskConfig.postgresBin 'pg_restore.exe') --list $taskBackup > (Join-Path $taskOutput 'backup-contents.txt')
 if($LASTEXITCODE -ne 0){throw 'Backup verification failed'}
 Get-FileHash $taskBackup -Algorithm SHA256 | Select-Object Algorithm,Hash,Path | ConvertTo-Json | Set-Content (Join-Path $taskOutput 'backup-sha256.json')
 Write-Host "Verified backup: $taskBackup"
 $taskSql=Join-Path $PSScriptRoot 'clean-main-qa-patients.sql'
 & (Join-Path $taskConfig.postgresBin 'psql.exe') @taskDatabaseArgs -X -v ON_ERROR_STOP=1 -v apply=false -P pager=off -f $taskSql *> (Join-Path $taskOutput 'dry-run.log')
 if($LASTEXITCODE -ne 0){throw "Cleanup dry-run failed (rolled back); inspect $taskOutput/dry-run.log"}
 Write-Host 'Dry run passed: all preserved database tables unchanged.'
 if($Apply){
  & (Join-Path $taskConfig.postgresBin 'psql.exe') @taskDatabaseArgs -X -v ON_ERROR_STOP=1 -v apply=true -P pager=off -f $taskSql *> (Join-Path $taskOutput 'applied.log')
  if($LASTEXITCODE -ne 0){throw "Cleanup failed (rolled back); inspect $taskOutput/applied.log"}
  Write-Host "Cleanup committed. Report: $taskOutput/applied.log"
 } else {Write-Host 'Dry run only; database changes rolled back.'}
} finally {
 if($null -eq $taskPreviousPassword){Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}else{$env:PGPASSWORD=$taskPreviousPassword}
 if($taskStopped -and $taskRestart){
  & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'start-main.ps1')
  if($LASTEXITCODE -ne 0){Write-Warning 'Runtime restart failed; inspect private main logs.'}
 }
}
