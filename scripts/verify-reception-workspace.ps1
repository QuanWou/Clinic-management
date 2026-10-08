param([switch]$KeepSandbox)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskEvidence=Join-Path $taskRoot '.runtime/reception-verification'
$taskPostgres='C:\Program Files\PostgreSQL\17\bin'
$taskSandbox=Join-Path $taskRoot ('.sandbox/reception-'+[guid]::NewGuid().ToString('N'))
$taskResolved=[IO.Path]::GetFullPath($taskSandbox)
if(-not $taskResolved.StartsWith([IO.Path]::GetFullPath((Join-Path $taskRoot '.sandbox'))+[IO.Path]::DirectorySeparatorChar)){throw 'Sandbox escaped workspace'}
New-Item -ItemType Directory -Force -Path $taskSandbox,$taskEvidence|Out-Null
$taskPassword=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
$taskPasswordFile=Join-Path $taskSandbox 'password';[IO.File]::WriteAllText($taskPasswordFile,$taskPassword)
$taskListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$taskListener.Start();$taskPort=$taskListener.LocalEndpoint.Port;$taskListener.Stop()
$taskStarted=$false;$taskSummary=@{status='RUNNING';database='isolated-disposable-postgresql';modules=@()}
function Invoke-Checked([string]$Executable,[string[]]$Arguments,[string]$Log){
 & $Executable @Arguments *> (Join-Path $taskEvidence $Log)
 if($LASTEXITCODE -ne 0){throw "Verification failed; inspect $Log"}
}
try{
 Invoke-Checked (Join-Path $taskPostgres 'initdb.exe') @('-D',(Join-Path $taskSandbox 'data'),'-U','postgres','-A','scram-sha-256',"--pwfile=$taskPasswordFile",'--encoding=UTF8','--locale=C') 'init.log'
 Remove-Item -LiteralPath $taskPasswordFile
 $taskProcess=Start-Process -FilePath (Join-Path $taskPostgres 'pg_ctl.exe') -ArgumentList @('-D',('"'+(Join-Path $taskSandbox 'data')+'"'),'-l',('"'+(Join-Path $taskSandbox 'postgres.log')+'"'),'-o',('"-p '+$taskPort+' -h 127.0.0.1"'),'-w','start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskEvidence 'start.log') -RedirectStandardError (Join-Path $taskEvidence 'start.stderr')
 $taskProcess.WaitForExit()
 if($taskProcess.ExitCode -ne 0){throw 'Sandbox PostgreSQL failed to start'};$taskStarted=$true
 $env:PGPASSWORD=$taskPassword
 $taskModules=@(@{name='encounter';core='appointment'},@{name='appointment';core='appointment'},@{name='doctor';core='doctor'},@{name='billing';core='billing'})
 foreach($taskModule in $taskModules){
  $taskName=$taskModule.name;$taskPrefix=$taskName.ToUpperInvariant();$taskDatabase="clinic_v2_s1_${taskName}_sandbox";$taskUser="reception_${taskName}_verify"
  Invoke-Checked (Join-Path $taskPostgres 'psql.exe') @('-X','-h','127.0.0.1','-p',"$taskPort",'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',"CREATE DATABASE $taskDatabase") "$taskName-create.log"
  Invoke-Checked (Join-Path $taskPostgres 'psql.exe') @('-X','-h','127.0.0.1','-p',"$taskPort",'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',"CREATE ROLE clinic_v2_${taskName}_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS") "$taskName-group.log"
  Invoke-Checked (Join-Path $taskPostgres 'psql.exe') @('-X','-h','127.0.0.1','-p',"$taskPort",'-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',"CREATE ROLE $taskUser LOGIN NOSUPERUSER NOBYPASSRLS INHERIT PASSWORD '$taskPassword'") "$taskName-role.log"
  [Environment]::SetEnvironmentVariable("${taskPrefix}_IT_MIGRATION_USER",'postgres','Process');[Environment]::SetEnvironmentVariable("${taskPrefix}_IT_MIGRATION_PASSWORD",$taskPassword,'Process')
  [Environment]::SetEnvironmentVariable("${taskPrefix}_IT_RUNTIME_USER",$taskUser,'Process');[Environment]::SetEnvironmentVariable("${taskPrefix}_IT_RUNTIME_PASSWORD",$taskPassword,'Process')
  $taskPom=Join-Path $taskRoot "backend/$($taskModule.core)-service/modules/$taskName/pom.xml"
  Invoke-Checked 'mvn.cmd' @('-B','-ntp','-f',$taskPom,'test',"-D$taskName.it.enabled=true","-D$taskName.it.jdbc-url=jdbc:postgresql://127.0.0.1:$taskPort/$taskDatabase") "$taskName-tests.log"
  $taskReports=Join-Path (Split-Path $taskPom) 'target/surefire-reports';$taskTotals=@{name=$taskName;tests=0;failures=0;errors=0;skipped=0}
  foreach($taskReport in Get-ChildItem -LiteralPath $taskReports -Filter 'TEST-*.xml'){[xml]$taskXml=Get-Content -LiteralPath $taskReport.FullName -Raw;foreach($taskMetric in @('tests','failures','errors','skipped')){$taskTotals[$taskMetric]+=[int]$taskXml.testsuite.$taskMetric}}
  if($taskTotals.tests -lt 1 -or $taskTotals.failures -or $taskTotals.errors -or $taskTotals.skipped){throw "$taskName tests did not pass with zero skips"}
  $taskSummary.modules+=$taskTotals;Write-Host "$taskName passed: $($taskTotals.tests) tests"
 }
 $taskSummary.status='PASS'
}catch{$taskSummary.status='FAIL';$taskSummary.error=$_.Exception.Message;throw}
finally{
 $taskSummary|ConvertTo-Json -Depth 8|Set-Content -LiteralPath (Join-Path $taskEvidence 'summary.json')
 if($taskStarted){& (Join-Path $taskPostgres 'pg_ctl.exe') -D (Join-Path $taskSandbox 'data') -m fast -w stop *> (Join-Path $taskEvidence 'stop.log')}
 if(-not $KeepSandbox -and $taskStarted){Remove-Item -LiteralPath $taskResolved -Recurse -Force}
 Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
 foreach($taskModule in $taskModules){foreach($taskSuffix in @('MIGRATION_USER','MIGRATION_PASSWORD','RUNTIME_USER','RUNTIME_PASSWORD')){[Environment]::SetEnvironmentVariable($taskModule.name.ToUpperInvariant()+"_IT_$taskSuffix",$null,'Process')}}
}
