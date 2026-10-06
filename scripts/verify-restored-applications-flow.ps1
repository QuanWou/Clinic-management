function Invoke-RestoredApplicationsFlow {
 param($taskRoot,$evidence,$sandbox,$databasePort,$password)
 # Read only the restored synthetic clone. No traffic cutover or database rollback.
 $configuration=Get-Content -LiteralPath (Join-Path $sandbox 'restore-app-config.json') -Raw|ConvertFrom-Json
 $ports=@{};$children=@();$services=@('legacy','identity','clinic','patient','billing')
 foreach($service in $services){$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$ports[$service]=$listener.LocalEndpoint.Port;$listener.Stop()}
 try {
  foreach($service in $services){
   $settings=@{SERVER_ADDRESS='127.0.0.1';SERVER_PORT="$($ports[$service])";SPRING_FLYWAY_ENABLED='false';SPRING_JPA_HIBERNATE_DDL_AUTO='validate';SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE='4';SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE='1';PROJECTION_RELAY_ENABLED='false';ABSENCE_RELAY_ENABLED='false';BILLING_RELAY_ENABLED='false';BILLING_NOTIFICATION_ENABLED='false';BILLING_CHARGES_ENABLED='false';CLINIC_PUBLICATION_ENABLED='false'}
   if($service -eq 'legacy'){
    $database='clinic_v2_s6_restore_auth';$runtime='s6_auth_verify';$jar=Join-Path $taskRoot 'backend/auth-service/target/identity-service-1.0.0-SNAPSHOT.jar'
    $settings.APP_SECURITY_JWT_SECRET='synthetic-s2-http-user-access-token-at-least-32-bytes'
   }else{
    $database="clinic_v2_s6_restore_$service";$runtime="s1_${service}_verify";$prefix=if($service -eq 'identity'){'IAM'}else{$service.ToUpperInvariant()};$jar=Join-Path $taskRoot "backend/$service-service/target/$service-service-0.1.0-SNAPSHOT.jar"
    $settings["${prefix}_DB_URL"]="jdbc:postgresql://127.0.0.1:$databasePort/$database";$settings["${prefix}_DB_USER"]=$runtime;$settings["${prefix}_DB_PASSWORD"]=$password;$settings["${prefix}_PORT"]="$($ports[$service])"
    $settings["${prefix}_IDENTITY_URL"]="http://127.0.0.1:$($ports.identity)";$settings["${prefix}_IAM_URL"]="http://127.0.0.1:$($ports.identity)";$settings["${prefix}_CLINIC_URL"]="http://127.0.0.1:$($ports.clinic)"
   }
   $settings.SPRING_DATASOURCE_URL="jdbc:postgresql://127.0.0.1:$databasePort/$database";$settings.SPRING_DATASOURCE_USERNAME=$runtime;$settings.SPRING_DATASOURCE_PASSWORD=$password
   $settings.IAM_LEGACY_IDENTITY_URL="http://127.0.0.1:$($ports.legacy)";$settings.CLINIC_PATIENT_URL="http://127.0.0.1:$($ports.patient)";$settings.BILLING_PATIENT_URL="http://127.0.0.1:$($ports.patient)"
   $children+=Start-Process java.exe -Environment $settings -ArgumentList @('-Xmx256m','-jar',('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence "restored-$service.txt") -RedirectStandardError (Join-Path $evidence "restored-$service.stderr")
  }
  foreach($service in $services){$ready=$false;for($n=0;$n -lt 120;$n++){try{if((Invoke-WebRequest "http://127.0.0.1:$($ports[$service])/actuator/health" -SkipHttpErrorCheck -TimeoutSec 2).StatusCode -eq 200){$ready=$true;break}}catch{};Start-Sleep -Milliseconds 500};if(-not $ready){throw "Restored application failed to start: $service"}}
  function RestoredLogin($account){$login=Invoke-RestMethod "http://127.0.0.1:$($ports.legacy)/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{email=$account.email;password=$account.password}|ConvertTo-Json);if(-not $login.success -or -not $login.data.accessToken){throw 'Restored password login failed'};return @{Authorization="Bearer $($login.data.accessToken)"}}
  $owner=RestoredLogin $configuration.owner;$patient=RestoredLogin $configuration.reception
  $contexts=Invoke-RestMethod "http://127.0.0.1:$($ports.identity)/api/me/contexts" -Headers $owner
  if(@($contexts|Where-Object {$_.clinicId -eq $configuration.clinic -and $_.role -eq 'ADMIN'}).Count -ne 1){throw 'Restored canonical Owner authority missing'}
  $profile=Invoke-RestMethod "http://127.0.0.1:$($ports.patient)/api/me/patient-profile" -Headers $patient
  if($profile.patientId -ne $configuration.patientId){throw 'Restored authenticated Patient identity changed'}
  $base="http://127.0.0.1:$($ports.billing)/api/clinics/$($configuration.clinic)/branches/$($configuration.branch)/bills"
  $bills=Invoke-RestMethod $base -Headers $owner
  if(@($bills).Count -ne 2 -or @($bills|Where-Object {$_.status -ne 'PAID' -or $_.remainingVnd -ne 0}).Count -ne 0){throw 'Restored onsite bill balances changed'}
  foreach($bill in $bills){$read=Invoke-RestMethod "$base/$($bill.id)" -Headers $owner;$receipts=Invoke-RestMethod "$base/$($bill.id)/payments" -Headers $owner;if($read.id -ne $bill.id -or @($receipts).Count -eq 0){throw 'Restored bill detail or onsite receipts missing'}}
  $revoked=Invoke-WebRequest "http://127.0.0.1:$($ports.billing)/api/me/clinics/$($configuration.clinic)/branches/$($configuration.branch)/bills" -Headers $patient -SkipHttpErrorCheck
  if($revoked.StatusCode -ne 404){throw 'Restored Patient link revoke did not survive application restart'}
  $staffDenied=Invoke-WebRequest $base -Headers $patient -SkipHttpErrorCheck;if($staffDenied.StatusCode -ne 403){throw 'Restored revoked staff regained operational money access'}
  @{status='PASS';environment='isolated-restored-synthetic-clone';applications=$services;schema='VALIDATE_ONLY_NO_MIGRATIONS';actualPasswordLogin=2;ownerAuthority='RESTORED_CANONICAL_IAM';patientIdentity='SAME_PLATFORM_USER_LINK';paidBills=2;receipts='READ_FROM_RESTORED_BILLING';patientLinkRevoke=404;staffRevoke=403;relayWrites='DISABLED';productionTraffic='UNCHANGED';applicationRollback='NOT_EXECUTED'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'restored-applications-summary.json')
 }finally{foreach($child in $children){if(-not $child.HasExited){Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue}}}
}
