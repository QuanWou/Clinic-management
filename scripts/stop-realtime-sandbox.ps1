param([switch]$KeepDatabase)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=[IO.Path]::GetFullPath((Join-Path $taskRoot '.runtime/realtime-e2e'))
$taskStatePath=Join-Path $taskRuntime 'processes.json'
if(Test-Path -LiteralPath $taskStatePath){
 $taskState=Get-Content -LiteralPath $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
 if($taskState.workspace -ne $taskRoot -or $taskState.runtimeRoot -ne $taskRuntime){throw 'Refusing to stop a different runtime'}
 foreach($taskRecord in $taskState.processes){
  $taskProcess=Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue
  if($taskProcess -and $taskProcess.Path -eq $taskRecord.executable -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$taskRecord.startedAt).UtcTicks){Stop-Process -Id $taskRecord.id -Force}
 }
 $taskState.status='STOPPED';$taskState|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $taskStatePath
}
if(-not $KeepDatabase){
 $taskCluster=[IO.Path]::GetFullPath((Join-Path $taskRuntime 'postgres'))
 if(-not $taskCluster.StartsWith($taskRuntime+[IO.Path]::DirectorySeparatorChar)){throw 'Invalid isolated cluster path'}
 $taskPidFile=Join-Path $taskCluster 'postmaster.pid'
 if(Test-Path -LiteralPath $taskPidFile){
  $taskPid=Get-Content -LiteralPath $taskPidFile
  if([IO.Path]::GetFullPath($taskPid[1]) -ne $taskCluster){throw 'Refusing a different PostgreSQL cluster'}
  $taskProcess=Start-Process -FilePath 'C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe' -ArgumentList @('-D',('"'+$taskCluster+'"'),'-m','fast','-w','stop') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'postgres-stop.log') -RedirectStandardError (Join-Path $taskRuntime 'postgres-stop.stderr')
  $taskProcess.WaitForExit();if($taskProcess.ExitCode){throw 'Isolated PostgreSQL stop failed'}
 }
}
Write-Host 'Only the recorded realtime sandbox was stopped; evidence and snapshot are retained.'
