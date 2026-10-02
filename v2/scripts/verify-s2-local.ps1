param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin',[switch]$KeepSandbox,[string]$EvidenceDirectory,[string]$CheckpointTask='P05-S2',[switch]$IncludeCare,[switch]$IncludeMedical,[switch]$IncludeBilling,[switch]$IncludePortal,[switch]$IncludeAftercare,[switch]$IncludeFinancialNotification,[switch]$IncludeSourceCharges,[switch]$IncludeOwnerConfiguration,[switch]$IncludeRealIdentity,[ValidateSet('patient','appointment','clinic','doctor','encounter','identity','notification','audit','catalog','medical','billing','search')][string[]]$ServiceSelection,[switch]$SkipHttpFlow,[string]$VerifiedPackageSummary)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$evidence=Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S2/verification'
if($EvidenceDirectory){$evidence=[IO.Path]::GetFullPath($EvidenceDirectory)}
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
$taskServices=@('patient','appointment','clinic','doctor','encounter','identity','notification','audit')
 if($IncludeMedical){$taskServices+=@('catalog','medical')}
if($IncludeBilling){if(-not $IncludeMedical -or -not $IncludeCare){throw 'Billing flow requires Medical and Care'};$taskServices+=@('billing')}
if($IncludePortal -and -not $IncludeBilling){throw 'Portal flow requires onsite Billing'}
if($IncludeAftercare -and -not $IncludePortal){throw 'Aftercare flow requires Patient Portal'}
if($IncludeFinancialNotification -and -not $IncludeAftercare){throw 'Financial notification flow requires operational Aftercare'}
if($IncludeSourceCharges -and -not $IncludeFinancialNotification){throw 'Source charges flow requires the complete operational financial flow'}
if($IncludeRealIdentity){$taskServices+=@('search')}
if($IncludeRealIdentity -and -not $IncludeOwnerConfiguration){throw 'Authenticated verification requires the complete operational configuration flow'}
if($IncludeOwnerConfiguration -and -not $IncludeSourceCharges){throw 'Owner configuration verification requires the complete source charge flow'}
 if($ServiceSelection){if(-not $SkipHttpFlow){throw 'Partial module verification must explicitly skip the full HTTP flow'};$taskServices=@($ServiceSelection | Select-Object -Unique)}
