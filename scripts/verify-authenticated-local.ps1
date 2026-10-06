param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin',[string]$VerifiedPackageSummary)
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& (Join-Path $PSScriptRoot 'verify-s2-local.ps1') -PostgresBin $PostgresBin -KeepSandbox -EvidenceDirectory (Join-Path $taskRoot '.runtime/verification/P05-S6/authenticated-verification') -CheckpointTask 'P05-S6-authenticated-operational-journey' -IncludeCare -IncludeMedical -IncludeBilling -IncludePortal -IncludeAftercare -IncludeFinancialNotification -IncludeSourceCharges -IncludeOwnerConfiguration -IncludeRealIdentity -VerifiedPackageSummary $VerifiedPackageSummary
