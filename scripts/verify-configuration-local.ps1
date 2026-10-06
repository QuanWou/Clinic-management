param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
& (Join-Path $PSScriptRoot 'verify-s2-local.ps1') -PostgresBin $PostgresBin -KeepSandbox -EvidenceDirectory (Join-Path $taskRoot '.runtime/verification/P05-S0-06/configuration-verification') -CheckpointTask 'P05-S0-06-operational-owner-configuration' -IncludeCare -IncludeMedical -IncludeBilling -IncludePortal -IncludeAftercare -IncludeFinancialNotification -IncludeSourceCharges -IncludeOwnerConfiguration
