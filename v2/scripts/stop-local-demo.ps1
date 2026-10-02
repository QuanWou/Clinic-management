param()
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskDemo=[IO.Path]::GetFullPath((Join-Path $taskRoot 'v2/.sandbox/local-demo'))
$taskStatePath=Join-Path $taskDemo 'processes.json'
if(-not (Test-Path -LiteralPath $taskStatePath)){Write-Host 'Local demo has no recorded processes';exit 0}
$taskState=Get-Content -LiteralPath $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
if($taskState.workspace -ne $taskRoot -or $taskState.demoRoot -ne $taskDemo){throw 'Local process ownership boundary does not match this worktree'}
foreach($taskRecord in $taskState.processes){
 $taskProcess=Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue
 if(-not $taskProcess){continue}
 if($taskProcess.StartTime.ToUniversalTime().Ticks -ne ([DateTimeOffset]$taskRecord.startedAt).UtcTicks -or $taskProcess.Path -ne $taskRecord.executable){throw "Process ID was reused; refused to stop $($taskRecord.name)"}
 Stop-Process -Id $taskProcess.Id -Force
 $taskProcess.WaitForExit(10000)|Out-Null
}
$taskConfig=Get-Content -LiteralPath (Join-Path $taskDemo 'config.json') -Raw|ConvertFrom-Json -AsHashtable
if(Test-Path -LiteralPath (Join-Path $taskDemo 'data/postmaster.pid')){
 $taskPidLines=Get-Content -LiteralPath (Join-Path $taskDemo 'data/postmaster.pid')
 if([IO.Path]::GetFullPath($taskPidLines[1]) -ne [IO.Path]::GetFullPath((Join-Path $taskDemo 'data')) -or [int]$taskPidLines[3] -ne $taskConfig.databasePort){throw 'PostgreSQL ownership/port mismatch; refused stop'}
 $taskPgProcess=Start-Process (Join-Path $taskConfig.postgresBin 'pg_ctl.exe') -ArgumentList @('-D',('"'+(Join-Path $taskDemo 'data')+'"'),'-m','fast','-w','stop') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDemo 'stop-postgres.out') -RedirectStandardError (Join-Path $taskDemo 'stop-postgres.err')
 $null=$taskPgProcess.Handle;$taskPgProcess.WaitForExit();$taskPgProcess.Refresh()
 if($taskPgProcess.ExitCode -ne 0){throw 'Local PostgreSQL stop failed; inspect stop-postgres.err'}
}
$taskState.status='STOPPED';$taskState.stoppedAt=[DateTimeOffset]::UtcNow.ToString('o')
$taskState|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $taskStatePath -Encoding utf8
Write-Host 'Stopped owned local demo services. Database and demo accounts are retained for restart.'
