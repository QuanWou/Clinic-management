param([string]$EvidenceDirectory,[string]$OutputPath)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $EvidenceDirectory){$EvidenceDirectory=Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S6/authenticated-verification'}
if(-not $OutputPath){$OutputPath=Join-Path $taskRoot '.runtime/verification/P05-S6/operational-candidate-manifest.json'}
$taskOutput=[IO.Path]::GetFullPath($OutputPath)
if(-not $taskOutput.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar)){throw 'Candidate evidence output must stay in the worktree'}
$taskSummary=Get-Content -LiteralPath (Join-Path $EvidenceDirectory 'summary.json') -Raw|ConvertFrom-Json
if($taskSummary.status -ne 'PASS' -or $taskSummary.receptionFlow -ne 'PASS' -or $taskSummary.syntheticRestore -ne 'PASS' -or @($taskSummary.modules).Count -ne 12){throw 'The complete authenticated operational verification and restore must pass'}
$taskEvidence=@('summary.json','real-auth-summary.json','real-booking-summary.json','actual-public-registration.json','actual-public-booking.json','charge-recovery-summary.json','absence-lifecycle-summary.json','billing-flow-summary.json','restore-drill-summary.json','reception-operations-summary.json','clinical-access-summary.json','restored-applications-summary.json','operational-browser-summary.json','worklist-paging-summary.json')
$taskEvidenceHashes=@();foreach($taskFile in $taskEvidence){$taskAbsolute=Join-Path $EvidenceDirectory $taskFile;$taskResult=Get-Content -LiteralPath $taskAbsolute -Raw|ConvertFrom-Json;if((Get-Item -LiteralPath $taskAbsolute).LastWriteTimeUtc -lt ([DateTimeOffset]$taskSummary.startedAt).UtcDateTime){throw "Evidence predates verification: $taskFile"};if($taskResult.status -ne 'PASS'){throw "Evidence did not pass: $taskFile"};$taskEvidenceHashes+=@{path=[IO.Path]::GetRelativePath($taskRoot,$taskAbsolute).Replace('\','/');sha256=(Get-FileHash -LiteralPath $taskAbsolute).Hash}}
$taskBuilds=@();$taskMigrations=@();$taskTests=0
foreach($taskModule in $taskSummary.modules){
 if($taskModule.tests -lt 1 -or $taskModule.failures -ne 0 -or $taskModule.errors -ne 0 -or $taskModule.skipped -ne 0 -or $taskModule.package -ne 'PASS'){throw "Module verification failed: $($taskModule.service)"}
 $taskServiceRoot=Join-Path $taskRoot "backend/$($taskModule.service)-service"
 $taskJar=Get-Item -LiteralPath (Join-Path $taskServiceRoot "target/$($taskModule.service)-service-0.1.0-SNAPSHOT.jar")
 if((Get-FileHash -LiteralPath $taskJar.FullName).Hash -ne $taskModule.jarSha256){throw "Package hash changed: $($taskModule.service)"}
 $taskNewest=@(Get-ChildItem -LiteralPath (Join-Path $taskServiceRoot 'src') -Recurse -File;Get-Item -LiteralPath (Join-Path $taskServiceRoot 'pom.xml'))|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1
 if($taskNewest.LastWriteTimeUtc -gt $taskJar.LastWriteTimeUtc){throw "Source changed after tested build: $($taskModule.service)"}
 $taskTests+=[int]$taskModule.tests
 $taskBuilds+=@{service=$taskModule.service;version='0.1.0-SNAPSHOT';jarSha256=$taskModule.jarSha256;selectedTests=$taskModule.tests;testMode=$(if($taskModule.verification){$taskModule.verification}else{'RUN_WITH_FRESH_POSTGRES_ZERO_SKIPS'})}
 foreach($taskMigration in Get-ChildItem -LiteralPath (Join-Path $taskServiceRoot 'src/main/resources/db/migration') -Filter '*.sql'){$taskMigrations+=@{service=$taskModule.service;file=$taskMigration.Name;sha256=(Get-FileHash -LiteralPath $taskMigration.FullName).Hash;rollback='FORWARD_REPAIR_REQUIRED_NO_AUTOMATIC_DOWN_MIGRATION'}}
}
if(Get-NetTCPConnection -State Listen -LocalPort $taskSummary.port -ErrorAction SilentlyContinue){throw 'Owned verification database has not stopped'}
$taskSourceManifest=Join-Path $EvidenceDirectory 'source-manifest.json'
& (Join-Path $PSScriptRoot 'write-s2-source-manifest.ps1') -OutputPath $taskSourceManifest
$taskLegacyJar=Join-Path $taskRoot 'backend/auth-service/target/identity-service-1.0.0-SNAPSHOT.jar'
$taskLegacyBuild=@{service='unchanged-legacy-identity';version='1.0.0-SNAPSHOT';jarSha256=(Get-FileHash -LiteralPath $taskLegacyJar).Hash;verification='ACTUAL_SIGNUP_LOGIN_AND_RESTORED_APPLICATION_STARTUP'}
$taskFrontend=Get-Content -LiteralPath (Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S6/frontend-verification.json') -Raw|ConvertFrom-Json
if($taskFrontend.status -ne 'PASS' -or $taskFrontend.vitestTests -lt 1 -or $taskFrontend.defaultBrowserTests -lt 1){throw 'Frontend verification metadata missing'}
foreach($taskAsset in $taskFrontend.assets){if((Get-FileHash -LiteralPath (Join-Path $taskRoot $taskAsset.path)).Hash -ne $taskAsset.sha256){throw 'Frontend build changed after verification'}}
$taskWebBuilt=Get-Item -LiteralPath (Join-Path $taskRoot 'frontend/dist/index.html');$taskWebNewest=Get-ChildItem -LiteralPath (Join-Path $taskRoot 'frontend/src') -Recurse -File|Sort-Object LastWriteTimeUtc -Descending|Select-Object -First 1
if($taskWebNewest.LastWriteTimeUtc -gt $taskWebBuilt.LastWriteTimeUtc -or (Get-FileHash -LiteralPath (Join-Path $taskRoot 'frontend/package-lock.json')).Hash -ne $taskFrontend.lockfileSha256){throw 'Frontend source/dependencies changed after verification'}
$taskGitBranch=(& git -C $taskRoot branch --show-current|Out-String).Trim();if($LASTEXITCODE -ne 0){throw 'Cannot resolve worktree branch'}
$taskGitHead=(& git -C $taskRoot rev-parse HEAD|Out-String).Trim();if($LASTEXITCODE -ne 0){throw 'Cannot resolve base commit'}
[ordered]@{kind='verified-operational-candidate-not-production-release';capturedAt=[DateTimeOffset]::UtcNow.ToString('o');branch=$taskGitBranch;baseCommit=$taskGitHead;workingTree='UNCOMMITTED';scope='NO_DEPOSIT_UNSIGNED_CARE_ONSITE_COLLECTION_OWN_PORTAL';disabled=@('CLINICAL_SIGNATURE','CLINICAL_DOCUMENT_RELEASE','ONLINE_COLLECTION','AUTOMATIC_REFUND','GUARDIAN_ACCESS');decision='NO_PRODUCTION_RELEASE_APPROVAL';approvalGates='A1-A6_NOT_ACCEPTED';selectedBackendTests=$taskTests;builds=$taskBuilds;legacyIdentity=$taskLegacyBuild;frontend=@{vitestTests=$taskFrontend.vitestTests;defaultBrowserTests=$taskFrontend.defaultBrowserTests;metadataSha256=(Get-FileHash -LiteralPath (Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S6/frontend-verification.json')).Hash};migrations=$taskMigrations;evidence=$taskEvidenceHashes;sourceManifest=@{path=[IO.Path]::GetRelativePath($taskRoot,$taskSourceManifest).Replace('\','/');sha256=(Get-FileHash -LiteralPath $taskSourceManifest).Hash};databaseStopped=$true;sandbox='RETAINED_BY_CONFIGURATION';productionMigration='NOT_EXECUTED';applicationRecovery='RESTORED_APPLICATIONS_VERIFIED';applicationRollback='NOT_EXECUTED';clinicalFinancePrivacyReview='PENDING'}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $taskOutput -Encoding utf8


