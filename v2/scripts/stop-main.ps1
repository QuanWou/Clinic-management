param()
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskRuntime=Join-Path $taskRoot 'v2/.runtime/main';$taskStatePath=Join-Path $taskRuntime 'processes.json'
if(-not (Test-Path -LiteralPath $taskStatePath)){Write-Host 'No owned main application runtime';exit 0}
$taskState=Get-Content -LiteralPath $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
if($taskState.workspace -ne $taskRoot -or $taskState.runtimeRoot -ne $taskRuntime){throw 'Main ownership boundary does not match this checkout'}
$taskRecords=@($taskState.processes);[array]::Reverse($taskRecords)
foreach($taskRecord in $taskRecords){
 $taskProcess=Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue;if(-not $taskProcess){continue}
 if($taskProcess.Path -ne $taskRecord.executable -or $taskProcess.StartTime.ToUniversalTime().Ticks -ne ([DateTimeOffset]$taskRecord.startedAt).UtcTicks){throw "Process identity changed; refused to stop $($taskRecord.name)"}
 Stop-Process -Id $taskProcess.Id;$taskProcess.WaitForExit(10000)|Out-Null
}
$taskState.status='STOPPED';$taskState|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $taskStatePath -Encoding utf8
Write-Host 'Stopped owned V2 applications. The main PostgreSQL database and all data remain available.'
