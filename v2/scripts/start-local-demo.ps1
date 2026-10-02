param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin',[int]$DatabasePort=54320,[int]$WebPort=4176)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskDemo=[IO.Path]::GetFullPath((Join-Path $taskRoot 'v2/.sandbox/local-demo'))
$taskConfigPath=Join-Path $taskDemo 'config.json'
$taskStatePath=Join-Path $taskDemo 'processes.json'
$taskServices=@('identity','clinic','doctor','catalog','audit','search','patient','appointment','notification','encounter','medical','billing')
if($PSVersionTable.PSVersion.Major -lt 7){throw 'Use PowerShell 7 (pwsh.exe) for isolated child environments'}
function Save-Config {$taskConfig|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $taskConfigPath -Encoding utf8}
function Save-State {$taskState|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $taskStatePath -Encoding utf8}
function Request([string]$service,[string]$path,[string]$method='Get',[hashtable]$headers=@{},[object]$body=$null){
 $parameters=@{Uri="http://127.0.0.1:$($taskConfig.ports[$service])$path";Method=$method;Headers=$headers;TimeoutSec=20}
 if($null -ne $body){$parameters.ContentType='application/json';$parameters.Body=$body|ConvertTo-Json -Depth 10}
 try{$taskResponse=Invoke-RestMethod @parameters;foreach($taskItem in $taskResponse){$taskItem}}catch{throw "Local API failed: $method $path ($($_.Exception.Message))"}
}
function Sql([string]$database,[string]$sql){
 $taskSqlPath=Join-Path $taskDemo 'bootstrap.sql'
 $sql|Set-Content -LiteralPath $taskSqlPath -Encoding utf8
 $taskSqlProcess=Start-Process (Join-Path $PostgresBin 'psql.exe') -Environment @{PGPASSWORD=$taskConfig.databasePassword} -ArgumentList @('-X','-h','127.0.0.1','-p',"$($taskConfig.databasePort)",'-U','postgres','-d',$database,'-v','ON_ERROR_STOP=1','-f',('"'+$taskSqlPath+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDemo 'sql.out') -RedirectStandardError (Join-Path $taskDemo 'sql.err')
 $null=$taskSqlProcess.Handle;$taskSqlProcess.WaitForExit();$taskSqlProcess.Refresh()
 if($taskSqlProcess.ExitCode -ne 0){throw "Local database bootstrap failed; inspect $taskDemo/sql.err"}
 Remove-Item -LiteralPath $taskSqlPath
}
function PgCtl([string]$action){
 $taskPgArgs=@('-D',('"'+(Join-Path $taskDemo 'data')+'"'),'-w')
 if($action -eq 'start'){$taskPgArgs+=@('-l',('"'+(Join-Path $taskDemo 'postgres.log')+'"'),'-o',('"-p '+$taskConfig.databasePort+' -h 127.0.0.1"'),'start')}else{$taskPgArgs+=@('-m','fast','stop')}
 $taskPgProcess=Start-Process (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList $taskPgArgs -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDemo 'postgres-control.out') -RedirectStandardError (Join-Path $taskDemo 'postgres-control.err')
 $null=$taskPgProcess.Handle;$taskPgProcess.WaitForExit();$taskPgProcess.Refresh()
 if($taskPgProcess.ExitCode -ne 0){throw "Local PostgreSQL $action failed; inspect postgres-control.err"}
}
function Start-Owned([string]$name,[string]$file,[string[]]$arguments,[hashtable]$environment,[string]$directory=$taskRoot){
 $taskChild=Start-Process $file -ArgumentList $arguments -Environment $environment -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDemo "$name.log") -RedirectStandardError (Join-Path $taskDemo "$name.stderr")
 $taskState.processes+=@{name=$name;id=$taskChild.Id;startedAt=$taskChild.StartTime.ToUniversalTime().ToString('o');executable=[IO.Path]::GetFullPath($file)}
 Save-State
}
function Wait-Healthy([string]$service){
 for($taskTry=0;$taskTry -lt 120;$taskTry++){
  try{if((Request $service '/actuator/health').status -eq 'UP'){Write-Host "Ready: $service";return}}catch{}
  $taskRecord=@($taskState.processes|Where-Object name -eq $service)[0]
  if(-not (Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue)){throw "$service stopped; inspect $taskDemo/$service.log"}
  Start-Sleep -Milliseconds 500
 }
 throw "$service did not become healthy; inspect $taskDemo/$service.log"
}
function Peer-Environment {
 $taskPeer=$taskConfig.peerSecret;$taskPorts=$taskConfig.ports
 $taskEnv=@{SERVER_ADDRESS='127.0.0.1';SPRING_FLYWAY_ENABLED='true';SPRING_FLYWAY_USER='postgres';SPRING_FLYWAY_PASSWORD=$taskConfig.databasePassword;SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'}
 foreach($taskService in $taskServices){
  $taskPrefix=if($taskService -eq 'identity'){'IAM'}else{$taskService.ToUpperInvariant()}
  $taskEnv["${taskPrefix}_V2_IAM_URL"]="http://127.0.0.1:$($taskPorts.identity)"
  $taskEnv["${taskPrefix}_V2_IDENTITY_URL"]="http://127.0.0.1:$($taskPorts.identity)"
  $taskEnv["${taskPrefix}_V2_CLINIC_URL"]="http://127.0.0.1:$($taskPorts.clinic)"
  $taskEnv["${taskPrefix}_V2_IAM_SERVICE_SECRET"]=$taskPeer
  $taskEnv["${taskPrefix}_V2_CLINIC_SERVICE_SECRET"]=$taskPeer
 }
 foreach($taskKey in @('PROJECTION_RELAY_SECRET','SEARCH_V2_CLINIC_SECRET','SEARCH_V2_DOCTOR_SECRET','SEARCH_V2_CATALOG_SECRET','AUDIT_SECURITY_ENCOUNTER_SECRET','AUDIT_SECURITY_APPOINTMENT_SECRET','AUDIT_SECURITY_MEDICAL_SECRET','AUDIT_SECURITY_BILLING_SECRET','AUDIT_V2_IDENTITY_SECRET','AUDIT_V2_CLINIC_SECRET','AUDIT_V2_DOCTOR_SECRET','AUDIT_V2_CATALOG_SECRET','NOTIFICATION_V2_APPOINTMENT_SECRET','NOTIFICATION_V2_BILLING_SECRET','PATIENT_V2_APPOINTMENT_SECRET','PATIENT_V2_BILLING_SECRET','CLINIC_V2_IAM_DIRECTORY_SECRET','CLINIC_V2_DOCTOR_SERVICE_SECRET','CLINIC_V2_CATALOG_SERVICE_SECRET','CLINIC_V2_APPOINTMENT_SERVICE_SECRET','CLINIC_SECURITY_PATIENT_SERVICE_SECRET','CLINIC_SECURITY_ENCOUNTER_SERVICE_SECRET','ABSENCE_RELAY_SECRET','APPOINTMENT_SECURITY_ABSENCE_SECRET','PATIENT_SECURITY_ENCOUNTER_SECRET','DOCTOR_SECURITY_ENCOUNTER_SECRET','APPOINTMENT_SECURITY_ENCOUNTER_SECRET','ENCOUNTER_V2_SERVICE_SECRET','MEDICAL_V2_SERVICE_SECRET','BILLING_V2_SERVICE_SECRET','ENCOUNTER_SECURITY_BILLING_SECRET','MEDICAL_SECURITY_BILLING_SECRET','APPOINTMENT_SECURITY_BILLING_SECRET','BILLING_CHARGES_MEDICAL_SECRET','BILLING_CHARGES_ENCOUNTER_SECRET','APPOINTMENT_V2_WORKLOAD_SECRET','IAM_V2_WORKLOAD_INBOUND_SECRET','IAM_V2_CLINIC_INBOUND_SECRET','IAM_V2_CLINIC_OUTBOUND_SECRET')){$taskEnv[$taskKey]=$taskPeer}
 foreach($taskLink in @(
  @('PROJECTION_RELAY_SEARCH_URL','search'),@('APPOINTMENT_RELAY_NOTIFICATION_URL','notification'),@('APPOINTMENT_RELAY_AUDIT_URL','audit'),@('ENCOUNTER_RELAY_AUDIT_URL','audit'),@('MEDICAL_RELAY_AUDIT_URL','audit'),@('BILLING_RELAY_AUDIT_URL','audit'),
  @('APPOINTMENT_V2_PATIENT_URL','patient'),@('APPOINTMENT_V2_DOCTOR_URL','doctor'),@('APPOINTMENT_V2_CATALOG_URL','catalog'),@('ABSENCE_RELAY_APPOINTMENT_URL','appointment'),
  @('ENCOUNTER_PATIENT_URL','patient'),@('ENCOUNTER_DOCTOR_URL','doctor'),@('ENCOUNTER_APPOINTMENT_URL','appointment'),@('ENCOUNTER_MEDICAL_URL','medical'),
  @('BILLING_PATIENT_URL','patient'),@('CLINIC_PATIENT_URL','patient'),@('ENCOUNTER_PORTAL_PATIENT_URL','patient'),@('MEDICAL_PORTAL_PATIENT_URL','patient'),
  @('APPOINTMENT_FOLLOW_UP_ENCOUNTER_URL','encounter'),@('APPOINTMENT_FOLLOW_UP_MEDICAL_URL','medical'),@('BILLING_NOTIFICATION_PATIENT_URL','patient'),@('BILLING_NOTIFICATION_NOTIFICATION_URL','notification'),
  @('MEDICAL_CHARGES_BILLING_URL','billing'),@('ENCOUNTER_CHARGES_BILLING_URL','billing'),@('MEDICAL_ENCOUNTER_URL','encounter'),@('MEDICAL_CATALOG_URL','catalog'),
  @('BILLING_ENCOUNTER_URL','encounter'),@('BILLING_MEDICAL_URL','medical'),@('BILLING_APPOINTMENT_URL','appointment'),@('IAM_V2_LEGACY_IDENTITY_URL','auth')
 )){$taskEnv[$taskLink[0]]="http://127.0.0.1:$($taskPorts[$taskLink[1]])"}
 foreach($taskKey in @('APPOINTMENT_RELAY_ENABLED','ENCOUNTER_RELAY_ENABLED','MEDICAL_RELAY_ENABLED','BILLING_RELAY_ENABLED','ABSENCE_RELAY_ENABLED','PATIENT_V2_RECEPTION_ENABLED','BILLING_NOTIFICATION_ENABLED','BILLING_CHARGES_ENABLED','MEDICAL_CHARGES_ENABLED','ENCOUNTER_CHARGES_ENABLED')){$taskEnv[$taskKey]='true'}
 # Synthetic publication is available only in this fresh loopback-only demo.
 $taskEnv.CLINIC_V2_PUBLICATION_ENABLED='true';$taskEnv.PROJECTION_RELAY_SEARCH_URL="http://127.0.0.1:$($taskPorts.search)";$taskEnv.PROJECTION_RELAY_REFRESH_MS='1000';$taskEnv.IAM_V2_JWT_SECRET=$taskConfig.userSecret
 return $taskEnv
}
function Seed-Demo {
 $taskTokens=@{}
 $taskNames=@{owner='Chủ phòng khám Demo';manager='Quản lý Demo';reception='Lễ tân Demo';doctor='Bác sĩ Demo';lab='Nhân sự Lab Demo';cashier='Thu ngân Demo';patient='Bệnh nhân Demo';platform='Quản trị nền tảng Demo'}
 foreach($taskName in $taskNames.Keys){
  if(-not $taskConfig.accounts.ContainsKey($taskName)){$taskConfig.accounts[$taskName]=@{email="$taskName@clinic.local";password=$taskConfig.demoPassword;fullName=$taskNames[$taskName]};Save-Config}
  $taskAccount=$taskConfig.accounts[$taskName]
  if(-not $taskAccount.userId){
   $taskRegistration=Invoke-WebRequest "http://127.0.0.1:$($taskConfig.ports.auth)/api/auth/register" -Method Post -ContentType 'application/json' -Body (@{email=$taskAccount.email;password=$taskAccount.password;fullName=$taskAccount.fullName}|ConvertTo-Json) -SkipHttpErrorCheck
   if($taskRegistration.StatusCode -notin 200,201,409){throw "Registration failed for demo role $taskName"}
  }
  $taskLogin=Request auth '/api/auth/login' Post @{} @{email=$taskAccount.email;password=$taskAccount.password}
  $taskAccount.userId=$taskLogin.data.userId;$taskTokens[$taskName]=@{Authorization="Bearer $($taskLogin.data.accessToken)"};Save-Config
 }
 $taskOwner=$taskTokens.owner
 if(-not $taskConfig.clinic){
  $taskCreated=Request clinic '/api/v2/clinics' Post $taskOwner @{name='Phòng khám An Nhiên';slug='phong-kham-an-nhien';publicDescription='Một không gian dành cho việc chăm sóc sức khỏe của bạn. Tìm hiểu dịch vụ, chọn bác sĩ và sắp xếp lịch khám phù hợp.';contactName='Chủ phòng khám Demo';contactEmail='owner@clinic.local';contactPhone='0000000000';license=@{licenseNumber='DEMO-NOT-REAL-LICENSE';issuingAuthority='DEMO-LOCAL-ONLY';scopeSummary='Synthetic local demonstration';evidenceRef='demo/synthetic-only';validUntil=[DateTime]::UtcNow.AddYears(1).ToString('yyyy-MM-dd')}}
  $taskConfig.clinic=$taskCreated.id;Save-Config
 }
 $null=Request clinic "/api/v2/clinics/$($taskConfig.clinic)/owner-membership" Post $taskOwner @{}
 $taskClinic=Request clinic "/api/v2/clinics/$($taskConfig.clinic)" Get $taskOwner
 if(-not $taskConfig.branch){
  if(@($taskClinic.branches).Count -eq 0){$taskClinic=Request clinic "/api/v2/clinics/$($taskConfig.clinic)/branches" Post $taskOwner @{name='Cơ sở Demo';address='Địa chỉ mẫu local';openingHours='Thứ 2–Chủ nhật, 08:00–20:00';active=$true;expectedVersion=$taskClinic.version}}
  $taskConfig.branch=$taskClinic.branches[0].id;Save-Config
 }
 $taskRoles=@{manager='CLINIC_MANAGER';reception='RECEPTIONIST';doctor='DOCTOR';lab='LAB';cashier='CASHIER'}
 foreach($taskName in $taskRoles.Keys){
  $taskUser=$taskConfig.accounts[$taskName].userId;$taskRole=$taskRoles[$taskName];$taskAll=if($taskName -eq 'manager'){'true'}else{'false'};$taskClinicId=$taskConfig.clinic;$taskBranchId=$taskConfig.branch;$taskOwnerId=$taskConfig.accounts.owner.userId
  Sql 'clinic_v2_local_identity' "INSERT INTO iam.memberships(id,user_id,clinic_id,role,status,all_branches,invited_by,activated_at) SELECT gen_random_uuid(),'$taskUser','$taskClinicId','$taskRole','ACTIVE',$taskAll,'$taskOwnerId',now() WHERE NOT EXISTS(SELECT 1 FROM iam.memberships WHERE user_id='$taskUser' AND clinic_id='$taskClinicId' AND role='$taskRole' AND status='ACTIVE'); INSERT INTO iam.membership_branch_grants(id,membership_id,user_id,clinic_id,branch_id,granted_by) SELECT gen_random_uuid(),m.id,m.user_id,m.clinic_id,'$taskBranchId','$taskOwnerId' FROM iam.memberships m WHERE m.user_id='$taskUser' AND m.clinic_id='$taskClinicId' AND m.status='ACTIVE' ON CONFLICT(membership_id,branch_id) DO NOTHING;"
 }
 Sql 'clinic_v2_local_identity' "INSERT INTO iam.platform_operators(user_id) VALUES('$($taskConfig.accounts.platform.userId)') ON CONFLICT(user_id) DO NOTHING;"
 $taskDoctorBase="/api/v2/clinics/$($taskConfig.clinic)/branches/$($taskConfig.branch)/doctor-affiliations"
 if(-not $taskConfig.affiliation){
  $taskAffiliations=@(Request doctor $taskDoctorBase Get $taskOwner)
  $taskAffiliation=$taskAffiliations|Where-Object userId -eq $taskConfig.accounts.doctor.userId|Select-Object -First 1
  if(-not $taskAffiliation){$taskAffiliation=Request doctor $taskDoctorBase Post $taskOwner @{userId=$taskConfig.accounts.doctor.userId;displayName='Bác sĩ Demo';specialtyCode='GEN';specialtyName='Khám tổng quát (mẫu)';effectiveFrom=[DateTime]::UtcNow.AddDays(-1).ToString('yyyy-MM-dd');publicVisible=$true}}
  $taskConfig.affiliation=$taskAffiliation.id;$taskConfig.doctor=$taskAffiliation.practitionerId;Save-Config
 }
 $taskSchedules=@((Request doctor "$taskDoctorBase/$($taskConfig.affiliation)/schedules" Get $taskOwner).schedules)
 for($taskDay=1;$taskDay -le 7;$taskDay++){
  if(-not ($taskSchedules|Where-Object dayOfWeek -eq $taskDay)){$null=Request doctor "$taskDoctorBase/$($taskConfig.affiliation)/schedules" Post $taskOwner @{dayOfWeek=$taskDay;startTime='08:00';endTime='20:00';effectiveFrom=[DateTime]::UtcNow.AddDays(-1).ToString('yyyy-MM-dd');timezone='Asia/Ho_Chi_Minh';active=$true}}
 }
 $taskCatalog="/api/v2/clinics/$($taskConfig.clinic)"
 foreach($taskOfferingSeed in @(@{key='consultation';code='DEMO-CONSULT';name='Khám tổng quát (mẫu)';amount=120000;public=$true},@{key='laboratory';code='DEMO-LAB';name='Xét nghiệm mẫu nội bộ';amount=80000;public=$false})){
  $taskKey=$taskOfferingSeed.key
  $taskOfferings=@(Request catalog "$taskCatalog/offerings" Get $taskOwner);$taskOffering=$taskOfferings|Where-Object code -eq $taskOfferingSeed.code|Select-Object -First 1
  if(-not $taskOffering){$taskOffering=Request catalog "$taskCatalog/offerings" Post $taskOwner @{code=$taskOfferingSeed.code;name=$taskOfferingSeed.name;active=$true}}
  $taskAssignments=@(Request catalog "$taskCatalog/branches/$($taskConfig.branch)/offerings" Get $taskOwner)
  if(-not ($taskAssignments|Where-Object {$_.offering.id -eq $taskOffering.id})){$null=Request catalog "$taskCatalog/branches/$($taskConfig.branch)/offerings" Post $taskOwner @{offeringId=$taskOffering.id;durationMinutes=30;active=$true;publicVisible=$taskOfferingSeed.public}}
  $taskPrices=@(Request catalog "$taskCatalog/branches/$($taskConfig.branch)/offerings/$($taskOffering.id)/price-versions" Get $taskOwner)
  if($taskPrices.Count -eq 0){$null=Request catalog "$taskCatalog/branches/$($taskConfig.branch)/price-versions" Post $taskOwner @{offeringId=$taskOffering.id;amountVnd=$taskOfferingSeed.amount;effectiveFrom=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o')}}
  $taskConfig.offerings[$taskKey]=$taskOffering.id;Save-Config
 }
 if(-not $taskConfig.servicePoint){
  $taskBase="/api/v2/clinics/$($taskConfig.clinic)/branches/$($taskConfig.branch)/service-points"
  $taskPoints=@(Request encounter $taskBase Get $taskOwner);$taskPoint=$taskPoints|Where-Object code -eq 'DEMO01'|Select-Object -First 1
  if(-not $taskPoint){$taskPoint=Request encounter $taskBase Post $taskOwner @{code='DEMO01';name='Phòng khám số 1 (mẫu)'}}
  $taskConfig.servicePoint=$taskPoint.id;Save-Config
 }
 if(-not $taskConfig.patientId){$taskProfile=Request patient '/api/v2/me/patient-profile' Put $taskTokens.patient @{fullName='Bệnh nhân Demo';dateOfBirth='1995-01-01';phone='0001234567';expectedVersion=0};$taskConfig.patientId=$taskProfile.patientId;Save-Config}
 # Exercise the normal separate-review lifecycle using explicitly synthetic evidence.
 if($taskClinic.reviewStatus -eq 'DRAFT'){$taskClinic=Request clinic "/api/v2/clinics/$($taskConfig.clinic)/submit" Post $taskOwner @{}}
 if($taskClinic.reviewStatus -eq 'SUBMITTED'){$taskClinic=Request clinic "/api/v2/platform/clinics/$($taskConfig.clinic)/approve" Post $taskTokens.platform @{reason='DEMO ONLY: synthetic fixture evidence, not professional or production approval';evidenceVerified=$true}}
 if($taskClinic.publicationStatus -eq 'UNPUBLISHED'){$null=Request clinic "/api/v2/platform/clinics/$($taskConfig.clinic)/publish" Post $taskTokens.platform @{reason='DEMO ONLY: visible only on local loopback for functional testing'}}
 $taskConfig.seeded=$true;Save-Config
}
New-Item -ItemType Directory -Force -Path $taskDemo|Out-Null
if(Test-Path -LiteralPath $taskStatePath){
 $taskPrior=Get-Content -LiteralPath $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
 $taskLive=@($taskPrior.processes|Where-Object {$taskProcess=Get-Process -Id $_.id -ErrorAction SilentlyContinue;$taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$_.startedAt).UtcTicks})
 if($taskLive.Count -gt 0){
  if($taskPrior.status -ne 'RUNNING'){throw 'Partial owned demo still running; run stop-local-demo.ps1 before restart'}
  foreach($taskName in ($taskServices+@('auth'))){$taskHealth=Invoke-RestMethod "http://127.0.0.1:$($taskPrior.ports[$taskName])/actuator/health" -TimeoutSec 3;if($taskHealth.status -ne 'UP'){throw 'Existing demo needs recovery; run stop-local-demo.ps1 then restart'}}
  $taskConfig=Get-Content -LiteralPath $taskConfigPath -Raw|ConvertFrom-Json -AsHashtable
  $PostgresBin=$taskConfig.postgresBin
  if(-not $taskConfig.seeded){Seed-Demo}
  $null=Invoke-WebRequest $taskPrior.url -TimeoutSec 3;Write-Host "Already running: $($taskPrior.url)";exit 0
 }
}
if(Test-Path -LiteralPath $taskConfigPath){$taskConfig=Get-Content -LiteralPath $taskConfigPath -Raw|ConvertFrom-Json -AsHashtable}else{
 $taskConfig=@{version=1;databasePort=$DatabasePort;postgresBin=$PostgresBin;databasePassword=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');userSecret=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');peerSecret=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N');demoPassword='ClinicDemo!'+[guid]::NewGuid().ToString('N').Substring(0,8);accounts=@{};offerings=@{};seeded=$false;ports=@{auth=8083;identity=8093;clinic=8092;doctor=8094;catalog=8095;audit=8096;search=8097;patient=8098;appointment=8099;notification=8100;encounter=8101;medical=8102;billing=8103;web=$WebPort}}
 Save-Config
}
$PostgresBin=$taskConfig.postgresBin
foreach($taskPort in (@($taskConfig.ports.Values)+@($taskConfig.databasePort))){if(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){throw "Port $taskPort is already in use; no unrelated process will be stopped"}}
foreach($taskService in $taskServices){
 $taskJar=Join-Path $taskRoot "v2/services/$taskService-service/target/$taskService-service-0.1.0-SNAPSHOT.jar"
 if(-not (Test-Path -LiteralPath $taskJar)){throw "Missing $taskService package; build it first"}
 $taskLatest=Get-ChildItem (Join-Path $taskRoot "v2/services/$taskService-service/src") -Recurse -File|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1
 if($taskLatest.LastWriteTimeUtc -gt (Get-Item $taskJar).LastWriteTimeUtc){throw "Stale $taskService package; verify/build changed source first"}
}
$taskAuthJar=Join-Path $taskRoot 'backend/identity-service/target/identity-service-1.0.0-SNAPSHOT.jar'
if(-not (Test-Path -LiteralPath $taskAuthJar)){throw 'Missing legacy Identity password-auth package'}
if(-not (Test-Path (Join-Path $taskRoot 'v2/apps/web-shell/node_modules/vite/bin/vite.js'))){throw 'Install locked web dependencies with npm ci first'}
$taskState=@{workspace=$taskRoot;demoRoot=$taskDemo;status='STARTING';ports=$taskConfig.ports;url="http://127.0.0.1:$($taskConfig.ports.web)";processes=@();startedAt=[DateTimeOffset]::UtcNow.ToString('o')};Save-State
try{
 if(-not (Test-Path -LiteralPath (Join-Path $taskDemo 'data/PG_VERSION'))){
  $taskPasswordFile=Join-Path $taskDemo 'init-password';$taskConfig.databasePassword|Set-Content $taskPasswordFile -NoNewline
  & (Join-Path $PostgresBin 'initdb.exe') '-D' (Join-Path $taskDemo 'data') '-U' 'postgres' '-A' 'scram-sha-256' "--pwfile=$taskPasswordFile" '--encoding=UTF8' '--locale=C' *> (Join-Path $taskDemo 'initdb.log')
  if($LASTEXITCODE -ne 0){throw 'Local PostgreSQL init failed; inspect initdb.log'}
  Remove-Item -LiteralPath $taskPasswordFile
 }
 PgCtl start
 if(-not $taskConfig.bootstrapped){
  $taskSql=@()
  foreach($taskService in $taskServices){$taskRoleService=if($taskService -eq 'identity'){'iam'}else{$taskService};$taskInheritance=if($taskService -in @('encounter','medical','billing')){'INHERIT'}else{'NOINHERIT'};$taskSql+="CREATE DATABASE clinic_v2_local_$taskService; CREATE ROLE local_${taskService}_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$($taskConfig.databasePassword)'; CREATE ROLE clinic_v2_${taskRoleService}_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE $taskInheritance; GRANT clinic_v2_${taskRoleService}_runtime TO local_${taskService}_runtime;"}
  $taskSql+="CREATE DATABASE clinic_v2_local_auth; CREATE ROLE local_auth_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '$($taskConfig.databasePassword)';"
  Sql postgres ($taskSql -join [Environment]::NewLine)
  Sql clinic_v2_local_auth 'CREATE SCHEMA identity AUTHORIZATION postgres; GRANT USAGE ON SCHEMA identity TO local_auth_runtime; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO local_auth_runtime; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA identity GRANT USAGE,SELECT ON SEQUENCES TO local_auth_runtime;'
  $taskConfig.bootstrapped=$true;Save-Config
 }
 $taskCommon=Peer-Environment
 $taskAuthEnv=@{SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$($taskConfig.databasePort)/clinic_v2_local_auth";SPRING_DATASOURCE_USERNAME='local_auth_runtime';SPRING_DATASOURCE_PASSWORD=$taskConfig.databasePassword;SPRING_FLYWAY_ENABLED='true';SPRING_FLYWAY_USER='postgres';SPRING_FLYWAY_PASSWORD=$taskConfig.databasePassword;SPRING_FLYWAY_DEFAULT_SCHEMA='identity';SPRING_FLYWAY_SCHEMAS='identity';SERVER_PORT="$($taskConfig.ports.auth)";SERVER_ADDRESS='127.0.0.1';APP_SECURITY_JWT_SECRET=$taskConfig.userSecret;SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'}
 Start-Owned auth (Get-Command java.exe).Source @('-Xmx256m','-jar',('"'+$taskAuthJar+'"')) $taskAuthEnv
 foreach($taskService in $taskServices){
  $taskEnv=$taskCommon.Clone();$taskPrefix=if($taskService -eq 'identity'){'IAM'}else{$taskService.ToUpperInvariant()}
  $taskEnv["${taskPrefix}_V2_DB_URL"]="jdbc:postgresql://127.0.0.1:$($taskConfig.databasePort)/clinic_v2_local_$taskService";$taskEnv["${taskPrefix}_V2_DB_USER"]="local_${taskService}_runtime";$taskEnv["${taskPrefix}_V2_DB_PASSWORD"]=$taskConfig.databasePassword;$taskEnv["${taskPrefix}_V2_PORT"]="$($taskConfig.ports[$taskService])";$taskEnv.PROJECTION_RELAY_ENABLED=if($taskService -in @('clinic','doctor','catalog')){'true'}else{'false'}
  $taskJar=Join-Path $taskRoot "v2/services/$taskService-service/target/$taskService-service-0.1.0-SNAPSHOT.jar"
  Start-Owned $taskService (Get-Command java.exe).Source @('-Xmx256m','-jar',('"'+$taskJar+'"')) $taskEnv
 }
 foreach($taskService in (@('auth')+$taskServices)){Wait-Healthy $taskService}
 if(-not $taskConfig.seeded){Seed-Demo}
 $taskWebEnv=@{CLINIC_V2_PROXY_PORTS=($taskConfig.ports|ConvertTo-Json -Compress);VITE_IDENTITY_V2_URL='/s1/identity';VITE_CLINIC_V2_URL='/s1/clinic';VITE_PUBLIC_CLINIC_ID=$taskConfig.clinic}
 $taskWebDirectory=Join-Path $taskRoot 'v2/apps/web-shell'
 Start-Owned web (Get-Command node.exe).Source @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$($taskConfig.ports.web)",'--strictPort') $taskWebEnv $taskWebDirectory
 for($taskTry=0;$taskTry -lt 60;$taskTry++){try{$null=Invoke-WebRequest $taskState.url -TimeoutSec 2;break}catch{if($taskTry -eq 59){throw 'Local web did not start'};Start-Sleep -Milliseconds 500}}
 $taskState.status='RUNNING';$taskState.clinic=$taskConfig.clinic;$taskState.branch=$taskConfig.branch;Save-State
 Write-Host "Local demo running: $($taskState.url) (13 backend services, PostgreSQL, Web)"
 Write-Host "Accounts: $taskConfigPath (local synthetic credentials; ignored by Git)"
}catch{
 $taskState.status='FAILED';$taskState.error=$_.Exception.Message;Save-State
 try{& (Join-Path $PSScriptRoot 'stop-local-demo.ps1')}catch{Write-Warning "Owned demo cleanup failed: $($_.Exception.Message)"}
 throw
}
