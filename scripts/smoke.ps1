# Read-only runtime smoke check. No registration, login, or database writes.
param(
    [string]$FrontendUrl = 'http://localhost:5173',
    [string]$GatewayUrl = 'http://localhost:8090',
    [switch]$FrontendOnly
)

$ErrorActionPreference = 'Stop'
$FrontendUrl = $FrontendUrl.TrimEnd('/')
$GatewayUrl = $GatewayUrl.TrimEnd('/')

function Assert-Ok($url) {
    try {
        $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 10
        if ($response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)" }
        Write-Host "PASS HTTP 200 $url"
        return $response
    } catch {
        throw "FAIL $url : $($_.Exception.Message)"
    }
}

$page = Assert-Ok "$FrontendUrl/"
if ($page.Content -notmatch '<div\s+id="root"') { throw 'FAIL Frontend HTML is missing #root' }
# Production builds reference .js; Vite dev references a TypeScript/TSX entry point.
$asset = [regex]::Match($page.Content, 'src="([^"]+\.(?:js|ts|tsx)(?:\?[^"]*)?)"').Groups[1].Value
if (-not $asset) { throw 'FAIL Frontend HTML is missing its application entry script' }
$assetUrl = if ($asset.StartsWith('http')) { $asset } else { "$FrontendUrl/$($asset.TrimStart('/'))" }
$null = Assert-Ok $assetUrl

if ($FrontendOnly) {
    Write-Host 'PASS frontend smoke. Gateway checks skipped explicitly.'
    exit 0
}

$health = Assert-Ok "$GatewayUrl/actuator/health"
$healthBody = if ($health.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($health.Content) } else { [string]$health.Content }
if (($healthBody | ConvertFrom-Json).status -ne 'UP') { throw 'FAIL gateway actuator health is not UP' }

foreach ($path in @('/api/users/me', '/api/dashboard/me')) {
    $url = "$GatewayUrl$path"
    try {
        $response = Invoke-WebRequest -Uri $url -Method Options -UseBasicParsing -TimeoutSec 10 -Headers @{
            Origin = 'http://localhost:5173'
            'Access-Control-Request-Method' = 'GET'
        }
        if ($response.StatusCode -ne 200 -or
            $response.Headers['Access-Control-Allow-Origin'] -ne 'http://localhost:5173') {
            throw "Unexpected preflight HTTP $($response.StatusCode) or missing allow-origin header"
        }
        Write-Host "PASS CORS preflight $path"
    } catch {
        throw "FAIL CORS preflight $url : $($_.Exception.Message)"
    }
}
Write-Host 'PASS frontend and gateway smoke.'
