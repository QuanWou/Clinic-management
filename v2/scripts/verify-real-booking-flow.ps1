function Invoke-RealBookingFlow {
 param($evidence,$ports,$tokens,$clinic,$branch,$doctor,$owner)
 $ownerHeaders=@{Authorization="Bearer $($tokens.owner)"}
 $user=@{Authorization="Bearer $($tokens.reception)"}
 $today=[DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd')
 # Publication evidence is synthetic and isolated; no production qualification is inferred.
 Query 'clinic' "INSERT INTO clinic.clinic_licenses(clinic_id,license_number,issuing_authority,scope_summary,evidence_ref,valid_until) VALUES('$clinic','SYNTHETIC-LICENSE','SYNTHETIC-AUTHORITY','SYNTHETIC-SCOPE','SYNTHETIC-EVIDENCE',current_date+365); UPDATE clinic.clinics SET publication_status='PUBLISHED',evidence_verified=true,published_at=now(),row_version=row_version+1 WHERE id='$clinic';"
 $doctorBase="http://127.0.0.1:$($ports.doctor)/api/v2/clinics/$clinic/branches/$branch/doctor-affiliations"
 $affiliations=Invoke-RestMethod $doctorBase -Headers $ownerHeaders;$affiliation=@($affiliations | Where-Object {$_.practitionerId -eq $doctor})[0]
 if(-not $affiliation){throw 'Actual booking doctor source missing'}
 $null=Invoke-RestMethod "$doctorBase/$($affiliation.id)" -Method Put -Headers $ownerHeaders -ContentType 'application/json' -Body (@{expectedVersion=$affiliation.version;specialtyCode=$affiliation.specialtyCode;specialtyName=$affiliation.specialtyName;effectiveFrom=$affiliation.effectiveFrom;active=$true;publicVisible=$true}|ConvertTo-Json)
 $weekday=[int]([datetime]::ParseExact($today,'yyyy-MM-dd',[Globalization.CultureInfo]::InvariantCulture)).DayOfWeek;if($weekday -eq 0){$weekday=7}
 $null=Post "$doctorBase/$($affiliation.id)/schedules" $ownerHeaders @{dayOfWeek=$weekday;startTime='00:00';endTime='23:59';effectiveFrom=$today;timezone='Asia/Ho_Chi_Minh';active=$true}
 $catalog="http://127.0.0.1:$($ports.catalog)/api/v2/clinics/$clinic"
 $offering=Post "$catalog/offerings" $ownerHeaders @{code='SYN-CONSULT';name='Synthetic booked consultation';active=$true}
 $null=Post "$catalog/branches/$branch/offerings" $ownerHeaders @{offeringId=$offering.id;durationMinutes=30;active=$true;publicVisible=$true}
 $price=Post "$catalog/branches/$branch/price-versions" $ownerHeaders @{offeringId=$offering.id;amountVnd=100000;effectiveFrom=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o')}
 $patientBase="http://127.0.0.1:$($ports.patient)/api/v2"
 $profile=Invoke-RestMethod "$patientBase/me/patient-profile" -Method Put -Headers $user -ContentType 'application/json' -Body (@{fullName='Synthetic authenticated patient';dateOfBirth='1990-01-01';phone='0007654321';expectedVersion=0}|ConvertTo-Json)
 $base="http://127.0.0.1:$($ports.appointment)/api/v2"
 $slots=@(Invoke-RestMethod "$base/public/availability?clinicId=$clinic&branchId=$branch&doctorId=$doctor&offeringId=$($offering.id)&date=$today")
 if($slots.Count -eq 0){throw 'Actual same-day booking availability missing'}
 Poll { $public=Invoke-RestMethod "http://127.0.0.1:$($ports.search)/api/v2/public/search?q=Synthetic&limit=50";@($public.clinics|Where-Object clinicId -eq $clinic).Count -eq 1 -and @($public.doctors|Where-Object doctorId -eq $doctor).Count -eq 1 -and @($public.offerings|Where-Object offeringId -eq $offering.id).Count -eq 1 } 'actual Search projection ready for browser booking'
 . (Join-Path $PSScriptRoot 'verify-real-browser-flow.ps1');$browser=Invoke-RealBrowserBooking $taskRoot $evidence $ports $taskAuth.accounts $clinic $branch $doctor $offering.id $today
 $hold=$browser.hold;$booking=$browser.booking
 $body=@{clinicId=$clinic;branchId=$branch;doctorId=$doctor;offeringId=$offering.id;slotId=$booking.slotId;patientId=$profile.patientId}
 $user['Idempotency-Key']=$browser.holdKey;$replay=Post "$base/appointments/holds" $user $body
 if($hold.holdId -ne $replay.holdId -or $hold.price.amountVnd -ne 100000){throw 'Actual no-deposit hold replay or source price failed'}
 $user['Idempotency-Key']=$browser.confirmKey;$confirm=@{clinicId=$clinic;holdId=$hold.holdId;patientId=$profile.patientId}
 $again=Post "$base/appointments" $user $confirm
 if($booking.id -ne $again.id -or $booking.status -ne 'CONFIRMED' -or $booking.price.priceVersionId -ne $price.id){throw 'Actual booking did not confirm the frozen Catalog source without deposit'}
 $matches=Invoke-RestMethod "$patientBase/clinics/$clinic/branches/$branch/patients/match-suggestions?phone=0007654321" -Headers $user
 $patient=@($matches|Where-Object patientId -eq $profile.patientId)[0]
 if(-not $patient -or $patient.status -ne 'VERIFIED' -or $patient.clinicPatientLinkId -ne $booking.clinicPatientLinkId){throw 'Actual owned Patient was not linked through booking source'}
 Query 'clinic' "UPDATE clinic.clinics SET publication_status='UNPUBLISHED',row_version=row_version+1 WHERE id='$clinic';"
 @{status='PASS';identity='actual-signup-password-login';patient='actual-own-profile-no-SQL-ownership-link';availability='actual-Doctor-Catalog-source';holdReplay='same-id';confirmReplay='same-id';bookingId=$booking.id;patientId=$profile.patientId;priceVnd=100000;deposit='NONE';publicationEvidence='declared-synthetic-isolated-fixture';clinicalRelease='DISABLED';onlinePayment='DISABLED'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'real-booking-summary.json')
 return @{patient=$patient;booking=$booking.id;slot=$booking.slotId;hold=$hold.holdId;offering=$offering.id;price=$price.id}
}
