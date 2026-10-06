param([string]$ConfigPath='',[switch]$Seed)
$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'start-core.ps1') -ConfigPath $ConfigPath -Seed:$Seed
exit 0
