function Invoke-FinancialFlow {
 param($evidence,$ports,$databasePort,$PostgresBin,$clinic,$branch,$userId,$tokens,$secret)
 function FinancialCount([string]$sql,[string]$service){
  $result=$sql | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d "clinic_v2_s1_${service}_sandbox"
  if($LASTEXITCODE -ne 0){throw 'Financial verification query failed'};return [int]$result
 }
 Poll { (FinancialCount "SELECT count(*) FROM billing_v2.notification_deliveries WHERE clinic_id='$clinic' AND status='DELIVERED' AND recipient_user_id='$userId';" 'billing') -eq 6 } 'six independently acknowledged financial notifications'
 $url="http://127.0.0.1:$($ports.notification)/api"
 $mine=Invoke-RestMethod "$url/me/notifications" -Headers @{Authorization="Bearer $($tokens.reception)"}
 $financial=@($mine|Where-Object { $_.billing_id })
 if($financial.Count -ne 6 -or @($financial|Where-Object kind -eq 'PAYMENT_RECORDED').Count -ne 3){throw 'Owned financial notifications missing'}
 $other=Invoke-RestMethod "$url/me/notifications" -Headers @{Authorization="Bearer $($tokens.stranger)"}
 if(@($other|Where-Object { $_.billing_id }).Count -ne 0){throw 'Cashier received patient financial notifications'}
 foreach($row in $financial){if($row.appointment_id -or $row.message -match '100000|200000|40000|confidential|Synthetic performed'){throw 'Financial preview contains money, care detail or fake appointment resource'}}
 $raw="SELECT payload_json FROM billing_v2.outbox_events WHERE clinic_id='$clinic' AND event_type='clinic.billing.bill_issued.v1' ORDER BY created_at LIMIT 1;" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_billing_sandbox
 if($LASTEXITCODE -ne 0){throw 'Financial source envelope unavailable'}
 $event=$raw|ConvertFrom-Json;$bill=$event.data.billingId;$eventId=$event.id
 # Preserve source time/correlation JSON exactly for a lost-ACK retry.
 $payload=$raw -replace '"actorUserId":"[^"]+"',('"recipientUserId":"'+$userId+'"')
 $encode={param([byte[]]$bytes) [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')}
 $now=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
 $jwtHeader=& $encode ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
 $jwtBody=& $encode ([Text.Encoding]::UTF8.GetBytes((@{iss='billing-service';sub='billing-service';aud=@('notification-service');jti=[guid]::NewGuid().ToString();token_type='workload';scopes=@('notification.billing.consume');iat=$now;exp=$now+30}|ConvertTo-Json -Compress)))
 $unsigned="$jwtHeader.$jwtBody";$mac=[Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
 try{$signature=& $encode ($mac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))}finally{$mac.Dispose()}
 $peer=@{Authorization="Bearer $unsigned.$signature"}
 $replay=Invoke-RestMethod "$url/internal/notifications/billing-events" -Method Post -Headers $peer -ContentType 'application/json' -Body $payload
 if($replay.applied -or $replay.eventId -ne $eventId){throw 'Financial receiver replay created an additional effect'}
 $changed=$payload.Replace($userId,[guid]::NewGuid().ToString());$bad=Invoke-WebRequest "$url/internal/notifications/billing-events" -Method Post -Headers $peer -ContentType 'application/json' -Body $changed -SkipHttpErrorCheck
 if($bad.StatusCode -ne 400){throw 'Financial receiver accepted changed event recipient'}
 $wrong=Invoke-WebRequest "$url/internal/notifications/events" -Method Post -Headers $peer -ContentType 'application/json' -Body $payload -SkipHttpErrorCheck
 if($wrong.StatusCode -ne 403){throw 'Financial peer bypassed Appointment notification endpoint scope'}
 $base="http://127.0.0.1:$($ports.billing)/api/clinics/$clinic/branches/$branch/bills/$bill"
 $owner=@{Authorization="Bearer $($tokens.owner)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $before=Invoke-RestMethod $base -Headers $owner
 # Synthetic lost sender ACK after the receiver committed. Retain the original event/recipient/payload.
 Query 'billing' "UPDATE billing_v2.notification_deliveries SET status='DLQ',attempts=5,delivered_at=null,last_error='SYNTHETIC_LOST_ACK' WHERE event_id='$eventId';"
 $body=@{reason='Synthetic lost sender acknowledgement recovery'}
 $denied=Invoke-WebRequest "$base/notification-deliveries/retry" -Method Post -Headers @{Authorization="Bearer $($tokens.reception)";'Idempotency-Key'=[guid]::NewGuid().ToString()} -ContentType 'application/json' -Body ($body|ConvertTo-Json) -SkipHttpErrorCheck
 if($denied.StatusCode -ne 403){throw 'Reception user recovered manager delivery queue'}
 $null=Post "$base/notification-deliveries/retry" $owner $body;$null=Post "$base/notification-deliveries/retry" $owner $body
 Poll { (FinancialCount "SELECT count(*) FROM billing_v2.notification_deliveries WHERE clinic_id='$clinic' AND status='DELIVERED';" 'billing') -eq 6 } 'same six deliveries after manager lost-ACK recovery'
 $after=Invoke-RestMethod $base -Headers $owner
 if($before.paidVnd -ne $after.paidVnd -or $before.remainingVnd -ne $after.remainingVnd -or $before.subtotalVnd -ne $after.subtotalVnd -or $before.adjustmentVnd -ne $after.adjustmentVnd){throw 'Notification recovery changed money'}
 if((FinancialCount "SELECT count(*) FROM notification_v2.notifications WHERE clinic_id='$clinic' AND billing_id IS NOT NULL;" 'notification') -ne 6){throw 'Lost sender ACK duplicated patient message'}
 Poll { (FinancialCount "SELECT count(*) FROM audit_v2.audit_events WHERE action='clinic.billing.notification_retry_requested.v1' AND resource_id='$bill';" 'audit') -eq 1 } 'one exact recovery audit effect'
 @{status='PASS';financialMessages=6;onsiteMessages=3;recipient='actual-Patient-owner-never-cashier';preview='fixed-copy-no-money-care-contact';independentDelivery='Audit-and-Notification-own-ACK';replay='same-event-id-one-effect';changedRecipient=400;wrongEndpointScope=403;managerRecovery='lost-sender-ACK-same-six-messages-money-unchanged';recoveryAudit='one-exact-effect';identity=$taskIdentityMode}|ConvertTo-Json|Set-Content (Join-Path $evidence 'financial-flow-summary.json')
}
