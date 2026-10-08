param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=Join-Path $taskRoot '.runtime/realtime-e2e'
New-Item -ItemType Directory -Force -Path $taskRuntime|Out-Null
if(Test-Path (Join-Path $taskRuntime 'processes.json')){
 $taskPrevious=Get-Content (Join-Path $taskRuntime 'processes.json') -Raw|ConvertFrom-Json
 foreach($taskRecord in $taskPrevious.processes){$taskProcess=Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue;if($taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$taskRecord.startedAt).UtcTicks){throw 'Existing realtime sandbox is running; stop its recorded processes before creating another copy'}}
}
if(-not $SkipBuild){
 Push-Location $taskRoot
 try{
  node -e "require('fs').cpSync('backend','.runtime/realtime-build/backend',{recursive:true,filter:p=>!p.split(/[\\/]/).some(s=>s==='target'||s==='.git')})"
  if($LASTEXITCODE){throw 'Isolated source copy failed'}
  & mvn.cmd -B -ntp -f '.runtime/realtime-build/backend/pom.xml' '-Dmaven.test.skip=true' clean package *> (Join-Path $taskRuntime 'build.log')
  if($LASTEXITCODE){throw 'Isolated clean build failed; inspect realtime-e2e/build.log'}
 }finally{Pop-Location}
}
# Restore the last verified frozen project backup into an independent PostgreSQL cluster.
# No source database writes, password changes, or production process restarts.
$taskCfg=Get-Content (Join-Path $taskRoot '.runtime/main/config.json') -Raw|ConvertFrom-Json -AsHashtable
$taskBackup=$taskCfg.databaseBackup
if(-not(Test-Path -LiteralPath $taskBackup)){throw 'Verified source snapshot is missing'}
if($taskCfg.backupSha256 -and (Get-FileHash -LiteralPath $taskBackup -Algorithm SHA256).Hash -ne $taskCfg.backupSha256){throw 'Source snapshot checksum differs'}
$taskPg='C:\Program Files\PostgreSQL\17\bin'
$taskCluster=Join-Path $taskRuntime 'postgres'
if(Test-Path -LiteralPath $taskCluster){throw 'Existing isolated cluster retained; choose a fresh runtime or reuse its config'}
$taskPassword=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N')
$taskPasswordFile=Join-Path $taskRuntime 'postgres-password'
[IO.File]::WriteAllText($taskPasswordFile,$taskPassword)
& (Join-Path $taskPg 'initdb.exe') -D $taskCluster -U postgres -A scram-sha-256 --pwfile=$taskPasswordFile --encoding=UTF8 --locale=C *> (Join-Path $taskRuntime 'initdb.log')
if($LASTEXITCODE){throw 'Isolated PostgreSQL initialization failed'}
Remove-Item -LiteralPath $taskPasswordFile
$taskListener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$taskListener.Start();$taskDbPort=$taskListener.LocalEndpoint.Port;$taskListener.Stop()
$taskProcess=Start-Process -FilePath (Join-Path $taskPg 'pg_ctl.exe') -ArgumentList @('-D',('"'+$taskCluster+'"'),'-l',('"'+(Join-Path $taskRuntime 'postgres.log')+'"'),'-o',('"-p '+$taskDbPort+' -h 127.0.0.1"'),'-w','start') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskRuntime 'postgres-start.log') -RedirectStandardError (Join-Path $taskRuntime 'postgres-start.stderr')
$taskProcess.WaitForExit();if($taskProcess.ExitCode){throw 'Isolated PostgreSQL start failed'}
$taskCfg.databaseHost='127.0.0.1';$taskCfg.databasePort=$taskDbPort;$taskCfg.databaseName='clinic_realtime_e2e_'+[guid]::NewGuid().ToString('N').Substring(0,12)
$taskCfg.databasePassword=$taskPassword;$taskCfg.databaseUser='postgres';$taskCfg.snapshotSource=$taskBackup;$taskCfg.snapshotSha256=(Get-FileHash -LiteralPath $taskBackup -Algorithm SHA256).Hash
$env:PGPASSWORD=$taskPassword
& (Join-Path $taskPg 'createdb.exe') -w -h 127.0.0.1 -p $taskDbPort -U postgres $taskCfg.databaseName
if($LASTEXITCODE){throw 'Create sandbox database failed'}
& (Join-Path $taskPg 'pg_restore.exe') --no-owner -f (Join-Path $taskRuntime 'snapshot.sql') $taskBackup
if($LASTEXITCODE){throw 'Decode source snapshot failed'}
$taskSql=[IO.File]::ReadAllText((Join-Path $taskRuntime 'snapshot.sql')).Replace('SET transaction_timeout = 0;','')
[IO.File]::WriteAllText((Join-Path $taskRuntime 'snapshot.sql'),$taskSql)
$taskRoles=[Collections.Generic.HashSet[string]]::new()
foreach($taskMatch in [regex]::Matches($taskSql,'(?m)^(?:GRANT .+ TO|REVOKE .+ FROM) ([^;]+);')){foreach($taskRole in $taskMatch.Groups[1].Value.Split(',')){$taskName=$taskRole.Trim().Trim('"');if($taskName -match '^[a-z][a-z0-9_]*$' -and $taskName -notin @('postgres','public')){$null=$taskRoles.Add($taskName)}}}
$taskTopology=Get-Content (Join-Path $taskRoot 'backend/core-topology.json') -Raw|ConvertFrom-Json -AsHashtable
$taskRoleSql=''
foreach($taskRole in $taskRoles){$taskRoleSql+="CREATE ROLE $taskRole NOLOGIN NOSUPERUSER NOBYPASSRLS;
"}
foreach($taskModule in @($taskTopology.Values|ForEach-Object{$_})){
 $taskRole='main_v2_'+$taskModule+'_runtime';if(-not $taskRoles.Contains($taskRole)){$taskRoleSql+="CREATE ROLE $taskRole NOLOGIN NOSUPERUSER NOBYPASSRLS;
"}
 $taskRoleSql+="ALTER ROLE $taskRole LOGIN INHERIT PASSWORD '$($taskCfg.runtimePassword)';
"
 $taskGroup='clinic_v2_'+$(if($taskModule -eq 'identity'){'iam'}else{$taskModule})+'_runtime'
 if($taskRoles.Contains($taskGroup)){$taskRoleSql+="GRANT $taskGroup TO $taskRole;
"}
}
[IO.File]::WriteAllText((Join-Path $taskRuntime 'roles.sql'),$taskRoleSql)
& (Join-Path $taskPg 'psql.exe') -w -X -h 127.0.0.1 -p $taskDbPort -U postgres -d $taskCfg.databaseName -v ON_ERROR_STOP=1 -f (Join-Path $taskRuntime 'roles.sql') *> (Join-Path $taskRuntime 'roles.log')
if($LASTEXITCODE){throw 'Isolated runtime role creation failed'}
Remove-Item -LiteralPath (Join-Path $taskRuntime 'roles.sql')
& (Join-Path $taskPg 'psql.exe') -w -X -h 127.0.0.1 -p $taskDbPort -U postgres -d $taskCfg.databaseName -v ON_ERROR_STOP=1 -f (Join-Path $taskRuntime 'snapshot.sql') *> (Join-Path $taskRuntime 'restore.log')
if($LASTEXITCODE){throw 'Restore sandbox failed; source was not modified'}
Remove-Item Env:PGPASSWORD
$taskCfg.ports=@{identity=18301;doctor=18302;patient=18303;appointment=18304;billing=18305;gateway=18300;web=4376}
if(-not $taskCfg.payments){$taskCfg.payments=@{}}
# Synthetic provider credentials and bank display data; outbound provider calls cannot
# reach a real payment service from this disposable fixture.
$taskCfg.payments.CLINIC_PAYMENTS_ENABLED='true';$taskCfg.payments.CLINIC_PAYMENTS_CLINIC_ID=$taskCfg.clinic
$taskCfg.payments.CLINIC_PAYMENTS_PUBLIC_URL='http://127.0.0.1:4376'
$taskCfg.payments.PAYOS_CLIENT_ID='disposable-realtime';$taskCfg.payments.PAYOS_API_KEY=[guid]::NewGuid().ToString('N')
$taskCfg.payments.PAYOS_CHECKSUM_KEY=[guid]::NewGuid().ToString('N');$taskCfg.payments.PAYOS_BASE_URL='http://127.0.0.1:1'
$taskCfg.payments.BANK_TRANSFER_BANK_CODE='970436';$taskCfg.payments.BANK_TRANSFER_BANK_NAME='Disposable test bank'
$taskCfg.payments.BANK_TRANSFER_ACCOUNT_NUMBER='0000000000';$taskCfg.payments.BANK_TRANSFER_ACCOUNT_NAME='QA ONLY'
$taskCfg|ConvertTo-Json -Depth 16|Set-Content (Join-Path $taskRuntime 'config.json')
$taskStart=Get-Content (Join-Path $taskRoot 'scripts/start-core.ps1') -Raw
$taskStart=$taskStart.Replace("`$taskRoot=[IO.Path]::GetFullPath((Join-Path `$PSScriptRoot '..'))","`$taskRoot='$taskRoot'")
$taskStart=$taskStart.Replace("'.runtime/main'","'.runtime/realtime-e2e'")
$taskStart=$taskStart.Replace("(Join-Path `$PSScriptRoot 'runtime-peer-environment.ps1')","(Join-Path `$taskRoot 'scripts/runtime-peer-environment.ps1')")
$taskStart=$taskStart.Replace('backend/','.runtime/realtime-build/backend/')
$taskStart|Set-Content (Join-Path $taskRuntime 'start.ps1')
Write-Host 'Verified snapshot restored to isolated realtime sandbox; source data preserved.'
& (Join-Path $taskRuntime 'start.ps1')

