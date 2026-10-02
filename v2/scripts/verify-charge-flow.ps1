function Invoke-ChargeFlow {
 param($evidence,$ports,$databasePort,$PostgresBin,$clinic,$branch,$tokens,$secret)
 function ChargeQuery([string]$service,[string]$sql){
  $value=$sql | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d "clinic_v2_s1_${service}_sandbox" -v ON_ERROR_STOP=1
  if($LASTEXITCODE -ne 0){throw 'Source charge verification query failed'};return $value
 }
 function ChargeToken([string]$issuer,[string]$audience,[string]$scope){
  $encode={param([byte[]]$bytes) [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+','-').Replace('/','_')}
  $now=[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $header=& $encode ([Text.Encoding]::UTF8.GetBytes('{"alg":"HS256","typ":"JWT"}'))
  $body=& $encode ([Text.Encoding]::UTF8.GetBytes((@{iss=$issuer;sub=$issuer;aud=@($audience);jti=[guid]::NewGuid().ToString();token_type='workload';scopes=@($scope);iat=$now;exp=$now+30}|ConvertTo-Json -Compress)))
  $unsigned="$header.$body";$mac=[Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($secret))
  try{$signature=& $encode ($mac.ComputeHash([Text.Encoding]::UTF8.GetBytes($unsigned)))}finally{$mac.Dispose()}
  return "$unsigned.$signature"
 }
 Poll { [int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.charge_event_inbox WHERE clinic_id='$clinic' AND branch_id='$branch' AND status='APPLIED';") -eq 4 } 'two reviewed orders and two completed encounters reconciled'
 foreach($producer in @('medical','encounter')){
  Poll { [int](ChargeQuery $producer "SELECT count(*) FROM ${producer}_v2.billing_deliveries WHERE clinic_id='$clinic' AND status='PUBLISHED';") -eq 2 } "$producer independent Billing acknowledgement"
  if([int](ChargeQuery $producer "SELECT count(*) FROM ${producer}_v2.billing_deliveries d JOIN ${producer}_v2.outbox_events o ON o.event_id=d.event_id WHERE d.clinic_id='$clinic' AND o.status='PUBLISHED';") -ne 2){throw 'Original Audit delivery was not independently acknowledged'}
 }
 if([int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.charges WHERE clinic_id='$clinic';") -ne 3){throw 'Imported source charges duplicated or missing'}
 if([int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.bills WHERE clinic_id='$clinic';") -ne 0 -or [int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.journals WHERE clinic_id='$clinic';") -ne 0){throw 'Source import issued a bill or posted money'}
 # Original JSON must retain source timestamps for an exact replay.
 $raw=ChargeQuery 'medical' "SELECT payload_json FROM medical_v2.billing_deliveries WHERE clinic_id='$clinic' ORDER BY created_at LIMIT 1;"
 $event=$raw|ConvertFrom-Json;$eventUrl="http://127.0.0.1:$($ports.billing)/api/v2/internal/charges/events"
 $peer=@{Authorization=('Bearer '+(ChargeToken 'medical-v2-service' 'billing-v2-service' 'billing.charge.consume'))}
 $replay=Invoke-RestMethod $eventUrl -Method Post -Headers $peer -ContentType 'application/json' -Body $raw
 if($replay.received -or $replay.eventId -ne $event.id){throw 'Actual source event replay duplicated ingestion'}
 $changed=$raw -replace '"actorUserId":"[^"]+"',('"actorUserId":"'+[guid]::NewGuid().ToString()+'"')
 $changedReplay=Invoke-WebRequest $eventUrl -Method Post -Headers $peer -ContentType 'application/json' -Body $changed -SkipHttpErrorCheck
 if($changedReplay.StatusCode -ne 409){throw 'Source charge changed replay accepted'}
 $wrong=@{Authorization=('Bearer '+(ChargeToken 'encounter-v2-service' 'billing-v2-service' 'billing.charge.consume'))}
 $producerDenied=Invoke-WebRequest $eventUrl -Method Post -Headers $wrong -ContentType 'application/json' -Body $raw -SkipHttpErrorCheck
 if($producerDenied.StatusCode -ne 403){throw 'Producer could impersonate another source'}
 $proofUrl="http://127.0.0.1:$($ports.medical)/api/v2/internal/clinics/$clinic/branches/$branch/orders/$($event.data.resourceId)/billing-sync-proof"
 $billingPeer=@{Authorization=('Bearer '+(ChargeToken 'billing-v2-service' 'medical-v2-service' 'billing.source.sync'))}
 $proof=Invoke-RestMethod $proofUrl -Headers $billingPeer
 if($proof.id -ne $event.data.resourceId -or $proof.state -ne 'REVIEWED' -or $proof.price.amountVnd -ne 100000 -or $proof.PSObject.Properties.Name -contains 'content' -or $proof.PSObject.Properties.Name -contains 'result'){throw 'Reviewed source proof missing or leaked clinical content'}
 $userDenied=Invoke-WebRequest $proofUrl -Headers @{Authorization="Bearer $($tokens.owner)"} -SkipHttpErrorCheck
 if($userDenied.StatusCode -ne 403){throw 'User token bypassed source sync peer guard'}
 # Append a real Catalog price version; imported performed charges retain their original version.
 $price=Post "http://127.0.0.1:$($ports.catalog)/api/v2/clinics/$clinic/branches/$branch/price-versions" @{Authorization="Bearer $($tokens.owner)"} @{offeringId=$proof.offeringId;amountVnd=120000;effectiveFrom=[DateTimeOffset]::UtcNow.ToString('o')}
 if($price.amountVnd -ne 120000 -or [int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.charges WHERE clinic_id='$clinic' AND amount_vnd=100000;") -ne 3){throw 'Current price change rewrote frozen performed charges'}
 . (Join-Path $PSScriptRoot 'verify-charge-recovery-flow.ps1');Invoke-ChargeRecoveryFlow $evidence $ports $clinic $branch $tokens
 @{status='PASS';sourceEvents=4;sourceCharges=3;billsBeforeCashier=0;journalsBeforeCashier=0;producerDelivery='separate-Billing-and-Audit-ACK';ingressReplay='same-id-one-effect';changedReplay=$changedReplay.StatusCode;wrongProducer=$producerDenied.StatusCode;userSourceProof=$userDenied.StatusCode;price='new-Catalog-120000-imported-100000-immutable';identity=$taskIdentityMode;payment='no-deposit-no-online-collection'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'charge-flow-summary.json')
}
