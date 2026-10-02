param([string]$ConfigPath='',[switch]$Seed)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskRuntime=Join-Path $taskRoot 'v2/.runtime/main'
if(-not $ConfigPath){$ConfigPath=Join-Path $taskRuntime 'config.json'}
if(-not (Test-Path -LiteralPath $ConfigPath)){throw 'Configure v2/.runtime/main/config.json with the existing main database connection first. See v2/MAIN.md.'}
$taskConfig=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json -AsHashtable
foreach($taskSecret in @('runtimePassword','peerSecret','userSecret')){if($taskConfig[$taskSecret] -notmatch '^[a-fA-F0-9]{64}$'){throw "Configure a distinct 32-byte hexadecimal $taskSecret in the private runtime file"}}
$taskStatePath=Join-Path $taskRuntime 'processes.json'
$taskServices=@('identity','search','audit','notification','patient','clinic','doctor','catalog','billing','medical','encounter','appointment')
New-Item -ItemType Directory -Force -Path $taskRuntime|Out-Null
. (Join-Path $PSScriptRoot 'runtime-peer-environment.ps1')
function Save-State {$taskState|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $taskStatePath -Encoding utf8}
function Main-Sql([string]$sql){
 $taskSql=Join-Path $taskRuntime 'bootstrap.sql';$sql|Set-Content -LiteralPath $taskSql -Encoding utf8
 $taskPreviousPassword=$env:PGPASSWORD;$env:PGPASSWORD=$taskConfig.databasePassword
 try{& (Join-Path $taskConfig.postgresBin 'psql.exe') -X -w -h $taskConfig.databaseHost -p $taskConfig.databasePort -U $taskConfig.databaseUser -d $taskConfig.databaseName -v ON_ERROR_STOP=1 -f $taskSql *> (Join-Path $taskRuntime 'bootstrap.log');if($LASTEXITCODE -ne 0){throw 'Main additive bootstrap failed; inspect the private runtime log'}}finally{if($null -eq $taskPreviousPassword){Remove-Item Env:PGPASSWORD}else{$env:PGPASSWORD=$taskPreviousPassword};Remove-Item -LiteralPath $taskSql}
}
function Start-Owned([string]$name,[string]$file,[string[]]$arguments,[hashtable]$environment,[string]$directory=$taskRoot){
 $taskChild=Start-Process $file -ArgumentList $arguments -Environment $environment -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime "$name.log") -RedirectStandardError (Join-Path $taskRuntime "$name.stderr")
 $taskState.processes+=@{name=$name;id=$taskChild.Id;startedAt=$taskChild.StartTime.ToUniversalTime().ToString('o');executable=[IO.Path]::GetFullPath($file)};Save-State
}
function Wait-Healthy([string]$service){
 for($taskTry=0;$taskTry -lt 300;$taskTry++){
  try{if((Invoke-RestMethod "http://127.0.0.1:$($taskConfig.ports[$service])/actuator/health" -TimeoutSec 2).status -eq 'UP'){Write-Host "Ready: $service";return}}catch{}
  $taskRecord=@($taskState.processes|Where-Object name -eq $service)[0];if(-not (Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue)){throw "$service exited; inspect v2/.runtime/main/$service.log"}
  Start-Sleep -Milliseconds 500
 }
 throw "$service did not become healthy"
}
function Start-Web {
 $taskWebConfig=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json -AsHashtable
 if(-not $taskWebConfig.clinic){throw 'Bind the main website to an existing published clinic before starting web'}
 if(Get-NetTCPConnection -State Listen -LocalPort $taskWebConfig.ports.web -ErrorAction SilentlyContinue){throw 'Web port is occupied; refused replacement'}
 $taskWebEnv=@{CLINIC_V2_PROXY_PORTS=($taskWebConfig.ports|ConvertTo-Json -Compress);VITE_IDENTITY_V2_URL='/s1/identity';VITE_CLINIC_V2_URL='/s1/clinic';VITE_PUBLIC_CLINIC_ID=$taskWebConfig.clinic}
 Start-Owned web (Get-Command node.exe).Source @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',"$($taskWebConfig.ports.web)",'--strictPort') $taskWebEnv (Join-Path $taskRoot 'v2/apps/web-shell')
 for($taskTry=0;$taskTry -lt 60;$taskTry++){try{$null=Invoke-WebRequest $taskState.url -TimeoutSec 2;break}catch{if($taskTry -eq 59){throw 'Main web did not start'};Start-Sleep -Milliseconds 500}}
 $taskState.status='RUNNING';$taskState.Remove('error');$taskState.clinic=$taskWebConfig.clinic;$taskState.branch=$taskWebConfig.branch;Save-State
}
if(Test-Path -LiteralPath $taskStatePath){
 $taskPrevious=Get-Content -LiteralPath $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
 $taskLive=@($taskPrevious.processes|Where-Object {$taskProcess=Get-Process -Id $_.id -ErrorAction SilentlyContinue;$taskProcess -and $taskProcess.Path -eq $_.executable -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$_.startedAt).UtcTicks})
 if($taskLive.Count){
  if($taskPrevious.workspace -ne $taskRoot -or $taskPrevious.runtimeRoot -ne $taskRuntime){throw 'Main runtime ownership differs from this checkout'}
  if($taskPrevious.status -ne 'RUNNING' -and ($taskLive.Count -ne 13 -or @($taskLive|Where-Object name -eq 'web').Count)){throw 'Partial backend runtime exists; run stop-main.ps1 first'}
  foreach($taskName in @('auth')+$taskServices){if((Invoke-RestMethod "http://127.0.0.1:$($taskConfig.ports[$taskName])/actuator/health" -TimeoutSec 3).status -ne 'UP'){throw 'Main runtime needs recovery'}}
  $taskState=$taskPrevious
  if($Seed){& node.exe (Join-Path $PSScriptRoot 'seed-operating-clinic.mjs') $ConfigPath;if($LASTEXITCODE -ne 0){throw 'Operating clinic seed failed'}}
  if(-not @($taskLive|Where-Object name -eq 'web').Count){Start-Web}else{$null=Invoke-WebRequest $taskState.url -TimeoutSec 3}
  Write-Host "Main is running: $($taskPrevious.url)";exit 0
 }
}
foreach($taskPort in $taskConfig.ports.Values){if(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){throw "Port $taskPort belongs to an existing process; refused replacement"}}
foreach($taskService in $taskServices){if(-not (Test-Path (Join-Path $taskRoot "v2/services/$taskService-service/target/$taskService-service-0.1.0-SNAPSHOT.jar"))){throw 'Build V2 first using build-main.ps1'}}
$taskAuthJar=Join-Path $taskRoot 'backend/identity-service/target/identity-service-1.0.0-SNAPSHOT.jar'
if(-not (Test-Path $taskAuthJar)){throw 'Build the existing Identity password-auth package first'}
if(-not (Test-Path (Join-Path $taskRoot 'v2/apps/web-shell/node_modules/vite/bin/vite.js'))){throw 'Install the locked V2 web dependencies first'}
$taskBackup=if($taskConfig.databaseBackup){$taskConfig.databaseBackup}else{Join-Path $taskRuntime 'clinic_db.before-v2-20261002.dump'}
if(-not (Test-Path -LiteralPath $taskBackup) -or (Get-Item -LiteralPath $taskBackup).Length -eq 0){throw 'Back up the existing main database before first V2 migration'}
if($taskConfig.backupSha256 -and (Get-FileHash -LiteralPath $taskBackup -Algorithm SHA256).Hash -ne $taskConfig.backupSha256){throw 'Main database backup checksum changed; verify the backup before migration'}
Main-Sql "SELECT current_database();"
$taskRoleSql=@()
foreach($taskService in @('auth')+$taskServices){
 $taskRole="main_v2_${taskService}_runtime"
 $taskRoleSql+="DO `$`$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='$taskRole') THEN CREATE ROLE $taskRole LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE INHERIT PASSWORD '$($taskConfig.runtimePassword)'; END IF; END `$`$;"
 if($taskService -ne 'auth'){
  $taskRoleService=if($taskService -eq 'identity'){'iam'}else{$taskService};$taskGroup="clinic_v2_${taskRoleService}_runtime";$taskInheritance=if($taskService -in @('encounter','medical','billing')){'INHERIT'}else{'NOINHERIT'}
  $taskRoleSql+="DO `$`$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='$taskGroup') THEN CREATE ROLE $taskGroup NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE $taskInheritance; END IF; END `$`$; GRANT $taskGroup TO $taskRole;"
 }
}
$taskRoleSql+='GRANT USAGE ON SCHEMA identity TO main_v2_auth_runtime; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA identity TO main_v2_auth_runtime; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA identity TO main_v2_auth_runtime;'
Main-Sql ($taskRoleSql -join [Environment]::NewLine)
$taskState=@{workspace=$taskRoot;runtimeRoot=$taskRuntime;status='STARTING';databaseName=$taskConfig.databaseName;databaseHost=$taskConfig.databaseHost;databasePort=$taskConfig.databasePort;url="http://127.0.0.1:$($taskConfig.ports.web)";ports=$taskConfig.ports;processes=@();startedAt=[DateTimeOffset]::UtcNow.ToString('o')};Save-State
$taskJdbc="jdbc:postgresql://$($taskConfig.databaseHost):$($taskConfig.databasePort)/$($taskConfig.databaseName)"
try{
 $taskCommon=Peer-Environment;$taskCommon.SPRING_FLYWAY_USER=$taskConfig.databaseUser;$taskCommon.SPRING_FLYWAY_TABLE='flyway_v2_schema_history';$taskCommon.SPRING_FLYWAY_BASELINE_ON_MIGRATE='true';$taskCommon.SPRING_FLYWAY_BASELINE_VERSION='0'
 $taskAuthEnv=@{SPRING_DATASOURCE_URL=$taskJdbc;SPRING_DATASOURCE_USERNAME='main_v2_auth_runtime';SPRING_DATASOURCE_PASSWORD=$taskConfig.runtimePassword;SPRING_FLYWAY_ENABLED='false';SERVER_PORT="$($taskConfig.ports.auth)";SERVER_ADDRESS='127.0.0.1';APP_SECURITY_JWT_SECRET=$taskConfig.userSecret;SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'}
 Start-Owned auth (Get-Command java.exe).Source @('-Xmx256m','-jar',('"'+$taskAuthJar+'"')) $taskAuthEnv
 Wait-Healthy auth
 foreach($taskService in $taskServices){
  $taskEnv=$taskCommon.Clone();$taskPrefix=if($taskService -eq 'identity'){'IAM'}else{$taskService.ToUpperInvariant()}
  $taskEnv["${taskPrefix}_V2_DB_URL"]=$taskJdbc;$taskEnv["${taskPrefix}_V2_DB_USER"]="main_v2_${taskService}_runtime";$taskEnv["${taskPrefix}_V2_DB_PASSWORD"]=$taskConfig.runtimePassword;$taskEnv["${taskPrefix}_V2_PORT"]="$($taskConfig.ports[$taskService])";$taskEnv.PROJECTION_RELAY_ENABLED=if($taskService -in @('clinic','doctor','catalog')){'true'}else{'false'}
  $taskJar=Join-Path $taskRoot "v2/services/$taskService-service/target/$taskService-service-0.1.0-SNAPSHOT.jar"
  Start-Owned $taskService (Get-Command java.exe).Source @('-Xmx256m','-jar',('"'+$taskJar+'"')) $taskEnv
  Wait-Healthy $taskService
 }
 if($Seed){& node.exe (Join-Path $PSScriptRoot 'seed-operating-clinic.mjs') $ConfigPath;if($LASTEXITCODE -ne 0){throw 'Operating clinic seed failed'}}
 Start-Web
 Write-Host "Main ready: $($taskState.url), database $($taskConfig.databaseName), clinic $($taskState.clinic)"
}catch{$taskState.status='FAILED';$taskState.error=$_.Exception.Message;Save-State;throw}
