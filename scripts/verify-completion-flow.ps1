function Invoke-CompletionFlow{
 param($taskRoot,$evidence,$ports,$databasePort,$PostgresBin,$clinic,$branch,$owner,$tokens,$walk,$arrival,$point)
 $base="http://127.0.0.1:$($ports.encounter)/api/clinics/$clinic/branches/$branch"
 $medical="http://127.0.0.1:$($ports.medical)/api/clinics/$clinic/branches/$branch"
 $doctorHeaders=@{Authorization="Bearer $($tokens.doctor)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $receptionHeaders=@{Authorization="Bearer $($tokens.reception)"}
 $readiness=Invoke-RestMethod "$medical/visits/$($walk.id)/readiness" -Headers $doctorHeaders
 if(-not $readiness.ready -or $readiness.status -ne 'VALIDATED' -or $readiness.PSObject.Properties.Name -contains 'content'){throw 'Readiness proof is invalid or contains clinical content'}
 $active=Invoke-RestMethod "$base/doctor/visits/$($walk.id)" -Headers $doctorHeaders
 $completeBody=@{expectedVersion=$active.version;medicalCaseVersion=$readiness.caseVersion;reason='Synthetic unsigned completion'}
 $completed=Post "$base/doctor/visits/$($walk.id)/complete" $doctorHeaders $completeBody
 $replay=Post "$base/doctor/visits/$($walk.id)/complete" $doctorHeaders $completeBody
 if($completed.status -ne 'CLINICALLY_COMPLETED' -or $completed.ticket -or $replay.version -ne $completed.version){throw 'Walk-in completion did not retire its ticket exactly once'}
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$closeBody=@{expectedVersion=$completed.version;reason='Synthetic operational closure'}
 $closed=Post "$base/doctor/visits/$($walk.id)/close" $doctorHeaders $closeBody
 $closedReplay=Post "$base/doctor/visits/$($walk.id)/close" $doctorHeaders $closeBody
 if($closed.status -ne 'CLOSED' -or $closed.version -ne $closedReplay.version -or $closed.appointmentId){throw 'Walk-in closure altered arrival identity'}
 # Bring the previously skipped booked visit back through the real reception queue.
 $queue=Invoke-RestMethod "$base/queue?servicePointId=$($point.id)&date=$([DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd'))" -Headers $receptionHeaders
 $old=@($queue | Where-Object { $_.visitId -eq $arrival.id -and $_.state -eq 'SKIPPED' })[0]
 if(-not $old){throw 'Skipped booked ticket missing'}
 $null=Post "$base/queue/$($old.id)/transfer" $receptionHeaders @{expectedVersion=$old.version;reason='Synthetic booked return';destinationPointId=$point.id}
 $current=Invoke-RestMethod "$base/doctor/visits/$($arrival.id)" -Headers $doctorHeaders
 $null=Post "$base/queue/$($current.ticket.id)/call" $receptionHeaders @{expectedVersion=$current.ticket.version;reason='Synthetic booked call'}
 $current=Invoke-RestMethod "$base/doctor/visits/$($arrival.id)" -Headers $doctorHeaders
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString()
 $current=Post "$base/doctor/visits/$($arrival.id)/start" $doctorHeaders @{expectedVersion=$current.version;reason='Synthetic booked care'}
 Invoke-MedicalFlow $taskRoot $evidence $ports $databasePort $PostgresBin $clinic $branch $owner $tokens $arrival.id
 $proof=Invoke-RestMethod "$medical/visits/$($arrival.id)/readiness" -Headers $doctorHeaders
 $wrongPeer=Invoke-WebRequest "http://127.0.0.1:$($ports.appointment)/api/internal/clinics/$clinic/branches/$branch/appointments/$($arrival.appointmentId)/fulfillment" -Method Post -Headers $doctorHeaders -ContentType 'application/json' -Body (@{eventId=[guid]::NewGuid().ToString();encounterId=$arrival.id;actorUserId=$owner}|ConvertTo-Json) -SkipHttpErrorCheck
 if($wrongPeer.StatusCode -ne 403){throw 'User token bypassed source fulfillment peer guard'}
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString()
 $completed=Post "$base/doctor/visits/$($arrival.id)/complete" $doctorHeaders @{expectedVersion=$current.version;medicalCaseVersion=$proof.caseVersion;reason='Synthetic booked completion'}
 Poll{
  $count="SELECT count(*) FROM appointment_v2.appointments WHERE id='$($arrival.appointmentId)' AND status='FULFILLED' AND encounter_id='$($arrival.id)' AND fulfilled_at IS NOT NULL;" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_appointment_sandbox
  $LASTEXITCODE -eq 0 -and [int]$count -eq 1
 } 'durable booked fulfillment acknowledgement'
 Poll{
  $count="SELECT count(*) FROM audit_v2.audit_events WHERE action='clinic.encounter.clinically_completed.v1' AND resource_id IN ('$($walk.id)','$($arrival.id)');" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
  $LASTEXITCODE -eq 0 -and [int]$count -eq 2
 } 'both clinical completion audit effects'
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$null=Post "$base/doctor/visits/$($arrival.id)/close" $doctorHeaders @{expectedVersion=$completed.version;reason='Synthetic booked closure'}
 @{status='PASS';walkIn='validated-unsigned-complete-close-replay-no-appointment';booked='same-arrival-lab-review-validation-completion-FULFILLED';fulfillmentGuard=403;delivery='independent-Appointment-ACK-and-Audit';signature='DISABLED';release='DISABLED';onlinePayment='DISABLED'} | ConvertTo-Json | Set-Content (Join-Path $evidence 'completion-flow-summary.json')
}
