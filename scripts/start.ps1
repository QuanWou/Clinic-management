param([string]$ConfigPath='',[switch]$Seed)
& (Join-Path $PSScriptRoot 'start-core.ps1') -ConfigPath $ConfigPath -Seed:$Seed
exit 0
