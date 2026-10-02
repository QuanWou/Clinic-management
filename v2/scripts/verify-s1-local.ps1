param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidence=Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S1/verification'
$sandboxRoot=Join-Path $taskRoot 'v2/.sandbox'
$taskId=[guid]::NewGuid().ToString('N')
$sandbox=[IO.Path]::GetFullPath((Join-Path $sandboxRoot $taskId))
if(-not $sandbox.StartsWith([IO.Path]::GetFullPath($sandboxRoot)+[IO.Path]::DirectorySeparatorChar)){
 throw 'Sandbox must stay inside the task workspace'
}
New-Item -ItemType Directory -Force -Path $sandbox,$evidence | Out-Null
$password=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
$pwfile=Join-Path $sandbox 'init-password'
$password | Set-Content -LiteralPath $pwfile -NoNewline
$saved=@{}
$started=$false
$summary=[ordered]@{task='P05-S1';runtime='isolated-local-postgresql';startedAt=[DateTimeOffset]::UtcNow.ToString('o');modules=@();status='RUNNING';cleanup='PENDING'}
function Env([string]$name,[string]$value){
 if(-not $saved.ContainsKey($name)){$saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
 [Environment]::SetEnvironmentVariable($name,$value,'Process')
}
function Checked([string]$file,[string[]]$arguments,[string]$log){
 if((Split-Path $file -Leaf) -eq 'pg_ctl.exe'){
  $taskArguments=$arguments | ForEach-Object { '"'+$_.Replace('"','\"')+'"' }
  $taskProcess=Start-Process -FilePath $file -ArgumentList $taskArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence $log) -RedirectStandardError (Join-Path $evidence "$log.stderr")
  $taskProcess.WaitForExit()
  Get-Content -LiteralPath (Join-Path $evidence $log)
  if($taskProcess.ExitCode -ne 0){throw "pg_ctl failed; inspect $log"}
  return
 }
 & $file @arguments 2>&1 | Tee-Object -FilePath (Join-Path $evidence $log)
 if($LASTEXITCODE -ne 0){throw "$file failed; inspect $log"}
}
try{
 $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0)
 $listener.Start();$port=$listener.LocalEndpoint.Port;$listener.Stop();$summary.port=$port
 Checked (Join-Path $PostgresBin 'initdb.exe') @('-D',(Join-Path $sandbox 'data'),'-U','postgres','-A','scram-sha-256',"--pwfile=$pwfile",'--encoding=UTF8','--locale=C') 'local-init.txt'
 Remove-Item -LiteralPath $pwfile
 Checked (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',(Join-Path $sandbox 'data'),'-l',(Join-Path $sandbox 'postgres.txt'),'-o',"-p $port -h 127.0.0.1",'-w','start') 'local-start.txt'
 $started=$true
 Env 'PGPASSWORD' $password
 $sql=@()
 foreach($service in @('search','patient','appointment','clinic','doctor','catalog','notification','audit')){
  $sql+="CREATE DATABASE clinic_v2_s1_${service}_sandbox;"
  $sql+="CREATE ROLE s1_${service}_verify LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$password';"
 }
 $sql -join [Environment]::NewLine | & (Join-Path $PostgresBin 'psql.exe') -X -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 |
   Tee-Object -FilePath (Join-Path $evidence 'bootstrap.txt')
 if($LASTEXITCODE -ne 0){throw 'Isolated bootstrap failed'}
 foreach($service in @('search','patient','appointment','clinic','doctor','catalog','notification','audit')){
  $prefix=$service.ToUpperInvariant();$schema=if($service -in @('clinic','doctor')){$service}else{"${service}_v2"};$database="clinic_v2_s1_${service}_sandbox"
  Env "${prefix}_IT_RUNTIME_USER" "s1_${service}_verify"
  Env "${prefix}_IT_RUNTIME_PASSWORD" $password
  Env "${prefix}_IT_MIGRATION_USER" 'postgres'
  Env "${prefix}_IT_MIGRATION_PASSWORD" $password
  $pom=Join-Path $taskRoot "v2/services/$service-service/pom.xml"
  $selection=if($service -eq 'clinic'){'-Dtest=ProjectionOutboxPostgresTest,ClinicOnboardingServiceTest,TokenVerifierTest'}elseif($service -in @('doctor','catalog')){'-Dtest=ProjectionOutboxPostgresTest,*ServiceTest'}elseif($service -eq 'audit'){'-Dtest=AppointmentAuditPostgresTest,EventEnvelopeValidatorTest,WorkloadTokenVerifierTest'}else{'-DfailIfNoTests=true'}
  Checked 'mvn.cmd' @('-B','-ntp','-f',$pom,'clean','test',$selection,"-D$service.it.enabled=true","-D$service.it.jdbc-url=jdbc:postgresql://127.0.0.1:$port/$database") "$service-test.txt"
  $reports=Join-Path $taskRoot "v2/services/$service-service/target/surefire-reports"
  $tests=0;$failures=0;$errors=0;$skipped=0
  foreach($report in Get-ChildItem -LiteralPath $reports -Filter 'TEST-*.xml'){
   [xml]$r=Get-Content -Raw -LiteralPath $report.FullName
   $tests+=[int]$r.testsuite.tests;$failures+=[int]$r.testsuite.failures;$errors+=[int]$r.testsuite.errors;$skipped+=[int]$r.testsuite.skipped
  }
  if($tests -eq 0 -or $failures -ne 0 -or $errors -ne 0 -or $skipped -ne 0){throw "$service requires passing tests with zero skips"}
  Get-ChildItem -LiteralPath $reports -Filter '*.txt' | Copy-Item -Destination $evidence -Force
  Checked (Join-Path $PostgresBin 'psql.exe') @('-X','-h','127.0.0.1','-p',"$port",'-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-c',
   "SELECT current_database(),version(); SELECT version,description,success FROM $schema.flyway_schema_history ORDER BY installed_rank; SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname='s1_${service}_verify';") "$service-database.txt"
  Checked 'mvn.cmd' @('-B','-ntp','-f',$pom,'-DskipTests','package') "$service-package.txt"
  $jar=Join-Path $taskRoot "v2/services/$service-service/target/$service-service-0.1.0-SNAPSHOT.jar"
  $summary.modules+=@{service=$service;tests=$tests;failures=$failures;errors=$errors;skipped=$skipped;package='PASS';jarSha256=(Get-FileHash -LiteralPath $jar).Hash}
 }
 . (Join-Path $PSScriptRoot 'verify-s1-projection-flow.ps1')
 Invoke-S1ProjectionFlow $taskRoot $evidence $port $password $PostgresBin
 $summary.projectionFlow='PASS'
 $summary.status='PASS'
}catch{
 $summary.status='FAIL';$summary.error=$_.Exception.Message;throw
}finally{
 try{
  if($started){
   Checked (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',(Join-Path $sandbox 'data'),'-m','fast','-w','stop') 'local-stop.txt'
  }
  if($sandbox.StartsWith([IO.Path]::GetFullPath($sandboxRoot)+[IO.Path]::DirectorySeparatorChar) -and (Split-Path $sandbox -Leaf) -eq $taskId){
   Remove-Item -LiteralPath $sandbox -Recurse -Force
   $summary.cleanup='PASS'
  }else{throw 'Cleanup boundary invalid'}
 }catch{$summary.cleanup='FAIL';$summary.status='FAIL';$summary.cleanupError=$_.Exception.Message}
 foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')}
 $summary.finishedAt=[DateTimeOffset]::UtcNow.ToString('o')
 $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'summary.json') -Encoding utf8
}
if($summary.status -ne 'PASS'){throw 'Verification did not pass'}



