param([string]$ConfigPath='',[switch]$Seed)
$ErrorActionPreference='Stop'
if($Seed){throw 'Seed is not part of the five-core launcher; existing data is preserved.'}
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=Join-Path $taskRoot '.runtime/main'
if(-not $ConfigPath){$ConfigPath=Join-Path $taskRuntime 'config.json'}
$taskConfig=Get-Content -LiteralPath $ConfigPath -Raw|ConvertFrom-Json -AsHashtable
foreach($taskSecret in @('runtimePassword','peerSecret','userSecret')){if($taskConfig[$taskSecret] -notmatch '^[a-fA-F0-9]{64}$'){throw "Invalid private $taskSecret"}}
$taskTopology=Get-Content (Join-Path $taskRoot 'backend/core-topology.json') -Raw|ConvertFrom-Json -AsHashtable
$taskCoreOrder=@('identity','doctor','patient','appointment','billing')
$taskPorts=@{};$taskModulePorts=@{};$taskRoutes=@{}
foreach($taskCore in $taskCoreOrder){$taskPort=[int]$taskConfig.ports[$taskCore];if($taskPort -lt 1024 -or $taskPort -gt 65535){throw 'Invalid core port'};$taskPorts[$taskCore]=$taskPort;foreach($taskModule in $taskTopology[$taskCore]){$taskModulePorts[$taskModule]=$taskPort;$taskRoutes[$taskModule]="http://127.0.0.1:$taskPort/modules/$taskModule"}}
if(@($taskPorts.Values|Sort-Object -Unique).Count -ne 5){throw 'Core ports must be distinct'}
$taskPorts.gateway=if($taskConfig.ports.gateway){[int]$taskConfig.ports.gateway}else{8090}
$taskPorts.web=[int]$taskConfig.ports.web;$taskModulePorts.web=$taskPorts.web;$taskConfig.ports=$taskModulePorts
if(@($taskPorts.Values|Sort-Object -Unique).Count -ne 7 -or @($taskPorts.Values|Where-Object{$_ -lt 1024 -or $_ -gt 65535}).Count){throw 'Gateway, core and web ports must be valid and distinct'}
$taskStatePath=Join-Path $taskRuntime 'processes.json'
function Save-State{$taskState|ConvertTo-Json -Depth 12|Set-Content -LiteralPath $taskStatePath -Encoding utf8}
function Start-Owned([string]$name,[string]$file,[string[]]$arguments,[hashtable]$environment,[string]$directory=$taskRoot){
 $taskChild=Start-Process $file -ArgumentList $arguments -Environment $environment -WorkingDirectory $directory -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime "$name.log") -RedirectStandardError (Join-Path $taskRuntime "$name.stderr")
 $taskState.processes+=@{name=$name;id=$taskChild.Id;startedAt=$taskChild.StartTime.ToUniversalTime().ToString('o');executable=[IO.Path]::GetFullPath($file)};Save-State
}
function Wait-Healthy([string]$name){
 for($taskTry=0;$taskTry -lt 360;$taskTry++){
  try{if((Invoke-RestMethod "http://127.0.0.1:$($taskPorts[$name])/actuator/health" -TimeoutSec 2).status -eq 'UP'){Write-Host "Ready core: $name";return}}catch{}
  $taskRecord=@($taskState.processes|Where-Object name -eq $name)[0];if(-not(Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue)){throw "$name exited; inspect private runtime logs"};Start-Sleep -Milliseconds 500
 };throw "$name did not become healthy"
}
if(Test-Path -LiteralPath $taskStatePath){
 $taskOld=Get-Content $taskStatePath -Raw|ConvertFrom-Json -AsHashtable
 $taskLive=@($taskOld.processes|Where-Object{$taskP=Get-Process -Id $_.id -ErrorAction SilentlyContinue;$taskP -and $taskP.Path -eq $_.executable -and $taskP.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$_.startedAt).UtcTicks})
 if($taskLive.Count){
  if($taskOld.workspace -ne $taskRoot -or $taskOld.runtimeRoot -ne $taskRuntime -or $taskOld.layout -ne 'five-core-gateway' -or $taskOld.status -ne 'RUNNING' -or $taskLive.Count -ne 7){throw 'Partial or different runtime: use scripts/stop.ps1 before starting'}
  foreach($taskCore in $taskCoreOrder+@('gateway')){if((Invoke-RestMethod "http://127.0.0.1:$($taskPorts[$taskCore])/actuator/health" -TimeoutSec 3).status -ne 'UP'){throw 'Core or gateway runtime needs recovery'}}
  $null=Invoke-WebRequest "http://127.0.0.1:$($taskPorts.web)" -TimeoutSec 3;Write-Host 'Five core services are already running';exit 0
 }
}
foreach($taskPort in $taskPorts.Values){if(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){throw "Port $taskPort is occupied; replacement refused"}}
foreach($taskCore in $taskCoreOrder){if(-not(Test-Path (Join-Path $taskRoot "backend/$taskCore-service/target/$taskCore-service-1.0.0-SNAPSHOT.jar"))){throw 'Run scripts/build-main.ps1 first'}}
$taskGatewayJar=Join-Path $taskRoot 'backend/api-gateway/target/api-gateway-1.0.0-SNAPSHOT.jar'
if(-not(Test-Path -LiteralPath $taskGatewayJar)){throw 'Build api-gateway first'}
if(-not(Test-Path -LiteralPath $taskConfig.databaseBackup)){throw 'Existing database backup is missing'}
if($taskConfig.backupSha256 -and (Get-FileHash -LiteralPath $taskConfig.databaseBackup -Algorithm SHA256).Hash -ne $taskConfig.backupSha256){throw 'Database backup checksum differs'}
$taskServices=@($taskTopology.Values|ForEach-Object{$_}|Where-Object{$_ -ne 'auth'})
. (Join-Path $PSScriptRoot 'runtime-peer-environment.ps1')
$taskEnv=Peer-Environment
$taskEnv.SPRING_FLYWAY_USER=$taskConfig.databaseUser;$taskEnv.SPRING_FLYWAY_TABLE='flyway_v2_schema_history';$taskEnv.SPRING_FLYWAY_BASELINE_ON_MIGRATE='true';$taskEnv.SPRING_FLYWAY_BASELINE_VERSION='0'
$taskEnv.SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';$taskEnv.SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1'
$taskEnv.APP_SECURITY_JWT_SECRET=$taskConfig.userSecret;$taskEnv.APP_STAFF_IAM_URL=$taskRoutes.identity
$taskEnv.PROJECTION_RELAY_ENABLED='true'
foreach($taskModule in $taskModulePorts.Keys|Where-Object{$_ -ne 'web'}){
 $taskPrefix=if($taskModule -eq 'identity'){'IAM'}else{$taskModule.ToUpperInvariant()}
 $taskEnv["${taskPrefix}_DB_URL"]="jdbc:postgresql://$($taskConfig.databaseHost):$($taskConfig.databasePort)/$($taskConfig.databaseName)"
 $taskEnv["${taskPrefix}_DB_USER"]="main_v2_${taskModule}_runtime";$taskEnv["${taskPrefix}_DB_PASSWORD"]=$taskConfig.runtimePassword
}
if($taskConfig.payments){foreach($taskKey in $taskConfig.payments.Keys){$taskEnv[$taskKey]=[string]$taskConfig.payments[$taskKey]}}
$taskState=@{layout='five-core-gateway';workspace=$taskRoot;runtimeRoot=$taskRuntime;status='STARTING';ports=$taskPorts;modules=$taskTopology;url="http://127.0.0.1:$($taskPorts.web)";processes=@();startedAt=[DateTimeOffset]::UtcNow.ToString('o')};Save-State
try{
 foreach($taskCore in $taskCoreOrder){
  $taskCoreEnv=$taskEnv.Clone();$taskCoreEnv.CORE_PORT=[string]$taskPorts[$taskCore];$taskCoreEnv.CORE_BASE=Join-Path $taskRuntime "tomcat/$taskCore"
  $taskJar=Join-Path $taskRoot "backend/$taskCore-service/target/$taskCore-service-1.0.0-SNAPSHOT.jar"
  Start-Owned $taskCore (Get-Command java.exe).Source @('-Xmx512m','-jar',('"'+$taskJar+'"')) $taskCoreEnv
  Wait-Healthy $taskCore
 }
 $taskGatewayEnv=@{GATEWAY_PORT=[string]$taskPorts.gateway;GATEWAY_ROUTES=($taskRoutes|ConvertTo-Json -Compress)}
 Start-Owned gateway (Get-Command java.exe).Source @('-Xmx192m','-jar',('"'+$taskGatewayJar+'"')) $taskGatewayEnv
 Wait-Healthy gateway
 $taskWebEnv=@{CLINIC_GATEWAY_URL="http://127.0.0.1:$($taskPorts.gateway)";VITE_IDENTITY_URL='/s1/identity';VITE_CLINIC_URL='/s1/clinic';VITE_PUBLIC_CLINIC_ID=$taskConfig.clinic}
 Start-Owned web (Get-Command node.exe).Source @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',[string]$taskPorts.web,'--strictPort') $taskWebEnv (Join-Path $taskRoot 'frontend')
 for($taskTry=0;$taskTry -lt 60;$taskTry++){try{$null=Invoke-WebRequest $taskState.url -TimeoutSec 2;break}catch{if($taskTry -eq 59){throw 'Frontend failed to start'};Start-Sleep -Milliseconds 500}}
 $taskState.status='RUNNING';Save-State;Write-Host "Five cores ready: $($taskState.url)"
}catch{$taskState.status='FAILED';$taskState.error=$_.Exception.Message;Save-State;throw}
