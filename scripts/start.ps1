param([switch]$Seed)
& (Join-Path $PSScriptRoot '../v2/scripts/start-main.ps1') -Seed:$Seed
