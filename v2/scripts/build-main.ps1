param()
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Write-Host 'Package existing Identity password authentication'
& mvn.cmd -q -f (Join-Path $taskRoot 'backend/pom.xml') -pl identity-service -am -DskipTests install
if($LASTEXITCODE -ne 0){throw 'Identity password authentication package failed'}
& mvn.cmd -q -f (Join-Path $taskRoot 'backend/identity-service/pom.xml') -DskipTests package spring-boot:repackage
if($LASTEXITCODE -ne 0){throw 'Identity executable package failed'}
foreach($taskService in @('identity','clinic','doctor','catalog','audit','search','patient','appointment','notification','encounter','medical','billing')){
 Write-Host "Package V2: $taskService"
 & mvn.cmd -q -f (Join-Path $taskRoot "v2/services/$taskService-service/pom.xml") -DskipTests package
 if($LASTEXITCODE -ne 0){throw "V2 package failed: $taskService"}
}
Push-Location (Join-Path $taskRoot 'v2/apps/web-shell')
try{if(-not (Test-Path 'node_modules/vite/bin/vite.js')){& npm.cmd ci;if($LASTEXITCODE -ne 0){throw 'Web dependency install failed'}};& npm.cmd run build;if($LASTEXITCODE -ne 0){throw 'V2 web build failed'}}finally{Pop-Location}
