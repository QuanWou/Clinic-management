param()
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& mvn.cmd -q -f (Join-Path $taskRoot 'backend/pom.xml') -DskipTests clean package
if($LASTEXITCODE -ne 0){throw 'Five core build failed'}
Push-Location (Join-Path $taskRoot 'frontend')
try{if(-not (Test-Path 'node_modules/vite/bin/vite.js')){& npm.cmd ci;if($LASTEXITCODE -ne 0){throw 'Web dependency install failed'}};& npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'Frontend build failed'}}finally{Pop-Location}
exit 0
