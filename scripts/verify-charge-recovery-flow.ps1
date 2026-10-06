function Invoke-ChargeRecoveryFlow {
 param($evidence,$ports,$clinic,$branch,$tokens)
 # Simulate a lost acknowledgement only on this run's own synthetic deliveries.
 # Retry commands must preserve the exact event and performed-price snapshot.
 $owner=@{Authorization="Bearer $($tokens.owner)"};$denied=@{Authorization="Bearer $($tokens.doctor)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 foreach($source in @('medical','encounter','billing')){
  $table=if($source -eq 'billing'){'charge_event_inbox'}else{'billing_deliveries'}
  $schema="${source}_v2"
  $payload=ChargeQuery $source "SELECT payload_json::text FROM $schema.$table WHERE clinic_id='$clinic' AND branch_id='$branch' ORDER BY event_id LIMIT 1;"
  $original=$payload|ConvertFrom-Json;$encounter=$original.data.encounterId;$eventId=$original.id
  $route=if($source -eq 'billing'){'source-charges'}else{'billing-deliveries'}
  $url="http://127.0.0.1:$($ports[$source])/api/clinics/$clinic/branches/$branch/encounters/$encounter/$route"
  Query $source "UPDATE $schema.$table SET status='DLQ',attempts=8,last_error='SYNTHETIC_LOST_ACK' WHERE event_id='$eventId';"
  $state=Invoke-RestMethod $url -Headers $owner
  if(@($state.events|Where-Object {$_.eventId -eq $eventId -and $_.status -eq 'DLQ'}).Count -ne 1){throw 'Failed charge delivery was not visible in its own source scope'}
  $text=$state|ConvertTo-Json -Depth 6;if($text.Contains('payload_json') -or $text.Contains('patientRef') -or $text.Contains('content')){throw 'Charge recovery exposed source/clinical payload'}
  $wrong=Invoke-WebRequest "$url/$eventId/retry" -Method Post -Headers $denied -ContentType 'application/json' -Body '{"reason":"Synthetic denied retry"}' -SkipHttpErrorCheck;if($wrong.StatusCode -ne 403){throw 'Non-manager reset a failed charge delivery'}
  $owner['Idempotency-Key']=[guid]::NewGuid().ToString();$reason=@{reason='Synthetic investigated connection and lost acknowledgement'}
  $null=Post "$url/$eventId/retry" $owner $reason
  $target=if($source -eq 'billing'){'APPLIED'}else{'PUBLISHED'}
  Poll { (ChargeQuery $source "SELECT status FROM $schema.$table WHERE event_id='$eventId';") -eq $target } "$source unchanged charge recovery"
  $null=Post "$url/$eventId/retry" $owner $reason
  $changed=Invoke-WebRequest "$url/$eventId/retry" -Method Post -Headers $owner -ContentType 'application/json' -Body '{"reason":"Synthetic changed request"}' -SkipHttpErrorCheck;if($changed.StatusCode -ne 409){throw 'Charge recovery key accepted changed payload'}
  if([int](ChargeQuery $source "SELECT count(*) FROM $schema.charge_recovery_commands WHERE event_id='$eventId';") -ne 1){throw 'Charge replay duplicated recovery command'}
  $after=ChargeQuery $source "SELECT payload_json::text FROM $schema.$table WHERE event_id='$eventId';"
  if($payload -ne $after){throw 'Recovery changed the original source event'}
  $type="clinic.$source.$(if($source -eq 'billing'){'charge'}else{'billing'})_retry_requested.v1"
  Poll { [int](ChargeQuery 'audit' "SELECT count(*) FROM audit_v2.audit_events WHERE clinic_id='$clinic' AND branch_id='$branch' AND action='$type';") -eq 1 } "$source one acknowledged recovery audit effect"
 }
 if([int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.charges WHERE clinic_id='$clinic' AND amount_vnd=100000;") -ne 3 -or [int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.bills WHERE clinic_id='$clinic';") -ne 0 -or [int](ChargeQuery 'billing' "SELECT count(*) FROM billing_v2.journals WHERE clinic_id='$clinic';") -ne 0){throw 'Charge recovery duplicated charges, repriced service or posted money'}
 @{status='PASS';sources=@('Medical','Encounter','Billing');fault='synthetic-lost-ack-own-deliveries';retry='actual-manager-API-same-event-and-key';wrongRole=403;changedPayload=409;recoveryCommands=3;recoveryAuditEffects=3;frozenChargeCount=3;frozenPriceVnd=100000;billCount=0;journalCount=0;clinicalState='unchanged';identity=$taskIdentityMode}|ConvertTo-Json|Set-Content (Join-Path $evidence 'charge-recovery-summary.json')
}
