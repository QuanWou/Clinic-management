param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
& (Join-Path $PSScriptRoot 'verify-s2-local.ps1') -PostgresBin $PostgresBin -KeepSandbox -EvidenceDirectory (Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S5/verification') -CheckpointTask 'P05-S5-own-financial-portal' -IncludeCare -IncludeMedical -IncludeBilling -IncludePortal
