param([string]$OutputPath)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if(-not $OutputPath){$OutputPath=Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S2/verification/source-manifest.json'}
$taskFiles=@()
Push-Location $taskRoot
try{
 $taskFiles=@(& rg --files v2/services v2/apps/web-shell v2/scripts v2/contracts)
 if($LASTEXITCODE -ne 0){throw 'Cannot enumerate source files'}
 $taskFiles+=@('docs/audits/clinic-v2/P05-S2/S2_Gap_Review.md','docs/audits/clinic-v2/P05-S2/S2_Implementation_Evidence.md','docs/clinic-v2/05_Implementation_Delivery/03_Implementation_Backlog.md','docs/clinic-v2/05_Implementation_Delivery/backlog.csv','docs/clinic-v2/05_Implementation_Delivery/09_Traceability_and_Signoff.md')
 $taskFiles+=@('docs/audits/clinic-v2/P05-S3/S3_Gap_Review.md','docs/audits/clinic-v2/P05-S3/S3_Implementation_Evidence.md','docs/audits/clinic-v2/P05-S3/Medical_Implementation_Evidence.md','docs/audits/clinic-v2/P05-S3/Completion_Implementation_Evidence.md','docs/audits/clinic-v2/Delivery_Scope_No_Deposit_Unsigned.md')
 $taskFiles+=@('v2/OPERATIONS.md','docs/audits/clinic-v2/P05-S5/S5_Gap_Review.md','docs/audits/clinic-v2/P05-S6/Operational_Baseline_Completion_Evidence.md','docs/audits/clinic-v2/P05-S6/frontend-verification.json','docs/audits/clinic-v2/P05-S6/Scheduled_0300_Functional_Laptop_Audit.md','docs/audits/clinic-v2/P05-S6/scheduled-functional-laptop-audit-summary.json')
 $taskEntries=@($taskFiles | Sort-Object -Unique | Where-Object {$_ -match '\.(java|sql|yml|yaml|xml|ts|tsx|css|json|ps1|md|csv)$' -and $_ -notmatch '(^|[\\/])(target|node_modules|dist|test-results|\.sandbox)([\\/]|$)' -and $_ -notmatch 'tsbuildinfo$'} | ForEach-Object {
  $taskAbsolute=Join-Path $taskRoot $_
  if(Test-Path -LiteralPath $taskAbsolute -PathType Leaf){[ordered]@{path=$_.Replace('\','/');sha256=(Get-FileHash -LiteralPath $taskAbsolute -Algorithm SHA256).Hash}}
 })
 [ordered]@{capturedAt=[DateTimeOffset]::UtcNow.ToString('o');kind='post-verification-source-checkpoint';files=$taskEntries} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $OutputPath -Encoding utf8
}finally{Pop-Location}

