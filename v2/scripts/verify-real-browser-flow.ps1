function Invoke-RealBrowserBooking {
 param($taskRoot,$evidence,$ports,$accounts,$clinic,$branch,$doctor,$offering,$today)
 $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$webPort=$listener.LocalEndpoint.Port;$listener.Stop()
 $configuration=Join-Path $sandbox 'real-browser-config.json'
 @{clinic=$clinic;branch=$branch;doctor=$doctor;offering=$offering;date=$today;email=$accounts.reception.email;password=$accounts.reception.password;evidence=$evidence}|ConvertTo-Json|Set-Content -LiteralPath $configuration
 $proxy=@{};foreach($entry in $ports.GetEnumerator()){$proxy[$entry.Key]=$entry.Value};$proxy.auth=$ports.legacy
 $environment=@{CLINIC_V2_REAL_E2E_CONFIG=$configuration;CLINIC_V2_PROXY_PORTS=($proxy|ConvertTo-Json -Compress);CLINIC_V2_REAL_WEB_PORT="$webPort"}
 $node=(Get-Command node.exe).Source;$npm=Join-Path (Split-Path (Get-Command npm.cmd).Source) 'node_modules/npm/bin/npm-cli.js'
 $browser=Start-Process $node -Environment $environment -WorkingDirectory (Join-Path $taskRoot 'v2/apps/web-shell') -ArgumentList @(('"'+$npm+'"'),'exec','--','playwright','test','--config','playwright.real.config.ts') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence 'actual-browser-tests.txt') -RedirectStandardError (Join-Path $evidence 'actual-browser-tests.stderr')
 $null=$browser.Handle;$browser.WaitForExit();$browser.Refresh();if($browser.ExitCode -ne 0){throw 'Actual Public browser booking failed; inspect actual-browser-tests.txt'}
 return (Get-Content (Join-Path $evidence 'actual-public-booking.json') -Raw|ConvertFrom-Json)
}
