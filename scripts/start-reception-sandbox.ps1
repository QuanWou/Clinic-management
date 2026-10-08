param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskRuntime=Join-Path $taskRoot '.runtime/reception-e2e'
New-Item -ItemType Directory -Force -Path $taskRuntime|Out-Null
if(Test-Path (Join-Path $taskRuntime 'processes.json')){
 $taskPrevious=Get-Content (Join-Path $taskRuntime 'processes.json') -Raw|ConvertFrom-Json
 foreach($taskRecord in $taskPrevious.processes){$taskProcess=Get-Process -Id $taskRecord.id -ErrorAction SilentlyContinue;if($taskProcess -and $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$taskRecord.startedAt).UtcTicks){throw 'Existing reception sandbox is running; stop its recorded processes before creating another copy'}}
}
if(-not $SkipBuild){
 Push-Location $taskRoot
 try{
  python -c "from pathlib import Path; import shutil; shutil.copytree('backend',Path('.runtime/reception-build/backend'),dirs_exist_ok=True,ignore=shutil.ignore_patterns('target','.git'))"
  if($LASTEXITCODE){throw 'Isolated source copy failed'}
  & mvn.cmd -B -ntp -f '.runtime/reception-build/backend/pom.xml' '-Dmaven.test.skip=true' clean package *> (Join-Path $taskRuntime 'build.log')
  if($LASTEXITCODE){throw 'Isolated clean build failed; inspect reception-e2e/build.log'}
 }finally{Pop-Location}
}
$taskCfg=Get-Content (Join-Path $taskRoot '.runtime/main/config.json') -Raw|ConvertFrom-Json -AsHashtable
$taskCfg.databaseName='clinic_reception_e2e_'+[guid]::NewGuid().ToString('N').Substring(0,12)
$taskSource=Get-Content (Join-Path $taskRoot '.runtime/main/config.json') -Raw|ConvertFrom-Json -AsHashtable
$env:PGPASSWORD=$taskSource.databasePassword
$taskPg='C:\Program Files\PostgreSQL\17\bin'
& (Join-Path $taskPg 'pg_dump.exe') -h $taskSource.databaseHost -p $taskSource.databasePort -U $taskSource.databaseUser -d $taskSource.databaseName -Fc -f (Join-Path $taskRuntime 'snapshot.dump')
if($LASTEXITCODE){throw 'Read-only snapshot failed'}
& (Join-Path $taskPg 'createdb.exe') -h $taskSource.databaseHost -p $taskSource.databasePort -U $taskSource.databaseUser $taskCfg.databaseName
if($LASTEXITCODE){throw 'Create sandbox database failed'}
& (Join-Path $taskPg 'pg_restore.exe') --no-owner -f (Join-Path $taskRuntime 'snapshot.sql') (Join-Path $taskRuntime 'snapshot.dump')
if($LASTEXITCODE){throw 'Decode snapshot failed'}
# The installed client is 17; the source server is older and has no transaction_timeout setting.
$taskSql=[IO.File]::ReadAllText((Join-Path $taskRuntime 'snapshot.sql')).Replace('SET transaction_timeout = 0;','')
[IO.File]::WriteAllText((Join-Path $taskRuntime 'snapshot.sql'),$taskSql)
& (Join-Path $taskPg 'psql.exe') -X -h $taskSource.databaseHost -p $taskSource.databasePort -U $taskSource.databaseUser -d $taskCfg.databaseName -v ON_ERROR_STOP=1 -f (Join-Path $taskRuntime 'snapshot.sql') *> (Join-Path $taskRuntime 'restore.log')
if($LASTEXITCODE){throw 'Restore sandbox failed; source was not modified'}
Remove-Item Env:PGPASSWORD
$taskCfg.ports=@{identity=18201;doctor=18202;patient=18203;appointment=18204;billing=18205;gateway=18200;web=4276}
$taskCfg|ConvertTo-Json -Depth 16|Set-Content (Join-Path $taskRuntime 'config.json')
$taskStart=Get-Content (Join-Path $taskRoot 'scripts/start-core.ps1') -Raw
$taskStart=$taskStart.Replace("`$taskRoot=[IO.Path]::GetFullPath((Join-Path `$PSScriptRoot '..'))","`$taskRoot='$taskRoot'")
$taskStart=$taskStart.Replace("'.runtime/main'","'.runtime/reception-e2e'")
$taskStart=$taskStart.Replace("(Join-Path `$PSScriptRoot 'runtime-peer-environment.ps1')","(Join-Path `$taskRoot 'scripts/runtime-peer-environment.ps1')")
$taskStart=$taskStart.Replace('backend/','.runtime/reception-build/backend/')
$taskStart|Set-Content (Join-Path $taskRuntime 'start.ps1')
Write-Host 'Source database copied to isolated reception sandbox; production data preserved.'
& (Join-Path $taskRuntime 'start.ps1')
