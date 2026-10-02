# All business services and V2 Identity/IAM are real; only legacy user/token source is a fixture.
function Invoke-S2ReceptionFlow {
 param([string]$taskRoot,[string]$evidence,[int]$databasePort,[string]$password,[string]$PostgresBin,[switch]$IncludeCare,[switch]$IncludeMedical,[switch]$IncludeBilling)
 # Reverify a package if its source changed while the longer multi-module run was in progress.
 foreach($taskChangedService in @('appointment','encounter')){
  $taskPom=Join-Path $taskRoot "v2/services/$taskChangedService-service/pom.xml"
  $taskJar=Join-Path $taskRoot "v2/services/$taskChangedService-service/target/$taskChangedService-service-0.1.0-SNAPSHOT.jar"
  $taskNewest=Get-ChildItem -LiteralPath (Join-Path $taskRoot "v2/services/$taskChangedService-service/src") -Recurse -File | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
  if($taskNewest.LastWriteTimeUtc -gt (Get-Item -LiteralPath $taskJar).LastWriteTimeUtc){
   Checked 'mvn.cmd' @('-B','-ntp','-f',$taskPom,'clean','test','-DfailIfNoTests=true',"-D$taskChangedService.it.enabled=true","-D$taskChangedService.it.jdbc-url=jdbc:postgresql://127.0.0.1:$databasePort/clinic_v2_s1_${taskChangedService}_sandbox") "$taskChangedService-refresh-test.txt"
   $taskReports=Join-Path $taskRoot "v2/services/$taskChangedService-service/target/surefire-reports";$taskTestCount=0
   foreach($taskReport in Get-ChildItem -LiteralPath $taskReports -Filter 'TEST-*.xml'){[xml]$taskResult=Get-Content -LiteralPath $taskReport.FullName -Raw;if([int]$taskResult.testsuite.failures -ne 0 -or [int]$taskResult.testsuite.errors -ne 0 -or [int]$taskResult.testsuite.skipped -ne 0){throw 'Changed source re-verification failed'};$taskTestCount+=[int]$taskResult.testsuite.tests}
   if($taskTestCount -eq 0){throw 'Changed source requires tests'}
   Get-ChildItem -LiteralPath $taskReports -Filter '*.txt' | Copy-Item -Destination $evidence -Force
   Checked 'mvn.cmd' @('-B','-ntp','-f',$taskPom,'-DskipTests','package') "$taskChangedService-refresh-package.txt"
   $taskEntry=@($summary.modules | Where-Object service -eq $taskChangedService)[0];$taskEntry.tests=$taskTestCount;$taskEntry.jarSha256=(Get-FileHash -LiteralPath $taskJar).Hash
  }
 }
 $children=@();$ports=@{};$secret='synthetic-s2-http-workload-secret-at-least-32-bytes';$userSecret='synthetic-s2-http-user-access-token-at-least-32-bytes'
 $taskFlowServices=@('clinic','doctor','patient','appointment','encounter','identity','notification','audit')
 if($IncludeMedical){$taskFlowServices+=@('catalog','medical')}
if($IncludeBilling){$taskFlowServices+=@('billing')}
if($IncludeRealIdentity){$taskFlowServices+=@('search')}
 foreach($service in ($taskFlowServices+@('legacy'))){$listener=[Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback,0);$listener.Start();$ports[$service]=$listener.LocalEndpoint.Port;$listener.Stop()}
 function Query([string]$service,[string]$sql){$sql | & (Join-Path $PostgresBin 'psql.exe') -X -h 127.0.0.1 -p $databasePort -U postgres -d "clinic_v2_s1_${service}_sandbox" -v ON_ERROR_STOP=1 | Out-Null;if($LASTEXITCODE -ne 0){throw "S2 fixture SQL failed: $service"}}
 function Poll([scriptblock]$condition,[string]$name){for($n=0;$n -lt 90;$n++){try{if(& $condition){return}}catch{};Start-Sleep -Milliseconds 500};throw "S2 flow timeout: $name"}
 function Post([string]$url,[hashtable]$headers,[object]$body){try{Invoke-RestMethod $url -Method Post -Headers $headers -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 6)}catch{throw ("HTTP verification failed at "+([uri]$url).AbsolutePath+": "+$_.Exception.Message)}}
 try{
  $taskIdentityMode=if($IncludeRealIdentity){'actual-legacy-signup-password-login-real-V2-IAM'}else{'declared-synthetic-legacy-token-and-source-fixtures'}
  $taskAuth=$null;if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-real-identity-flow.ps1');$children+=Start-RealIdentity $taskRoot $evidence $ports $databasePort $password $PostgresBin $userSecret;Poll { (Invoke-WebRequest "http://127.0.0.1:$($ports.legacy)/actuator/health" -SkipHttpErrorCheck -TimeoutSec 2).StatusCode -eq 200 } 'actual legacy Identity ready';$taskAuth=Invoke-RealIdentityRegistration $evidence $ports }
  $clinic=[guid]::NewGuid().ToString();$branch=[guid]::NewGuid().ToString();$otherBranch=[guid]::NewGuid().ToString();$doctor=[guid]::NewGuid().ToString();$owner=if($taskAuth){$taskAuth.users.owner}else{[guid]::NewGuid().ToString()};$reception=if($taskAuth){$taskAuth.users.reception}else{[guid]::NewGuid().ToString()};$doctorUser=if($taskAuth){$taskAuth.users.doctor}else{[guid]::NewGuid().ToString()};$stranger=if($taskAuth){$taskAuth.users.stranger}else{[guid]::NewGuid().ToString()}
  if(-not $IncludeRealIdentity){
  $fixture=Join-Path $taskRoot 'v2/scripts/SyntheticLegacyIdentityFixture.java'
  $children+=Start-Process java.exe -ArgumentList @('-Xmx64m',('"'+$fixture+'"'),"$($ports.legacy)",$userSecret,$owner,$reception,$doctorUser,$stranger) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence 'legacy-fixture.txt') -RedirectStandardError (Join-Path $evidence 'legacy-fixture.stderr')
  }
  foreach($service in $taskFlowServices){
   $prefix=if($service -eq 'identity'){'IAM'}else{$service.ToUpperInvariant()}
   Env "${prefix}_V2_DB_URL" "jdbc:postgresql://127.0.0.1:$databasePort/clinic_v2_s1_${service}_sandbox";Env "${prefix}_V2_DB_USER" "s1_${service}_verify";Env "${prefix}_V2_DB_PASSWORD" $password;Env "${prefix}_V2_PORT" "$($ports[$service])"
   Env 'SPRING_FLYWAY_ENABLED' $(if($taskVerifiedPackages){'true'}else{'false'});if($taskVerifiedPackages){Env 'SPRING_FLYWAY_USER' 'postgres';Env 'SPRING_FLYWAY_PASSWORD' $password;}Env 'SERVER_ADDRESS' '127.0.0.1';Env 'PROJECTION_RELAY_ENABLED' $(if($IncludeRealIdentity -and $service -in @('clinic','doctor','catalog')){'true'}else{'false'});Env 'PROJECTION_RELAY_SEARCH_URL' "http://127.0.0.1:$($ports.search)";Env 'PROJECTION_RELAY_SECRET' $secret;Env 'PROJECTION_RELAY_REFRESH_MS' '1000';Env 'SEARCH_V2_CLINIC_SECRET' $secret;Env 'SEARCH_V2_DOCTOR_SECRET' $secret;Env 'SEARCH_V2_CATALOG_SECRET' $secret;Env 'APPOINTMENT_RELAY_ENABLED' 'true';Env 'APPOINTMENT_RELAY_NOTIFICATION_URL' "http://127.0.0.1:$($ports.notification)";Env 'APPOINTMENT_RELAY_AUDIT_URL' "http://127.0.0.1:$($ports.audit)";Env 'ENCOUNTER_RELAY_ENABLED' 'true';Env 'ENCOUNTER_RELAY_AUDIT_URL' "http://127.0.0.1:$($ports.audit)";Env 'AUDIT_SECURITY_ENCOUNTER_SECRET' $secret;Env 'AUDIT_SECURITY_APPOINTMENT_SECRET' $secret;Env 'NOTIFICATION_V2_APPOINTMENT_SECRET' $secret;Env 'PATIENT_V2_APPOINTMENT_SECRET' $secret;Env 'APPOINTMENT_V2_PATIENT_URL' "http://127.0.0.1:$($ports.patient)"
   Env "${prefix}_V2_IAM_URL" "http://127.0.0.1:$($ports.identity)";Env "${prefix}_V2_IDENTITY_URL" "http://127.0.0.1:$($ports.identity)";Env "${prefix}_V2_CLINIC_URL" "http://127.0.0.1:$($ports.clinic)"
   Env "${prefix}_V2_IAM_SERVICE_SECRET" $secret;Env "${prefix}_V2_CLINIC_SERVICE_SECRET" $secret
   Env 'PATIENT_V2_RECEPTION_ENABLED' 'true';Env 'CLINIC_V2_IAM_DIRECTORY_SECRET' $secret;Env 'CLINIC_V2_DOCTOR_SERVICE_SECRET' $secret
   Env 'CLINIC_SECURITY_PATIENT_SERVICE_SECRET' $secret;Env 'CLINIC_SECURITY_ENCOUNTER_SERVICE_SECRET' $secret
   Env 'ABSENCE_RELAY_ENABLED' 'true';Env 'ABSENCE_RELAY_SECRET' $secret;Env 'ABSENCE_RELAY_APPOINTMENT_URL' "http://127.0.0.1:$($ports.appointment)";Env 'APPOINTMENT_SECURITY_ABSENCE_SECRET' $secret
   Env 'PATIENT_SECURITY_ENCOUNTER_SECRET' $secret;Env 'DOCTOR_SECURITY_ENCOUNTER_SECRET' $secret;Env 'APPOINTMENT_SECURITY_ENCOUNTER_SECRET' $secret
   Env 'ENCOUNTER_V2_SERVICE_SECRET' $secret;Env 'ENCOUNTER_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'ENCOUNTER_DOCTOR_URL' "http://127.0.0.1:$($ports.doctor)";Env 'ENCOUNTER_APPOINTMENT_URL' "http://127.0.0.1:$($ports.appointment)"
   if($IncludePortal){Env 'BILLING_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'CLINIC_PATIENT_URL' "http://127.0.0.1:$($ports.patient)"}
   if($IncludeAftercare){Env 'ENCOUNTER_PORTAL_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'MEDICAL_PORTAL_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'APPOINTMENT_FOLLOW_UP_ENCOUNTER_URL' "http://127.0.0.1:$($ports.encounter)";Env 'APPOINTMENT_FOLLOW_UP_MEDICAL_URL' "http://127.0.0.1:$($ports.medical)";Env 'APPOINTMENT_V2_DOCTOR_URL' "http://127.0.0.1:$($ports.doctor)";Env 'APPOINTMENT_V2_CATALOG_URL' "http://127.0.0.1:$($ports.catalog)";Env 'CLINIC_V2_PUBLICATION_ENABLED' 'true';Env 'CLINIC_V2_APPOINTMENT_SERVICE_SECRET' $secret;Env 'CLINIC_V2_CATALOG_SERVICE_SECRET' $secret}
   if($IncludeFinancialNotification){Env 'PATIENT_V2_BILLING_SECRET' $secret;Env 'NOTIFICATION_V2_BILLING_SECRET' $secret;Env 'BILLING_NOTIFICATION_ENABLED' 'true';Env 'BILLING_NOTIFICATION_PATIENT_URL' "http://127.0.0.1:$($ports.patient)";Env 'BILLING_NOTIFICATION_NOTIFICATION_URL' "http://127.0.0.1:$($ports.notification)"}
   if($IncludeSourceCharges){Env 'BILLING_CHARGES_ENABLED' 'true';Env 'BILLING_CHARGES_MEDICAL_SECRET' $secret;Env 'BILLING_CHARGES_ENCOUNTER_SECRET' $secret;Env 'MEDICAL_CHARGES_ENABLED' 'true';Env 'ENCOUNTER_CHARGES_ENABLED' 'true';Env 'MEDICAL_CHARGES_BILLING_URL' "http://127.0.0.1:$($ports.billing)";Env 'ENCOUNTER_CHARGES_BILLING_URL' "http://127.0.0.1:$($ports.billing)"}
   Env 'APPOINTMENT_V2_WORKLOAD_SECRET' $secret
   if($IncludeMedical){Env 'ENCOUNTER_MEDICAL_URL' "http://127.0.0.1:$($ports.medical)";Env 'MEDICAL_V2_SERVICE_SECRET' $secret;Env 'MEDICAL_ENCOUNTER_URL' "http://127.0.0.1:$($ports.encounter)";Env 'MEDICAL_CATALOG_URL' "http://127.0.0.1:$($ports.catalog)";Env 'MEDICAL_RELAY_ENABLED' 'true';Env 'MEDICAL_RELAY_AUDIT_URL' "http://127.0.0.1:$($ports.audit)";Env 'AUDIT_SECURITY_MEDICAL_SECRET' $secret}
   if($IncludeBilling){Env 'BILLING_V2_SERVICE_SECRET' $secret;Env 'BILLING_ENCOUNTER_URL' "http://127.0.0.1:$($ports.encounter)";Env 'BILLING_MEDICAL_URL' "http://127.0.0.1:$($ports.medical)";Env 'BILLING_APPOINTMENT_URL' "http://127.0.0.1:$($ports.appointment)";Env 'ENCOUNTER_SECURITY_BILLING_SECRET' $secret;Env 'MEDICAL_SECURITY_BILLING_SECRET' $secret;Env 'APPOINTMENT_SECURITY_BILLING_SECRET' $secret;Env 'BILLING_RELAY_ENABLED' 'true';Env 'BILLING_RELAY_AUDIT_URL' "http://127.0.0.1:$($ports.audit)";Env 'AUDIT_SECURITY_BILLING_SECRET' $secret}
   Env 'IAM_V2_JWT_SECRET' $userSecret;Env 'IAM_V2_WORKLOAD_INBOUND_SECRET' $secret;Env 'IAM_V2_CLINIC_INBOUND_SECRET' $secret;Env 'IAM_V2_CLINIC_OUTBOUND_SECRET' $secret;Env 'IAM_V2_LEGACY_IDENTITY_URL' "http://127.0.0.1:$($ports.legacy)"
   Env 'SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE' '4';Env 'SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE' '1'
   $jar=Join-Path $taskRoot "v2/services/$service-service/target/$service-service-0.1.0-SNAPSHOT.jar"
   $children+=Start-Process java.exe -ArgumentList @('-Xmx256m','-jar',('"'+$jar+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $evidence "$service-flow.txt") -RedirectStandardError (Join-Path $evidence "$service-flow.stderr")
  }
  foreach($service in $taskFlowServices){Poll { (Invoke-WebRequest "http://127.0.0.1:$($ports[$service])/actuator/health" -SkipHttpErrorCheck -TimeoutSec 2).StatusCode -eq 200 } "$service ready"}
  Query 'clinic' @"
INSERT INTO clinic.clinics(id,owner_user_id,slug,name,review_status,publication_status) VALUES('$clinic','$owner','s2-$clinic','Synthetic S2 Clinic','APPROVED','UNPUBLISHED');
INSERT INTO clinic.branches(id,clinic_id,name,address,opening_hours) VALUES('$branch','$clinic','Synthetic S2 Desk','Synthetic address','08-17'),('$otherBranch','$clinic','Synthetic other branch','Synthetic address','08-17');
"@
  Query 'identity' @"
INSERT INTO iam.memberships(id,user_id,clinic_id,role,status,all_branches,invited_by,activated_at) VALUES(gen_random_uuid(),'$owner','$clinic','CLINIC_OWNER','ACTIVE',true,'$owner',now()),(gen_random_uuid(),'$reception','$clinic','RECEPTIONIST','ACTIVE',false,'$owner',now()),(gen_random_uuid(),'$doctorUser','$clinic','DOCTOR','ACTIVE',false,'$owner',now());
INSERT INTO iam.membership_branch_grants(id,membership_id,user_id,clinic_id,branch_id,granted_by) SELECT gen_random_uuid(),id,user_id,clinic_id,'$branch','$owner' FROM iam.memberships WHERE clinic_id='$clinic' AND role IN ('RECEPTIONIST','DOCTOR');
"@
  if($taskAuth){$unassigned=$taskAuth.users.unassigned;Query 'identity' "INSERT INTO iam.memberships(id,user_id,clinic_id,role,status,all_branches,invited_by,activated_at) VALUES(gen_random_uuid(),'$unassigned','$clinic','DOCTOR','ACTIVE',false,'$owner',now()); INSERT INTO iam.membership_branch_grants(id,membership_id,user_id,clinic_id,branch_id,granted_by) SELECT gen_random_uuid(),id,user_id,clinic_id,'$branch','$owner' FROM iam.memberships WHERE clinic_id='$clinic' AND user_id='$unassigned';"}
  Query 'doctor' @"
INSERT INTO doctor.practitioners(id,platform_user_id,display_name) VALUES('$doctor','$doctorUser','Synthetic S2 Doctor');
INSERT INTO doctor.doctor_affiliations(id,practitioner_id,clinic_id,branch_id,specialty_code,specialty_name,public_visible,effective_from) VALUES(gen_random_uuid(),'$doctor','$clinic','$branch','GEN','Synthetic specialty',false,current_date-1);
"@
  if($IncludeMedical){Query 'identity' "INSERT INTO iam.memberships(id,user_id,clinic_id,role,status,all_branches,invited_by,activated_at) VALUES(gen_random_uuid(),'$stranger','$clinic','LAB','ACTIVE',false,'$owner',now()); INSERT INTO iam.membership_branch_grants(id,membership_id,user_id,clinic_id,branch_id,granted_by) SELECT gen_random_uuid(),id,user_id,clinic_id,'$branch','$owner' FROM iam.memberships WHERE clinic_id='$clinic' AND user_id='$stranger';"}
  $tokens=@{};if($taskAuth){$tokens=$taskAuth.tokens}else{foreach($role in @('owner','reception','doctor','stranger')){$tokens[$role]=(Invoke-RestMethod "http://127.0.0.1:$($ports.legacy)/fixture/token/$role").accessToken}}
  if($IncludeOwnerConfiguration){ . (Join-Path $PSScriptRoot 'verify-configuration-flow.ps1'); Invoke-ConfigurationFlow $evidence $ports $tokens }
  $headers=@{Authorization="Bearer $($tokens.reception)"};$ownerHeaders=@{Authorization="Bearer $($tokens.owner)"}
  $base="http://127.0.0.1:$($ports.encounter)/api/v2/clinics/$clinic/branches/$branch"
  $patientBase="http://127.0.0.1:$($ports.patient)/api/v2/clinics/$clinic/branches/$branch/patients"
  $directory=Invoke-RestMethod "http://127.0.0.1:$($ports.clinic)/api/v2/clinics/$clinic/reception-directory" -Headers $headers
  if(@($directory.branches).Count -ne 1 -or $directory.branches[0].id -ne $branch){throw 'Reception directory exposed an ungranted branch'}
  $point=Post "$base/service-points" $ownerHeaders @{code='S2';name='Synthetic Service Point'}
  $headers['Idempotency-Key']=[guid]::NewGuid().ToString();$patientBody=@{fullName='Synthetic S2 Patient';phone='0001234567';reason='Synthetic walk-in'}
  $patient=Post "$patientBase/walk-in" $headers $patientBody;$patientReplay=Post "$patientBase/walk-in" $headers $patientBody
  if($patient.patientId -ne $patientReplay.patientId -or $patient.status -ne 'PROVISIONAL'){throw 'Provisional patient replay failed'}
  $suggestions=Invoke-RestMethod "$patientBase/match-suggestions?phone=0001234567" -Headers $headers
  if(@($suggestions | Where-Object patientId -eq $patient.patientId).Count -ne 1){throw 'Clinic matching failed'}
  $realBooking=$null;if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-real-booking-flow.ps1');$realBooking=Invoke-RealBookingFlow $evidence $ports $tokens $clinic $branch $doctor $owner;$patient=$realBooking.patient }
  $headers['Idempotency-Key']=[guid]::NewGuid().ToString();$walkBody=@{patientId=$patient.patientId;doctorId=$doctor;servicePointId=$point.id;reason='Synthetic reception'}
  $walk=Post "$base/visits/walk-in" $headers $walkBody;$walkReplay=Post "$base/visits/walk-in" $headers $walkBody
  if($null -ne $walk.appointmentId -or $walk.id -ne $walkReplay.id -or $walk.ticket.id -ne $walkReplay.ticket.id){throw 'Walk-in created a fake appointment or duplicate ticket'}
  $called=Post "$base/queue/$($walk.ticket.id)/call" $headers @{expectedVersion=$walk.ticket.version;reason='Synthetic call'}
  $worklist=Invoke-RestMethod "$base/doctor/worklist" -Headers @{Authorization="Bearer $($tokens.doctor)"}
  $assigned=@($worklist | Where-Object id -eq $walk.id)[0];if($null -eq $assigned){throw 'Assigned doctor cannot see worklist'}
  $started=Post "$base/visits/$($walk.id)/start" @{Authorization="Bearer $($tokens.doctor)"} @{expectedVersion=$assigned.version;reason='Synthetic start'}
  if($started.status -ne 'IN_PROGRESS' -or $started.ticket.state -ne 'SERVING'){throw 'Assigned doctor start failed'}
  # Separate seeded confirmed booking tests arrival coordination; S1 booking creation is covered by its own verifier.
  if($realBooking){$booking=$realBooking.booking;$slot=$realBooking.slot;$hold=$realBooking.hold;$offering=$realBooking.offering;$price=$realBooking.price}else{
  $booking=[guid]::NewGuid().ToString();$slot=[guid]::NewGuid().ToString();$hold=[guid]::NewGuid().ToString();$offering=[guid]::NewGuid().ToString();$price=[guid]::NewGuid().ToString()
  Query 'appointment' @"
INSERT INTO appointment_v2.capacity_slots(id,clinic_id,branch_id,offering_id,doctor_id,starts_at,ends_at,capacity,schedule_version,offering_version) VALUES('$slot','$clinic','$branch','$offering','$doctor',now(),now()+interval '30 minutes',1,1,1);
INSERT INTO appointment_v2.slot_reservations(id,slot_id,clinic_id,branch_id,patient_id,price_version_id,amount_vnd,currency,price_effective_from,state,expires_at,idempotency_key,payload_hash) VALUES('$hold','$slot','$clinic','$branch','$($patient.patientId)','$price',100000,'VND',now(),'CONSUMED',now()+interval '10 minutes','synthetic-hold','synthetic-hash');
INSERT INTO appointment_v2.appointments(id,appointment_code,clinic_id,branch_id,patient_id,clinic_patient_link_id,offering_id,doctor_id,slot_id,reservation_id,price_version_id,amount_vnd,currency,price_effective_from,status,confirmation_key) VALUES('$booking','AP-S2-SYN','$clinic','$branch','$($patient.patientId)','$($patient.clinicPatientLinkId)','$offering','$doctor','$slot','$hold','$price',100000,'VND',now(),'CONFIRMED','synthetic-confirm');
"@
  }
  $headers['Idempotency-Key']=[guid]::NewGuid().ToString();$arrivalBody=@{patientId=$patient.patientId;servicePointId=$point.id;reason='Synthetic check-in'}
  $lateHeaders=@{Authorization=$headers.Authorization;'Idempotency-Key'=[guid]::NewGuid().ToString()}
  if($realBooking){
   $futureLate=Invoke-WebRequest "$base/appointments/$booking/exceptions" -Method Post -Headers $lateHeaders -ContentType 'application/json' -Body '{"type":"LATE","reason":"Synthetic premature late report"}' -SkipHttpErrorCheck
   if($futureLate.StatusCode -ne 409){throw 'Future actual booking accepted a late exception'}
  }else{
  $late=Post "$base/appointments/$booking/exceptions" $lateHeaders @{type='LATE';reason='Synthetic late arrival'}
  $lateReplay=Post "$base/appointments/$booking/exceptions" $lateHeaders @{type='LATE';reason='Synthetic late arrival'}
  if($late.id -ne $lateReplay.id -or $late.notificationMode -ne 'MANUAL_CONTACT_REQUIRED'){throw 'Reception exception replay or manual-contact mode failed'}
  }
  $arrival=Post "$base/appointments/$booking/check-in" $headers $arrivalBody;$arrivalReplay=Post "$base/appointments/$booking/check-in" $headers $arrivalBody
  if($arrival.id -ne $arrivalReplay.id -or $arrival.ticket.id -ne $arrivalReplay.ticket.id){throw 'Arrival was duplicated'}
  Poll {
   $auditSql="SELECT count(*) FROM audit_v2.audit_events WHERE (resource_type='encounter' AND resource_id IN ('$($walk.id)','$($arrival.id)')) OR (resource_type='appointment' AND resource_id='$booking');"
   $count=$auditSql | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
   $LASTEXITCODE -eq 0 -and [int]$count -eq 5
  } 'real encounter and appointment-exception Audit delivery'
  $today=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTime]::UtcNow,'SE Asia Standard Time').ToString('yyyy-MM-dd')
  $submitted=Invoke-RestMethod "$base/reception/arrivals?date=$today" -Headers $headers
  if(@($submitted | Where-Object {$_.visit.id -eq $walk.id}).Count -ne 1){throw 'Server arrival recovery did not find original staff receipt'}
  $recovered=Post "$base/reception/arrivals/$($walk.id)/recover" $headers @{expectedVersion=0;reason='Synthetic reload reconciliation'}
  if($recovered.id -ne $walk.id -or $recovered.status -ne 'IN_PROGRESS'){throw 'Recovery changed an already active visit'}
  $ownerLookup=Invoke-WebRequest "$base/reception/arrivals/$($walk.id)/recover" -Method Post -Headers $ownerHeaders -ContentType 'application/json' -Body '{"expectedVersion":0,"reason":"Synthetic wrong actor"}' -SkipHttpErrorCheck
  if($ownerLookup.StatusCode -ne 404){throw 'Recovery exposed another actor receipt'}
  $impactBooking=[guid]::NewGuid().ToString();$impactSlot=[guid]::NewGuid().ToString();$impactHold=[guid]::NewGuid().ToString()
  Query 'appointment' @"
