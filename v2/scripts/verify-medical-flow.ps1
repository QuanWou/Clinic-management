function Invoke-MedicalFlow{
 param($taskRoot,$evidence,$ports,$databasePort,$PostgresBin,$clinic,$branch,$owner,$tokens,$encounterId)
 $offering=[guid]::NewGuid().ToString();$assignment=[guid]::NewGuid().ToString();$price=[guid]::NewGuid().ToString()
 Query 'catalog' @"
INSERT INTO catalog_v2.offerings(id,clinic_id,code,name) VALUES('$offering','$clinic','SYN-LAB-$($offering.Substring(0,8))','Synthetic Internal Lab');
INSERT INTO catalog_v2.branch_offerings(id,clinic_id,branch_id,offering_id,duration_minutes) VALUES('$assignment','$clinic','$branch','$offering',30);
INSERT INTO catalog_v2.price_versions(id,clinic_id,branch_id,offering_id,branch_offering_id,amount_vnd,effective_from,created_by) VALUES('$price','$clinic','$branch','$offering','$assignment',100000,now()-interval '1 hour','$owner');
"@
 $base="http://127.0.0.1:$($ports.medical)/api/v2/clinics/$clinic/branches/$branch"
 $doctorHeaders=@{Authorization="Bearer $($tokens.doctor)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $labHeaders=@{Authorization="Bearer $($tokens.stranger)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $note=@{reasonForVisit='Synthetic confidential chief complaint';medicalHistory='Synthetic history';allergies='Synthetic allergies';vitals='Synthetic values';examination='Synthetic exam';preliminaryDiagnosis='Synthetic preliminary';conclusion='Synthetic conclusion';instructions='Synthetic instructions';followUpDate=$null}
 $draftBody=@{expectedDocumentVersion=0;content=$note;reason='Synthetic explicit save'}
 if($IncludeAftercare){$note.followUpDate=(Get-Date).Date.AddDays(7).ToString('yyyy-MM-dd')}
 $draft=Invoke-RestMethod "$base/visits/$encounterId/draft" -Method Put -Headers $doctorHeaders -ContentType 'application/json' -Body ($draftBody | ConvertTo-Json)
 $replay=Invoke-RestMethod "$base/visits/$encounterId/draft" -Method Put -Headers $doctorHeaders -ContentType 'application/json' -Body ($draftBody | ConvertTo-Json)
 if($draft.documentVersion -ne 1 -or $replay.documentVersion -ne 1){throw 'Medical immutable draft replay failed'}
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString()
 $order=Post "$base/visits/$encounterId/orders" $doctorHeaders @{expectedCaseVersion=$draft.caseVersion;offeringId=$offering;reason='Synthetic internal lab request'}
 if($order.state -ne 'ORDERED' -or $order.name -ne 'Synthetic Internal Lab'){throw 'Medical order did not use private Catalog source'}
 $labQueue=Invoke-RestMethod "$base/lab/orders" -Headers $labHeaders;if(@($labQueue | Where-Object id -eq $order.id).Count -ne 1){throw 'Canonical LAB worklist unavailable'}
 $order=Post "$base/orders/$($order.id)/accept" $labHeaders @{expectedVersion=$order.version;reason='Synthetic acceptance'}
 $labHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$order=Post "$base/orders/$($order.id)/process" $labHeaders @{expectedVersion=$order.version;reason='Synthetic processing'}
 $labHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$resultBody=@{expectedVersion=$order.version;sourceRef='SYNTHETIC-LAB-001';content='Synthetic confidential authenticated result';reason='Synthetic result authorship'}
 $order=Post "$base/orders/$($order.id)/results" $labHeaders $resultBody;$resultReplay=Post "$base/orders/$($order.id)/results" $labHeaders $resultBody
 if($order.result.id -ne $resultReplay.result.id -or $order.state -ne 'RESULTED'){throw 'Result replay duplicated authorship'}
 $current=Invoke-RestMethod "$base/visits/$encounterId/draft" -Headers $doctorHeaders
 $premature=Invoke-WebRequest "$base/visits/$encounterId/validate" -Method Post -Headers $doctorHeaders -ContentType 'application/json' -Body (@{expectedVersion=$current.caseVersion;reason='Unreviewed result must block validation'} | ConvertTo-Json) -SkipHttpErrorCheck
 if($premature.StatusCode -ne 409){throw 'Unreviewed result was allowed to validate'}
 $doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString();$order=Post "$base/orders/$($order.id)/reviews" $doctorHeaders @{expectedVersion=$order.version;resultVersion=$order.resultVersion;reason='Synthetic assigned doctor review'}
 if($order.state -ne 'REVIEWED'){throw 'Assigned doctor could not review authenticated result'}
 $current=Invoke-RestMethod "$base/visits/$encounterId/draft" -Headers $doctorHeaders;$doctorHeaders['Idempotency-Key']=[guid]::NewGuid().ToString()
 $validated=Post "$base/visits/$encounterId/validate" $doctorHeaders @{expectedVersion=$current.caseVersion;reason='Synthetic unsigned validation'}
 if($validated.status -ne 'VALIDATED'){throw 'Unsigned clinical validation failed'}
 $denied=Invoke-WebRequest "$base/visits/$encounterId/draft" -Headers $labHeaders -SkipHttpErrorCheck
 if($denied.StatusCode -ne 403){throw 'LAB accessed doctor-only clinical draft'}
 Poll{
  $sql="SELECT count(*) FROM audit_v2.audit_events WHERE resource_type='medical' AND metadata_json::jsonb->>'encounterId'='$encounterId';"
  $count=$sql | & (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox
  $LASTEXITCODE -eq 0 -and [int]$count -eq 7
 } 'seven exact Medical audit effects'
 @{status='PASS';draft='immutable-version-one-same-key-replay';order='private-Catalog-name-and-price-snapshot';result='canonical-LAB-author-scope-result-replay';review='assigned-DOCTOR-unreviewed-blocks-validation';labDraftDenied=403;audit='seven-exact-identifier-only-events';signature='DISABLED';release='DISABLED'} | ConvertTo-Json | Set-Content (Join-Path $evidence 'medical-flow-summary.json')
}
