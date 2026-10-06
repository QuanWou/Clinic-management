# Invoked by verify-s1-local.ps1 against its freshly created, isolated databases.
function Invoke-S1ProjectionFlow {
 param([string]$taskRoot,[string]$evidence,[int]$databasePort,[string]$password,[string]$PostgresBin)
 $children=@()
 $secret='synthetic-s1-projection-flow-secret-at-least-32-bytes'
 $ports=@{}
 foreach($service in @('search','clinic','doctor','catalog','patient','appointment','notification','audit','identity')){
  $listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$ports[$service]=$listener.LocalEndpoint.Port;$listener.Stop()
 }
 function Query([string]$service,[string]$sql){
  $sql | & (Join-Path $PostgresBin 'psql.exe') -X -h 127.0.0.1 -p $databasePort -U postgres -d "clinic_v2_s1_${service}_sandbox" -v ON_ERROR_STOP=1 | Out-Null
  if($LASTEXITCODE -ne 0){throw "Projection flow SQL failed in $service"}
 }
 function Poll([scriptblock]$condition,[string]$name){
  for($attempt=0;$attempt -lt 90;$attempt++){
   try{if(& $condition){return}}catch{}
   Start-Sleep -Milliseconds 500
  }
  throw "Projection flow timed out: $name"
 }
 try{
  $clinic=[guid]::NewGuid().ToString();$branch=[guid]::NewGuid().ToString();$doctor=[guid]::NewGuid().ToString();$offering=[guid]::NewGuid().ToString();$branchOffering=[guid]::NewGuid().ToString();$user=[guid]::NewGuid().ToString()
  Query 'clinic' @"
INSERT INTO clinic.clinics(id,owner_user_id,slug,name,review_status,publication_status,evidence_verified,published_at)
 VALUES('$clinic',gen_random_uuid(),'flow-$clinic','Synthetic Flow Clinic','APPROVED','PUBLISHED',true,now());
INSERT INTO clinic.clinic_licenses(clinic_id,valid_until) VALUES('$clinic',current_date+30);
INSERT INTO clinic.branches(id,clinic_id,name,address,opening_hours) VALUES('$branch','$clinic','Synthetic Flow Branch','Synthetic address','08-17');
"@
  Query 'doctor' @"
INSERT INTO doctor.practitioners(id,platform_user_id,display_name) VALUES('$doctor',gen_random_uuid(),'Synthetic Flow Doctor');
INSERT INTO doctor.doctor_affiliations(id,practitioner_id,clinic_id,branch_id,specialty_code,specialty_name,public_visible,effective_from)
 VALUES(gen_random_uuid(),'$doctor','$clinic','$branch','GEN','Synthetic specialty',true,current_date-1);
INSERT INTO doctor.working_schedules(id,affiliation_id,practitioner_id,clinic_id,branch_id,day_of_week,start_minute,end_minute,effective_from)
 SELECT gen_random_uuid(),id,practitioner_id,clinic_id,branch_id,extract(isodow from current_date+2),480,1020,current_date FROM doctor.doctor_affiliations WHERE clinic_id='$clinic';
"@
  Query 'catalog' @"
INSERT INTO catalog_v2.offerings(id,clinic_id,code,name) VALUES('$offering','$clinic','FLOW','Synthetic Flow Offering');
INSERT INTO catalog_v2.branch_offerings(id,clinic_id,branch_id,offering_id,duration_minutes,public_visible) VALUES('$branchOffering','$clinic','$branch','$offering',30,true);
INSERT INTO catalog_v2.price_versions(id,clinic_id,branch_id,offering_id,branch_offering_id,amount_vnd,effective_from,created_by)
 VALUES(gen_random_uuid(),'$clinic','$branch','$offering','$branchOffering',100000,now(),gen_random_uuid());
"@
  $fixture=Join-Path $taskRoot 'scripts/SyntheticIdentityFixture.java'
  $children+=Start-Process -FilePath 'java.exe' -ArgumentList @('-Xmx64m',('"'+$fixture+'"'),"$($ports.identity)",$user) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence 'identity-fixture-flow.txt') -RedirectStandardError (Join-Path $evidence 'identity-fixture-flow.stderr')
  foreach($service in @('search','clinic','doctor','catalog','patient','appointment','notification','audit')){
   $prefix=$service.ToUpperInvariant()
   Env "${prefix}_DB_URL" "jdbc:postgresql://127.0.0.1:$databasePort/clinic_v2_s1_${service}_sandbox"
   Env "${prefix}_DB_USER" "s1_${service}_verify";Env "${prefix}_DB_PASSWORD" $password
   Env "${prefix}_PORT" "$($ports[$service])"
   Env 'SPRING_FLYWAY_ENABLED' 'false';Env 'SERVER_ADDRESS' '127.0.0.1'
   Env 'PROJECTION_RELAY_ENABLED' $(if($service -in @('clinic','doctor','catalog')){'true'}else{'false'})
   Env 'PROJECTION_RELAY_SEARCH_URL' "http://127.0.0.1:$($ports.search)"
   Env 'PROJECTION_RELAY_SECRET' $secret;Env 'PROJECTION_RELAY_REFRESH_MS' '1000';Env 'PROJECTION_RELAY_DELAY_MS' '500'
   Env 'SEARCH_CLINIC_SECRET' $secret;Env 'SEARCH_DOCTOR_SECRET' $secret;Env 'SEARCH_CATALOG_SECRET' $secret
   Env "${prefix}_IAM_SERVICE_SECRET" $secret;Env "${prefix}_CLINIC_SERVICE_SECRET" $secret
   Env "${prefix}_CLINIC_URL" "http://127.0.0.1:$($ports.clinic)"
   Env "${prefix}_IDENTITY_URL" "http://127.0.0.1:$($ports.identity)"
   Env 'CLINIC_APPOINTMENT_SERVICE_SECRET' $secret;Env 'PATIENT_APPOINTMENT_SECRET' $secret
   Env 'NOTIFICATION_APPOINTMENT_SECRET' $secret;Env 'AUDIT_SECURITY_APPOINTMENT_SECRET' $secret
   Env 'APPOINTMENT_WORKLOAD_SECRET' $secret;Env 'APPOINTMENT_RELAY_ENABLED' 'true'
   Env 'APPOINTMENT_RELAY_NOTIFICATION_URL' "http://127.0.0.1:$($ports.notification)";Env 'APPOINTMENT_RELAY_AUDIT_URL' "http://127.0.0.1:$($ports.audit)"
   Env 'APPOINTMENT_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'APPOINTMENT_DOCTOR_URL' "http://127.0.0.1:$($ports.doctor)";Env 'APPOINTMENT_CATALOG_URL' "http://127.0.0.1:$($ports.catalog)"
   Env 'CLINIC_IAM_DIRECTORY_SECRET' $secret;Env 'CLINIC_PUBLICATION_ENABLED' 'true'
   $jar=Join-Path $taskRoot "backend/$service-service/target/$service-service-0.1.0-SNAPSHOT.jar"
   $child=Start-Process -FilePath 'java.exe' -ArgumentList @('-Xmx256m','-jar',('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence "$service-flow.txt") -RedirectStandardError (Join-Path $evidence "$service-flow.stderr")
   $children+=$child
  }
  $base="http://127.0.0.1:$($ports.search)/api/public"
  Poll { $results=Invoke-RestMethod "$base/search?q=Synthetic%20Flow&limit=50";@($results.clinics | Where-Object clinicId -eq $clinic).Count -eq 1 -and @($results.doctors | Where-Object doctorId -eq $doctor).Count -eq 1 -and @($results.offerings | Where-Object offeringId -eq $offering).Count -eq 1 } 'all three real producer relays'
  Invoke-RestMethod "$base/search?q=Synthetic%20Flow&limit=50" | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $evidence 'projection-flow-public.json')
  $doctorUrl="http://127.0.0.1:$($ports.doctor)/api/public/clinics/$clinic/branches/$branch/doctors"
  $catalogUrl="http://127.0.0.1:$($ports.catalog)/api/public/clinics/$clinic/branches/$branch/offerings"
  if(@(Invoke-RestMethod $doctorUrl).Count -ne 1 -or @(Invoke-RestMethod $catalogUrl).Count -ne 1){throw 'Public source APIs did not return their published branch'}
  # Time-bound price becomes effective without a new command; refresh creates an invalidation.
  Query 'catalog' @"
INSERT INTO catalog_v2.price_versions(id,clinic_id,branch_id,offering_id,branch_offering_id,amount_vnd,effective_from,created_by)
 VALUES(gen_random_uuid(),'$clinic','$branch','$offering','$branchOffering',200000,now()+interval '3 seconds',gen_random_uuid());
"@
  Poll { $items=Invoke-RestMethod "$base/clinics/$clinic/offerings?branchId=$branch";@($items | Where-Object { $_.offeringId -eq $offering -and $_.amountVnd -eq 200000 }).Count -eq 1 } 'effective price refresh'
  # Business services and consumers run as non-bypass runtime logins; only Identity is a contract fixture.
  $headers=@{Authorization='Bearer synthetic-booking-session'}
  $patientBase="http://127.0.0.1:$($ports.patient)/api"
  $appointmentBase="http://127.0.0.1:$($ports.appointment)/api"
  $notificationBase="http://127.0.0.1:$($ports.notification)/api"
  Poll { (Invoke-WebRequest "$patientBase/me/patient-profile" -Headers $headers -SkipHttpErrorCheck).StatusCode -eq 404 } 'patient and synthetic Identity fixture'
  $profile=Invoke-RestMethod "$patientBase/me/patient-profile" -Method Put -Headers $headers -ContentType 'application/json' -Body (@{fullName='Synthetic Flow Patient';dateOfBirth='1990-01-01';expectedVersion=0} | ConvertTo-Json)
  $date=(Get-Date).AddDays(2).ToString('yyyy-MM-dd')
  $slots=Invoke-RestMethod "$appointmentBase/public/availability?clinicId=$clinic&branchId=$branch&offeringId=$offering&doctorId=$doctor&date=$date"
  if(@($slots).Count -eq 0){throw 'Real sources produced no availability'}
  $holdBody=@{clinicId=$clinic;branchId=$branch;offeringId=$offering;doctorId=$doctor;slotId=$slots[0].slotId;patientId=$profile.patientId} | ConvertTo-Json
  $holdHeaders=@{Authorization=$headers.Authorization;'Idempotency-Key'=[guid]::NewGuid().ToString()}
  $hold=Invoke-RestMethod "$appointmentBase/appointments/holds" -Method Post -Headers $holdHeaders -ContentType 'application/json' -Body $holdBody
  $confirmHeaders=@{Authorization=$headers.Authorization;'Idempotency-Key'=[guid]::NewGuid().ToString()}
  $confirmBody=@{clinicId=$clinic;holdId=$hold.holdId;patientId=$profile.patientId} | ConvertTo-Json
  $confirmed=Invoke-RestMethod "$appointmentBase/appointments" -Method Post -Headers $confirmHeaders -ContentType 'application/json' -Body $confirmBody
  $retried=Invoke-RestMethod "$appointmentBase/appointments" -Method Post -Headers $confirmHeaders -ContentType 'application/json' -Body $confirmBody
  if($confirmed.id -ne $retried.id -or $confirmed.price.amountVnd -ne 200000){throw 'Confirmation replay or price snapshot failed'}
  Poll { $list=Invoke-RestMethod "$notificationBase/me/notifications" -Headers $headers;@($list | Where-Object kind -eq 'CONFIRMED').Count -gt 0 } 'real appointment notification relay'
  $cancelBody=@{clinicId=$clinic;patientId=$profile.patientId;reason='Synthetic patient cancellation'} | ConvertTo-Json
  $cancelled=Invoke-RestMethod "$appointmentBase/appointments/$($confirmed.id)/cancel" -Method Post -Headers $headers -ContentType 'application/json' -Body $cancelBody
  if($cancelled.status -ne 'CANCELLED'){throw 'Cancellation failed'}
  Poll { $list=Invoke-RestMethod "$notificationBase/me/notifications" -Headers $headers;@($list | Where-Object kind -eq 'CANCELLED').Count -gt 0 } 'real cancellation notification relay'
  Poll {
   $chain="SELECT count(*) FROM audit_v2.audit_events WHERE resource_id='$($confirmed.id)' AND action IN ('clinic.appointment.confirmed.v1','clinic.appointment.cancelled.v1');"
   $auditCount=$chain | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
   $LASTEXITCODE -eq 0 -and [int]$auditCount -eq 2
  } 'real confirmation and cancellation audit delivery'
  @{status='PASS';services='Patient/Appointment/Clinic/Doctor/Catalog/Notification/Audit real HTTP + PostgreSQL';identity='synthetic contract fixture';confirmationReplay='PASS';priceSnapshot='PASS';notification='PASS';audit='PASS'} | ConvertTo-Json | Set-Content (Join-Path $evidence 'booking-flow-summary.json')
  Query 'clinic' "UPDATE clinic.clinics SET publication_status='SUSPENDED',row_version=row_version+1 WHERE id='$clinic';"
  Poll { $results=Invoke-RestMethod "$base/search?q=Synthetic%20Flow&limit=50";@($results.clinics | Where-Object clinicId -eq $clinic).Count -eq 0 -and @($results.doctors | Where-Object doctorId -eq $doctor).Count -eq 0 -and @($results.offerings | Where-Object offeringId -eq $offering).Count -eq 0 } 'suspension hides all projection types'
  foreach($url in @($doctorUrl,$catalogUrl)){
   $response=Invoke-WebRequest $url -SkipHttpErrorCheck
   if($response.StatusCode -ne 404){throw 'Suspended clinic remained accessible through a source public API'}
  }
  @{status='PASS';transport='real HTTP';producerServices=@('clinic','doctor','catalog');timeBoundPrice='PASS';suspension='PASS';syntheticOnly=$true} | ConvertTo-Json | Set-Content (Join-Path $evidence 'projection-flow-summary.json')
 }finally{
  if($clinic){
   "select event_type,status,attempts,last_error,notification_published_at is not null as notified,audit_published_at is not null as audited from appointment_v2.outbox_events where payload_json::jsonb->>'clinicid'='$clinic';" |
    & (Join-Path $PostgresBin 'psql.exe') -X -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_appointment_sandbox |
    Set-Content (Join-Path $evidence 'booking-transport-state.txt')
  }
  foreach($child in $children){if(-not $child.HasExited){$child.Kill($true);$child.WaitForExit()};$child.Dispose()}
 }
}