INSERT INTO appointment_v2.capacity_slots(id,clinic_id,branch_id,offering_id,doctor_id,starts_at,ends_at,capacity,schedule_version,offering_version) VALUES('$impactSlot','$clinic','$branch','$offering','$doctor',now()+interval '5 minutes',now()+interval '35 minutes',1,1,1);
INSERT INTO appointment_v2.slot_reservations(id,slot_id,clinic_id,branch_id,patient_id,price_version_id,amount_vnd,currency,price_effective_from,state,expires_at,idempotency_key,payload_hash) VALUES('$impactHold','$impactSlot','$clinic','$branch','$($patient.patientId)','$price',100000,'VND',now(),'CONSUMED',now()+interval '10 minutes','synthetic-impact-hold','synthetic-hash');
INSERT INTO appointment_v2.appointments(id,appointment_code,clinic_id,branch_id,patient_id,clinic_patient_link_id,offering_id,doctor_id,slot_id,reservation_id,price_version_id,amount_vnd,currency,price_effective_from,status,confirmation_key) VALUES('$impactBooking','AP-S2-ABSENCE','$clinic','$branch','$($patient.patientId)','$($patient.clinicPatientLinkId)','$offering','$doctor','$impactSlot','$impactHold','$price',100000,'VND',now(),'CONFIRMED','synthetic-impact-confirm');
"@
  $ownerHeaders['Idempotency-Key']=[guid]::NewGuid().ToString()
  $absenceBase="http://127.0.0.1:$($ports.doctor)/api/v2/clinics/$clinic/branches/$branch/doctors/$doctor/absences"
  $absenceBody=@{startsAt=[DateTimeOffset]::UtcNow.ToString('o');endsAt=[DateTimeOffset]::UtcNow.AddHours(2).ToString('o');reason='Synthetic doctor absence'}
  $absence=Post $absenceBase $ownerHeaders $absenceBody;$absenceReplay=Post $absenceBase $ownerHeaders $absenceBody
  if($absence.id -ne $absenceReplay.id){throw 'Source absence replay duplicated interval'}
  $batch=Post "$base/doctor-absences/$($absence.id)/apply" $ownerHeaders @{}
  if($batch.recorded -notin @(0,1) -or @($batch.retryRequired).Count -ne 0 -or $batch.hasMore){throw 'Bulk source absence did not record the affected confirmed booking'}
  $batchReplay=Post "$base/doctor-absences/$($absence.id)/apply" $ownerHeaders @{}
  if($batchReplay.recorded -ne 0){throw 'Source absence retry duplicated appointment exception'}
  $kept=Invoke-RestMethod "$base/reception/appointments?date=$today" -Headers $headers
  if(@($kept | Where-Object {$_.id -eq $impactBooking -and $_.status -eq 'CONFIRMED'}).Count -ne 1){throw 'Absence silently removed confirmed booking'}
  Poll {
   $auditSql="SELECT count(*) FROM audit_v2.audit_events WHERE (resource_type='encounter' AND resource_id IN ('$($walk.id)','$($arrival.id)')) OR (resource_type='appointment' AND resource_id IN ('$booking','$impactBooking'));"
   $count=$auditSql | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
   $LASTEXITCODE -eq 0 -and [int]$count -eq 6
  } 'source absence audit delivery'
  if($IncludeCare){
   $doctorHeaders=@{Authorization="Bearer $($tokens.doctor)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
   $careDirectory=Invoke-RestMethod "http://127.0.0.1:$($ports.clinic)/api/v2/clinics/$clinic/care-directory" -Headers $doctorHeaders
   if(@($careDirectory.branches).Count -ne 1 -or $careDirectory.branches[0].id -ne $branch){throw 'Doctor directory leaked ungranted branch'}
   $carePoints=Invoke-RestMethod "$base/doctor/service-points" -Headers $doctorHeaders
   if(@($carePoints | Where-Object id -eq $point.id).Count -ne 1){throw 'Doctor service-point list unavailable'}
   $careBase="$base/doctor/visits/$($walk.id)"
   $waitBody=@{expectedVersion=$started.version;reason='Synthetic care wait'}
   $waiting=Post "$careBase/await-results" $doctorHeaders $waitBody
   $waitingReplay=Post "$careBase/await-results" $doctorHeaders $waitBody
   if($waiting.status -ne 'AWAITING_RESULTS' -or $null -ne $waiting.ticket -or $waiting.version -ne $waitingReplay.version){throw 'Awaiting results did not retire the serving ticket exactly once'}
   $nextCalled=Post "$base/queue/$($arrival.ticket.id)/call" $headers @{expectedVersion=$arrival.ticket.version;reason='Next visit may use the freed point'}
   $null=Post "$base/queue/$($nextCalled.id)/skip" $headers @{expectedVersion=$nextCalled.version;reason='Synthetic queue release'}
   $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$returnBody=@{expectedVersion=$waiting.version;reason='Synthetic review and return';servicePointId=$point.id}
   $returned=Post "$careBase/resume-queue" $doctorHeaders $returnBody;$returnReplay=Post "$careBase/resume-queue" $doctorHeaders $returnBody
   if($returned.id -ne $walk.id -or $returned.ticket.id -eq $walk.ticket.id -or $returnReplay.ticket.id -ne $returned.ticket.id -or $returned.status -ne 'AWAITING_RESULTS'){throw 'Care return created a new visit or duplicate ticket'}
   $null=Post "$base/queue/$($returned.ticket.id)/call" $headers @{expectedVersion=$returned.ticket.version;reason='Call returning visit'}
   $current=Invoke-RestMethod "$base/doctor/worklist" -Headers $doctorHeaders
   $ready=@($current | Where-Object id -eq $walk.id)[0];$doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$startBody=@{expectedVersion=$ready.version;reason='Synthetic care resume'}
   $active=Post "$careBase/start" $doctorHeaders $startBody;$activeReplay=Post "$careBase/start" $doctorHeaders $startBody
   if($active.status -ne 'IN_PROGRESS' -or $active.ticket.state -ne 'SERVING' -or $active.version -ne $activeReplay.version){throw 'Assigned doctor could not resume exactly once'}
   Poll {
    $count="SELECT count(*) FROM audit_v2.audit_events WHERE (resource_type='encounter' AND resource_id IN ('$($walk.id)','$($arrival.id)')) OR (resource_type='appointment' AND resource_id IN ('$booking','$impactBooking'));" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
    $LASTEXITCODE -eq 0 -and [int]$count -eq 12
   } 'care lifecycle audit exact effects'
   if($IncludeMedical){
    . (Join-Path $PSScriptRoot 'verify-medical-flow.ps1')
    Invoke-MedicalFlow $taskRoot $evidence $ports $databasePort $PostgresBin $clinic $branch $owner $tokens $walk.id
    . (Join-Path $PSScriptRoot 'verify-completion-flow.ps1')
    Invoke-CompletionFlow $taskRoot $evidence $ports $databasePort $PostgresBin $clinic $branch $owner $tokens $walk $arrival $point
    if($IncludeFinancialNotification -and -not $IncludeRealIdentity){Query 'patient' "INSERT INTO patient_v2.platform_user_patient_links(user_id,patient_id) VALUES('$reception','$($patient.patientId)') ON CONFLICT(user_id) DO NOTHING;"}
    if($IncludeSourceCharges){ . (Join-Path $PSScriptRoot 'verify-charge-flow.ps1'); Invoke-ChargeFlow $evidence $ports $databasePort $PostgresBin $clinic $branch $tokens $secret }
    if($IncludeBilling){ . (Join-Path $PSScriptRoot 'verify-billing-flow.ps1'); Invoke-BillingFlow $evidence $ports $databasePort $PostgresBin $clinic $branch $owner $tokens $walk.id $arrival.id }
    if($IncludeFinancialNotification){ . (Join-Path $PSScriptRoot 'verify-financial-flow.ps1'); Invoke-FinancialFlow $evidence $ports $databasePort $PostgresBin $clinic $branch $reception $tokens $secret }
    if($IncludeAftercare){ . (Join-Path $PSScriptRoot 'verify-operations-flow.ps1'); Invoke-OperationsFlow $evidence $ports $clinic $branch $otherBranch $tokens; . (Join-Path $PSScriptRoot 'verify-aftercare-flow.ps1'); Invoke-AftercareFlow $evidence $ports $clinic $branch $patient.patientId $reception $doctor $owner $tokens $arrival.id $booking }

   }
  if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-absence-lifecycle-flow.ps1');Invoke-AbsenceLifecycleFlow $evidence $ports $clinic $branch $doctor $absence $impactBooking $patient.patientId $tokens $today }
   if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-reception-operations-flow.ps1');Invoke-ReceptionOperationsFlow $evidence $ports $clinic $branch $otherBranch $patient.patientId $doctor $doctorUser $reception $point.id $booking $tokens $today }
   if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-clinical-access-flow.ps1');Invoke-ClinicalAccessFlow $evidence $ports $clinic $branch $arrival.id $taskAuth.users.unassigned $tokens }
   if($IncludeRealIdentity){ . (Join-Path $PSScriptRoot 'verify-operational-browser-flow.ps1');Invoke-OperationalBrowserReads $taskRoot $evidence $ports $taskAuth.accounts $clinic $branch $point.id }
    if($IncludePortal){ . (Join-Path $PSScriptRoot 'verify-portal-flow.ps1'); Invoke-PortalFlow $evidence $ports $clinic $branch $otherBranch $patient.patientId $reception $tokens }
   Query 'identity' "UPDATE iam.memberships SET status='REVOKED',version=version+1 WHERE clinic_id='$clinic' AND user_id='$doctorUser';"
   $doctorRevoked=Invoke-WebRequest "$base/doctor/worklist" -Headers $doctorHeaders -SkipHttpErrorCheck
   if($doctorRevoked.StatusCode -ne 403){throw 'Doctor token bypassed next-request membership revoke'}
   @{status='PASS';directory='DOCTOR_WORK-branch-grants';lifecycle='start-await-results-retire-ticket-requeue-call-resume-same-encounter';replay='same-key-no-duplicate-event-or-ticket';audit='12-exact-events-including-S2';doctorRevoke=403;boundary=$taskIdentityMode} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence 'care-flow-summary.json') -Encoding utf8
  }

  if($IncludeRealIdentity -and $IncludeBilling){Query 'identity' "UPDATE iam.memberships SET status='REVOKED',version=version+1 WHERE clinic_id='$clinic' AND role='CASHIER';";$cashierRevoked=Invoke-WebRequest "http://127.0.0.1:$($ports.billing)/api/v2/clinics/$clinic/branches/$branch/bills" -Headers @{Authorization="Bearer $($tokens.stranger)"} -SkipHttpErrorCheck;if($cashierRevoked.StatusCode -ne 403){throw 'Final Billing session bypassed next-request revoke'};$result=Get-Content (Join-Path $evidence 'billing-flow-summary.json') -Raw|ConvertFrom-Json;$result.revoke=403;$result|ConvertTo-Json|Set-Content (Join-Path $evidence 'billing-flow-summary.json')}
  $denied=Invoke-WebRequest "http://127.0.0.1:$($ports.encounter)/api/v2/clinics/$clinic/branches/$otherBranch/service-points" -Headers $headers -SkipHttpErrorCheck
  if($denied.StatusCode -ne 403){throw 'Ungrant branch was not denied'}
  Query 'identity' "UPDATE iam.memberships SET status='REVOKED',version=version+1 WHERE clinic_id='$clinic' AND user_id='$reception';"
  $revoked=Invoke-WebRequest "$base/service-points" -Headers $headers -SkipHttpErrorCheck;if($revoked.StatusCode -ne 403){throw 'Existing staff token bypassed membership revoke'}

  @{status='PASS';legacyIdentity=$taskIdentityMode;v2Identity='real-runtime-service';clinicDirectory='branch-scoped';patient='provisional-replay-and-suggestions';walkIn='no-appointment-one-check-in-ticket';doctor='assigned-worklist-start';bookingArrival=$(if($IncludeRealIdentity){'actual-Public-browser-booking-replay'}else{'declared-seeded-confirmed-booking-replay'});exception=$(if($IncludeRealIdentity){'future-late-denied-source-absence-exception'}else{'late-replay-manual-contact-mode'});audit='six-exact-events-real-consumer-before-lifecycle';recovery='own-server-receipt-after-browser-loss';absence='source-interval-replay-bulk-and-background-impact-keeps-booking';branchDenied=$denied.StatusCode;revokeDenied=$revoked.StatusCode} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidence 'reception-flow-summary.json') -Encoding utf8
  if($IncludeRealIdentity){@{clinic=$clinic;branch=$branch;patientId=$patient.patientId;owner=$taskAuth.accounts.owner;reception=$taskAuth.accounts.reception}|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $sandbox 'restore-app-config.json')}
 }finally{foreach($child in $children){if(-not $child.HasExited){Stop-Process -Id $child.Id -Force -ErrorAction SilentlyContinue}}}
}










