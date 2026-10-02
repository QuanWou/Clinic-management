param([string]$PostgresBin='C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskEvidence=Join-Path $taskRoot 'docs/audits/clinic-v2/P05-S3/verification'
# Retain the new stopped instance; previously denied cleanup targets are never touched.
& (Join-Path $PSScriptRoot 'verify-s2-local.ps1') -PostgresBin $PostgresBin -KeepSandbox -EvidenceDirectory $taskEvidence -CheckpointTask 'P05-S3-01' -IncludeCare
