function Invoke-AftercareFlow {
 param($evidence,$ports,$clinic,$branch,$patientId,$userId,$doctorId,$owner,$tokens,$encounterId,$oldBooking)
 if(-not $IncludeRealIdentity){Query 'patient' "INSERT INTO patient_v2.platform_user_patient_links(user_id,patient_id) VALUES('$userId','$patientId') ON CONFLICT(user_id) DO NOTHING;"}
 $user=@{Authorization="Bearer $($tokens.reception)";'Idempotency-Key'=[guid]::NewGuid().ToString()}
 $patientBase="http://127.0.0.1:$($ports.patient)/api/v2"
 if(-not $IncludeRealIdentity){
  $review=Post "$patientBase/clinics/$clinic/branches/$branch/patients/$patientId/review" $user @{expectedVersion=0;identityEvidenceRef='SYNTHETIC-IDENTITY-REVIEW';reason='Synthetic explicit reception identity review'}
  if($review.status -ne 'VERIFIED'){throw 'Aftercare Patient source link was not verified'}
 }
 $profile=Invoke-RestMethod "$patientBase/me/patient-profile" -Headers $user
 $null=Invoke-RestMethod "$patientBase/me/patient-profile" -Method Put -Headers $user -ContentType 'application/json' -Body (@{fullName='Synthetic Patient';dateOfBirth='1990-01-01';expectedVersion=$profile.version}|ConvertTo-Json)
 $plans=Invoke-RestMethod "http://127.0.0.1:$($ports.medical)/api/v2/me/clinics/$clinic/branches/$branch/follow-up-plans" -Headers $user
 $plan=@($plans | Where-Object encounterId -eq $encounterId)[0]
 if(-not $plan -or -not $plan.proposedDate){throw 'Immutable owned Medical follow-up date missing'}
 $text=$plan|ConvertTo-Json;if($text.Contains('confidential') -or $text.Contains('content') -or $text.Contains('patientId')){throw 'Operational plan released note content'}
 $base="http://127.0.0.1:$($ports.appointment)/api/v2"
 $offering=[guid]::NewGuid().ToString();$assignment=[guid]::NewGuid().ToString();$price=[guid]::NewGuid().ToString()
 $body=@{clinicId=$clinic;branchId=$branch;doctorId=$doctorId;offeringId=$offering;slotId=[guid]::NewGuid().ToString();patientId=$patientId;priorEncounterId=$encounterId;priorBranchId=$branch}
 $suspended=Invoke-WebRequest "$base/appointments/follow-up-holds" -Method Post -Headers $user -ContentType 'application/json' -Body ($body|ConvertTo-Json) -SkipHttpErrorCheck
 if($suspended.StatusCode -ne 409){throw 'Unpublished Clinic allowed a new follow-up hold'}
 # Explicit synthetic publication/schedule/catalog fixture, not production approval.
 Query 'clinic' "UPDATE clinic.clinics SET publication_status='PUBLISHED',evidence_verified=true,published_at=now(),row_version=row_version+1 WHERE id='$clinic';"
 Query 'clinic' "INSERT INTO clinic.clinic_licenses(clinic_id,license_number,issuing_authority,scope_summary,evidence_ref,valid_until) VALUES('$clinic','SYNTHETIC-LICENSE','SYNTHETIC-AUTHORITY','SYNTHETIC-SCOPE','SYNTHETIC-EVIDENCE',current_date+365) ON CONFLICT(clinic_id) DO NOTHING;"
 $target=[datetime]::ParseExact($plan.proposedDate,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)
 $weekday=[int]$target.DayOfWeek;if($weekday -eq 0){$weekday=7}
 Query 'doctor' @"
UPDATE doctor.doctor_affiliations SET public_visible=true,row_version=row_version+1 WHERE practitioner_id='$doctorId' AND clinic_id='$clinic' AND branch_id='$branch';
INSERT INTO doctor.working_schedules(id,affiliation_id,practitioner_id,clinic_id,branch_id,day_of_week,start_minute,end_minute,timezone,effective_from,effective_until) SELECT gen_random_uuid(),id,'$doctorId','$clinic','$branch',$weekday,480,1020,'Asia/Ho_Chi_Minh',DATE '$($plan.proposedDate)',DATE '$($plan.proposedDate)'+1 FROM doctor.doctor_affiliations a WHERE practitioner_id='$doctorId' AND clinic_id='$clinic' AND branch_id='$branch' AND NOT EXISTS(SELECT 1 FROM doctor.working_schedules s WHERE s.affiliation_id=a.id AND s.day_of_week=$weekday AND s.start_minute<=480 AND s.end_minute>=1020 AND s.effective_from<=DATE '$($plan.proposedDate)' AND (s.effective_until IS NULL OR s.effective_until>DATE '$($plan.proposedDate)'));
"@
 Query 'catalog' @"
INSERT INTO catalog_v2.offerings(id,clinic_id,code,name) VALUES('$offering','$clinic','SYN-FOLLOWUP','Synthetic new consultation');
INSERT INTO catalog_v2.branch_offerings(id,clinic_id,branch_id,offering_id,duration_minutes,public_visible) VALUES('$assignment','$clinic','$branch','$offering',30,true);
INSERT INTO catalog_v2.price_versions(id,clinic_id,branch_id,offering_id,branch_offering_id,amount_vnd,effective_from,created_by) VALUES('$price','$clinic','$branch','$offering','$assignment',120000,now()-interval '1 hour','$owner');
"@
 $slots=Invoke-RestMethod "$base/public/availability?clinicId=$clinic&branchId=$branch&doctorId=$doctorId&offeringId=$offering&date=$($plan.proposedDate)"
 if($slots.Count -lt 1){throw 'Real follow-up availability is empty'};$body.slotId=$slots[0].slotId
 $wrong=Invoke-WebRequest "$base/appointments/follow-up-holds" -Method Post -Headers @{Authorization="Bearer $($tokens.owner)";'Idempotency-Key'=[guid]::NewGuid().ToString()} -ContentType 'application/json' -Body ($body|ConvertTo-Json) -SkipHttpErrorCheck
 if($wrong.StatusCode -ne 403){throw 'Wrong active user allocated follow-up hold'}
 $user['Idempotency-Key']=[guid]::NewGuid().ToString();$hold=Post "$base/appointments/follow-up-holds" $user $body;$again=Post "$base/appointments/follow-up-holds" $user $body
 if($hold.holdId -ne $again.holdId -or $hold.price.amountVnd -ne 120000){throw 'Follow-up hold did not freeze its own current price'}
 $user['Idempotency-Key']=[guid]::NewGuid().ToString();$confirmed=Post "$base/appointments" $user @{clinicId=$clinic;holdId=$hold.holdId;patientId=$patientId};$replay=Post "$base/appointments" $user @{clinicId=$clinic;holdId=$hold.holdId;patientId=$patientId}
 if($confirmed.id -eq $oldBooking -or $confirmed.id -ne $replay.id -or $confirmed.priorEncounterId -ne $encounterId -or $confirmed.priorBranchId -ne $branch -or $confirmed.price.amountVnd -ne 120000){throw 'New follow-up appointment or prior source link incorrect'}
 $mine=Invoke-RestMethod "$base/me/appointments?clinicId=$clinic&patientId=$patientId" -Headers $user;$old=@($mine | Where-Object id -eq $oldBooking)[0]
 if($old.status -ne 'FULFILLED' -or $old.price.amountVnd -ne 100000){throw 'Follow-up changed the old fulfilled booking or its price'}
 # Restore publication fixture for the private UNPUBLISHED history assertion.
 Query 'clinic' "UPDATE clinic.clinics SET publication_status='UNPUBLISHED',row_version=row_version+1 WHERE id='$clinic';"
 @{status='PASS';source='real-owned-Encounter-completed-Medical-immutable-date';newAppointment='distinct-confirmed-booking-linked-to-prior-visit';newPriceVnd=120000;oldBooking='FULFILLED-price-100000-unchanged';holdReplay='same-id';confirmReplay='same-id';wrongUser=403;unpublishedNewHold=409;clinicalRelease='DISABLED';deposit='NONE';identity=$taskIdentityMode} | ConvertTo-Json | Set-Content (Join-Path $evidence 'aftercare-flow-summary.json')
}
