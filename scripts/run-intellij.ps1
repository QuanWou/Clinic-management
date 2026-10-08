param(
    [ValidateSet('Start', 'Build', 'Stop', 'Check')]
    [string]$Action = 'Start'
)

$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskShell = (Get-Process -Id $PID).Path
$taskConfigPath = Join-Path $taskRoot '.runtime/main/config.json'

function Invoke-TaskScript([string]$Name) {
    & $taskShell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot $Name)
    if ($LASTEXITCODE -ne 0) { throw "$Name failed (exit $LASTEXITCODE)." }
}

try {
    if ($PSVersionTable.PSVersion.Major -lt 7) { throw 'PowerShell 7 is required.' }
    if ($Action -eq 'Stop') {
        Invoke-TaskScript 'stop.ps1'
        exit 0
    }

    # IntelliJ may have inherited a different Java/PATH before this setup.
    if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
        $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
    }
    foreach ($taskTool in @('mvn.cmd', 'node.exe', 'npm.cmd', 'java.exe')) {
        if (-not (Get-Command $taskTool -ErrorAction SilentlyContinue)) {
            throw "$taskTool is missing from PATH. Install the tool and restart IntelliJ."
        }
    }
    $taskJavaVersion = (& java.exe -version 2>&1 | Out-String)
    if ($taskJavaVersion -notmatch 'version "21[.\"]') { throw 'Set JAVA_HOME to a Java 21 JDK in this Run Configuration.' }
    $env:JAVA_HOME = Split-Path (Split-Path (Get-Command java.exe).Source)
    Write-Host "Java 21: $env:JAVA_HOME"

    if ($Action -eq 'Build') {
        Write-Host 'Building backend and frontend...'
        Invoke-TaskScript 'build-main.ps1'
        exit 0
    }
    if (-not (Test-Path -LiteralPath $taskConfigPath)) {
        throw 'Missing private .runtime/main/config.json. Configure the existing database first.'
    }
    $taskConfig = Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json -AsHashtable

    # Reuse the existing database container only when its published port matches.
    # Never recreate it, reset passwords, or remove its volume.
    if ($taskConfig.databaseHost -in @('127.0.0.1', 'localhost') -and (Get-Command docker.exe -ErrorAction SilentlyContinue)) {
        $taskContainerJson = & docker.exe inspect clinic-postgres 2>$null
        if ($LASTEXITCODE -eq 0) {
            $taskContainer = @($taskContainerJson | ConvertFrom-Json)[0]
            $taskBindings = @($taskContainer.HostConfig.PortBindings.'5432/tcp')
            if (@($taskBindings | Where-Object { $_.HostPort -eq [string]$taskConfig.databasePort }).Count) {
                if (-not $taskContainer.State.Running) {
                    & docker.exe start clinic-postgres
                    if ($LASTEXITCODE -ne 0) { throw 'Could not start the existing PostgreSQL container.' }
                }
                $taskReady = $false
                for ($taskAttempt = 0; $taskAttempt -lt 30; $taskAttempt++) {
                    & docker.exe exec clinic-postgres pg_isready -h 127.0.0.1 -U $taskConfig.databaseUser -d $taskConfig.databaseName *> $null
                    if ($LASTEXITCODE -eq 0) { $taskReady = $true; break }
                    Start-Sleep -Seconds 1
                }
                if (-not $taskReady) { throw 'PostgreSQL did not become ready.' }
                $taskPreviousPassword = $env:PGPASSWORD
                try {
                    $env:PGPASSWORD = $taskConfig.databasePassword
                    & docker.exe exec -e PGPASSWORD clinic-postgres psql -h 127.0.0.1 -U $taskConfig.databaseUser -d $taskConfig.databaseName -v ON_ERROR_STOP=1 -Atc 'SELECT 1' *> $null
                    if ($LASTEXITCODE -ne 0) { throw 'Database login failed. Check the private config.json credentials.' }
                } finally { $env:PGPASSWORD = $taskPreviousPassword }
                Write-Host 'PostgreSQL: ready; private database credentials verified.'
            }
        }
    }
    $taskConnection = [Net.Sockets.TcpClient]::new()
    try {
        $null = $taskConnection.ConnectAsync([string]$taskConfig.databaseHost, [int]$taskConfig.databasePort).WaitAsync([TimeSpan]::FromSeconds(5)).GetAwaiter().GetResult()
    } finally { $taskConnection.Dispose() }

    if ($Action -eq 'Check') {
        Write-Host 'IntelliJ prerequisites are ready.'
        exit 0
    }
    $taskStatePath = Join-Path $taskRoot '.runtime/main/processes.json'
    $taskLive = @()
    if (Test-Path -LiteralPath $taskStatePath) {
        $taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
        $taskLive = @($taskState.processes | Where-Object {
            $taskProcess = Get-Process -Id $_.id -ErrorAction SilentlyContinue
            $taskProcess -and $taskProcess.Path -eq $_.executable -and
                $taskProcess.StartTime.ToUniversalTime().Ticks -eq ([DateTimeOffset]$_.startedAt).UtcTicks
        })
    }
    if (-not $taskLive.Count) {
        # A Windows reserved port can fail with EACCES even when no process listens.
        $taskWebListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, [int]$taskConfig.ports.web)
        try { $taskWebListener.Start() }
        catch { throw "Web port $($taskConfig.ports.web) cannot be used. Set ports.web to an available port in .runtime/main/config.json." }
        finally { $taskWebListener.Stop() }
        Write-Host 'Building backend and frontend...'
        Invoke-TaskScript 'build-main.ps1'
    }
    Write-Host 'Starting or checking five core services, Gateway and frontend...'
    Invoke-TaskScript 'start.ps1'
    Write-Host "Patient site: http://127.0.0.1:$($taskConfig.ports.web)/public"
    Write-Host "Workspace:    http://127.0.0.1:$($taskConfig.ports.web)/workspace"
    Write-Host 'Services run in the background. Run "Clinic - Stop All" to stop them.'
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