$taskVerifiedPackages=$null
if($VerifiedPackageSummary){
 $taskVerifiedPackages=Get-Content -LiteralPath $VerifiedPackageSummary -Raw|ConvertFrom-Json
 foreach($taskService in $taskServices){
  $taskPrevious=@($taskVerifiedPackages.modules|Where-Object service -eq $taskService)
  $taskJar=Join-Path $taskRoot "v2/services/$taskService-service/target/$taskService-service-0.1.0-SNAPSHOT.jar"
  $taskNewest=Get-ChildItem -LiteralPath (Join-Path $taskRoot "v2/services/$taskService-service/src") -Recurse -File|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1
  if($taskPrevious.Count -ne 1 -or $taskPrevious[0].failures -ne 0 -or $taskPrevious[0].errors -ne 0 -or $taskPrevious[0].skipped -ne 0 -or $taskPrevious[0].tests -lt 1 -or $taskPrevious[0].package -ne 'PASS' -or (Get-FileHash -LiteralPath $taskJar).Hash -ne $taskPrevious[0].jarSha256 -or $taskNewest.LastWriteTimeUtc -gt (Get-Item -LiteralPath $taskJar).LastWriteTimeUtc){throw "Exact verified package/source required: $taskService"}
 }
}
$summary=[ordered]@{task=$CheckpointTask;runtime='isolated-local-postgresql';startedAt=[DateTimeOffset]::UtcNow.ToString('o');modules=@();status='RUNNING';cleanup='PENDING'}
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'summary.json') -Encoding utf8
function Env([string]$name,[string]$value){
 if(-not $saved.ContainsKey($name)){$saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process')}
 [Environment]::SetEnvironmentVariable($name,$value,'Process')
}
function Checked([string]$file,[string[]]$arguments,[string]$log){
 if((Split-Path $file -Leaf) -eq 'pg_ctl.exe'){
  $taskArguments=$arguments | ForEach-Object { '"'+$_.Replace('"','\"')+'"' }
  $taskProcess=Start-Process -FilePath $file -ArgumentList $taskArguments -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence $log) -RedirectStandardError (Join-Path $evidence "$log.stderr")
  $null=$taskProcess.Handle
  $taskProcess.WaitForExit()
  $taskProcess.Refresh()
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
 foreach($service in $taskServices){
  $sql+="CREATE DATABASE clinic_v2_s1_${service}_sandbox;"
  $sql+="CREATE ROLE s1_${service}_verify LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$password';"
  if($taskVerifiedPackages){$taskRoleService=if($service -eq 'identity'){'iam'}else{$service};$taskInheritance=if($service -in @('encounter','medical','billing')){'INHERIT'}else{'NOINHERIT'};$sql+="CREATE ROLE clinic_v2_${taskRoleService}_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE $taskInheritance; GRANT clinic_v2_${taskRoleService}_runtime TO s1_${service}_verify;"}
 }
 if($IncludeRealIdentity){$sql+="CREATE DATABASE clinic_v2_s6_auth_sandbox;";$sql+="CREATE ROLE s6_auth_verify LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '$password';"}
 $sql -join [Environment]::NewLine | & (Join-Path $PostgresBin 'psql.exe') -X -h 127.0.0.1 -p $port -U postgres -d postgres -v ON_ERROR_STOP=1 |
   Tee-Object -FilePath (Join-Path $evidence 'bootstrap.txt')
 if($LASTEXITCODE -ne 0){throw 'Isolated bootstrap failed'}
 if($IncludeRealIdentity){
  Checked (Join-Path $PostgresBin 'psql.exe') @('-X','-h','127.0.0.1','-p',"$port",'-U','postgres','-d','clinic_v2_s6_auth_sandbox','-v','ON_ERROR_STOP=1','-c','CREATE SCHEMA identity AUTHORIZATION postgres; GRANT USAGE ON SCHEMA identity TO s6_auth_verify; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO s6_auth_verify; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT USAGE,SELECT ON SEQUENCES TO s6_auth_verify;') 'real-auth-bootstrap.txt'
 }
 foreach($service in $taskServices){
  if($taskVerifiedPackages){$taskEntry=@($taskVerifiedPackages.modules|Where-Object service -eq $service)[0];$taskEntry|Add-Member -NotePropertyName verification -NotePropertyValue 'REUSED_EXACT_JAR_FROM_PRIOR_ZERO_SKIP_TEST_RUN' -Force;$summary.modules+=$taskEntry;continue}
  $prefix=$service.ToUpperInvariant();$schema=if($service -in @('clinic','doctor')){$service}elseif($service -eq 'identity'){'iam'}else{"${service}_v2"};$database="clinic_v2_s1_${service}_sandbox"
  Env "${prefix}_IT_RUNTIME_USER" "s1_${service}_verify"
  Env "${prefix}_IT_RUNTIME_PASSWORD" $password
  Env "${prefix}_IT_MIGRATION_USER" 'postgres'
  Env "${prefix}_IT_MIGRATION_PASSWORD" $password
  $pom=Join-Path $taskRoot "v2/services/$service-service/pom.xml"
  $selection=if($service -eq 'identity'){'-Dtest=IdentityS2PostgresTest,MembershipServiceTest,MembershipSecurityTest,SessionSecurityServiceTest,SecurityTokenTest'}elseif($service -eq 'clinic'){'-Dtest=ProjectionOutboxPostgresTest,ClinicOnboardingServiceTest,TokenVerifierTest,PatientHistoryPostgresTest,ClinicConfigurationPostgresTest'}elseif($service -in @('doctor','catalog')){'-Dtest=ProjectionOutboxPostgresTest,*ServiceTest,EncounterPeerVerifierTest,AbsencePostgresTest'}elseif($service -eq 'audit'){'-Dtest=AppointmentAuditPostgresTest,EventEnvelopeValidatorTest,WorkloadTokenVerifierTest,MedicalAuditHttpPostgresTest,BillingAuditHttpPostgresTest,ChargeRecoveryAuditHttpPostgresTest,ClinicalAccessPostgresTest'}else{'-DfailIfNoTests=true'}
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
 if(-not $SkipHttpFlow){
  . (Join-Path $PSScriptRoot 'verify-s1-projection-flow.ps1')
  . (Join-Path $PSScriptRoot 'verify-s2-reception-flow.ps1')
  Invoke-S2ReceptionFlow $taskRoot $evidence $port $password $PostgresBin -IncludeCare:$IncludeCare -IncludeMedical:$IncludeMedical -IncludeBilling:$IncludeBilling
  $summary.receptionFlow='PASS'
  if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-s6-restore-flow.ps1');Invoke-S6RestoreFlow $taskRoot $evidence $sandbox $port $PostgresBin $taskServices;$summary.syntheticRestore='PASS' }
 }else{$summary.receptionFlow='NOT_RUN_DATABASE_ONLY'}
 $summary.status='PASS'
}catch{
 $summary.status='FAIL';$summary.error=$_.Exception.Message;throw
}finally{
 try{
  if($started -or (Test-Path -LiteralPath (Join-Path $sandbox 'data/postmaster.pid'))){
   Checked (Join-Path $PostgresBin 'pg_ctl.exe') @('-D',(Join-Path $sandbox 'data'),'-m','fast','-w','stop') 'local-stop.txt'
  }
  if($KeepSandbox){$summary.cleanup='RETAINED_BY_CONFIGURATION';$summary.sandbox=$sandbox}
  elseif($sandbox.StartsWith([IO.Path]::GetFullPath($sandboxRoot)+[IO.Path]::DirectorySeparatorChar) -and (Split-Path $sandbox -Leaf) -eq $taskId){
   Remove-Item -LiteralPath $sandbox -Recurse -Force
   $summary.cleanup='PASS'
  }else{throw 'Cleanup boundary invalid'}
 }catch{$summary.cleanup='FAIL';$summary.status='FAIL';$summary.cleanupError=$_.Exception.Message}
 foreach($entry in $saved.GetEnumerator()){[Environment]::SetEnvironmentVariable($entry.Key,$entry.Value,'Process')}
 $summary.finishedAt=[DateTimeOffset]::UtcNow.ToString('o')
 try{ & (Join-Path $PSScriptRoot 'write-s2-source-manifest.ps1') -OutputPath (Join-Path $evidence 'source-manifest.json') }catch{$summary.manifestError=$_.Exception.Message;$summary.status='FAIL'}
 $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $evidence 'summary.json') -Encoding utf8
}
if($summary.status -ne 'PASS'){throw 'Verification did not pass'}









