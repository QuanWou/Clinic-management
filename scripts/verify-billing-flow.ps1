function Invoke-BillingFlow{
 param($evidence,$ports,$databasePort,$PostgresBin,$clinic,$branch,$owner,$tokens,$walkId,$bookedId)
 # Reassign only the unassigned fixture account after clinical denial checks.
 Query 'identity' "UPDATE iam.memberships SET role='STAFF',version=version+1 WHERE clinic_id='$clinic' AND user_id='$stranger' AND role='DOCTOR';"
 $cashier=@{Authorization="Bearer $($tokens.stranger)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $approver=@{Authorization="Bearer $($tokens.owner)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $base="http://127.0.0.1:$($ports.billing)/api/clinics/$clinic/branches/$branch"
 $directory=Invoke-RestMethod "http://127.0.0.1:$($ports.clinic)/api/clinics/$clinic/billing-directory" -Headers $cashier
 if(@($directory.branches).Count -ne 1 -or $directory.branches[0].id -ne $branch){throw 'Billing directory leaked branch scope'}
 $visits=Invoke-RestMethod "http://127.0.0.1:$($ports.encounter)/api/clinics/$clinic/branches/$branch/billable-visits" -Headers $cashier
 if(@($visits | Where-Object { $_.id -in @($walkId,$bookedId) }).Count -ne 2){throw 'Billable completed visits missing'}
 $issueBody=@{encounterId=$walkId;reason='Synthetic onsite bill from completed walk-in'}
 $walk=Post "$base/bills" $cashier $issueBody;$walkReplay=Post "$base/bills" $cashier $issueBody
 if($walk.id -ne $walkReplay.id -or $walk.subtotalVnd -ne 100000 -or @($walk.lines).Count -ne 1){throw 'Walk-in bill source snapshot/replay failed'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$booked=Post "$base/bills" $cashier @{encounterId=$bookedId;reason='Synthetic booked consultation plus performed lab'}
 if(@($booked.lines).Count -ne 2 -or @($booked.lines | Where-Object sourceType -eq 'APPOINTMENT').Count -ne 1){throw 'Booked consultation charge was not preserved alongside actual lab'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$shift=Post "$base/collection-shifts" $cashier @{reason='Synthetic cashier shift'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$body=@{expectedVersion=$walk.version;shiftId=$shift.id;amountVnd=40000;method='CASH';reason='Synthetic partial cash received'}
 $receipt=Post "$base/bills/$($walk.id)/payments" $cashier $body;$receiptReplay=Post "$base/bills/$($walk.id)/payments" $cashier $body
 if($receipt.id -ne $receiptReplay.id -or $receipt.label -notlike '*KHÔNG PHẢI HÓA ĐƠN THUẾ*'){throw 'Internal receipt or cash replay failed'}
 $current=Invoke-RestMethod "$base/bills/$($walk.id)" -Headers $cashier
 if($current.status -ne 'PARTIALLY_PAID' -or $current.remainingVnd -ne 60000){throw 'Partial bill balance incorrect'}
 $denied=Invoke-WebRequest "$base/bills/$($walk.id)/adjustments" -Method Post -Headers $cashier -ContentType 'application/json' -Body (@{expectedVersion=$current.version;amountVnd=20000;reason='Cashier cannot approve reduction'}|ConvertTo-Json) -SkipHttpErrorCheck
 if($denied.StatusCode -ne 403){throw 'Cashier approved financial adjustment'}
 $adjusted=Post "$base/bills/$($walk.id)/adjustments" $approver @{expectedVersion=$current.version;amountVnd=20000;reason='Synthetic Owner approved reduction'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$null=Post "$base/bills/$($walk.id)/payments" $cashier @{expectedVersion=$adjusted.version;shiftId=$shift.id;amountVnd=40000;method='POS';externalRef='SYN-POS-001';reason='Synthetic terminal-confirmed tender'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$null=Post "$base/bills/$($booked.id)/payments" $cashier @{expectedVersion=$booked.version;shiftId=$shift.id;amountVnd=$booked.remainingVnd;method='BANK_TRANSFER';externalRef='SYN-BANK-001';reason='Synthetic bank-confirmed onsite tender'}
 $current=Invoke-RestMethod "$base/bills/$($walk.id)" -Headers $cashier
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$overpay=Invoke-WebRequest "$base/bills/$($walk.id)/payments" -Method Post -Headers $cashier -ContentType 'application/json' -Body (@{expectedVersion=$current.version;shiftId=$shift.id;amountVnd=1;method='CASH';reason='Overpayment must fail'}|ConvertTo-Json) -SkipHttpErrorCheck
 if($overpay.StatusCode -ne 409){throw 'Paid bill silently accepted overpayment'}
 $cashier['Idempotency-Key']=[guid]::NewGuid().ToString();$submitted=Post "$base/collection-shifts/$($shift.id)/submit" $cashier @{expectedVersion=$shift.version;declaredCashVnd=39900;declaredBankVnd=$booked.remainingVnd;declaredPosVnd=40000;reason='Synthetic counted cash variance'}
 if($submitted.varianceVnd -ne -100){throw 'Shift variance does not match immutable payments'}
 $approver['Idempotency-Key']=[guid]::NewGuid().ToString();$approved=Post "$base/collection-shifts/$($shift.id)/approve" $approver @{expectedVersion=$submitted.version;reason='Synthetic variance reviewed by separate approver'}
 if($approved.state -ne 'APPROVED'){throw 'Separate approver could not close onsite shift'}
 Poll{
  $count="SELECT count(*) FROM audit_v2.audit_events WHERE resource_type='billing' AND metadata_json::jsonb->>'billingId' IN ('$($walk.id)','$($booked.id)','$($shift.id)');" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
  $LASTEXITCODE -eq 0 -and [int]$count -eq 8
 } 'eight exact Billing audit effects'
 $bad="SELECT count(*) FROM (SELECT journal_id,sum(CASE WHEN side='D' THEN amount_vnd ELSE -amount_vnd END) balance FROM billing_v2.journal_lines GROUP BY journal_id) t WHERE balance<>0;" | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_billing_sandbox
 if($LASTEXITCODE -ne 0 -or [int]$bad -ne 0){throw 'Onsite posted ledger is not balanced'}
 if(-not $IncludeRealIdentity){ Query 'identity' "UPDATE iam.memberships SET status='REVOKED',version=version+1 WHERE clinic_id='$clinic' AND role='STAFF';"
 $revoked=Invoke-WebRequest "$base/bills" -Headers $cashier -SkipHttpErrorCheck;if($revoked.StatusCode -ne 403){throw 'Billing session bypassed next-request revoke'}}
 @{status='PASS';sources='real-completed-Encounter-immutable-Medical-booking-price';charges='one-walk-in-lab-and-booked-consultation-plus-lab';collections='partial-cash-POS-bank-onsite-only';receipt='internal-not-tax-invoice';adjustment='Owner-approved-cashier-denied';overpayment=409;shiftVariance=-100;shift='separate-approver';ledger='balanced-append-only';audit='eight-exact-events';revoke=$(if($IncludeRealIdentity){'DEFERRED_TO_FINAL_INTEGRATED_CHECK'}else{403});onlinePayment='DISABLED'} | ConvertTo-Json | Set-Content (Join-Path $evidence 'billing-flow-summary.json')
}


