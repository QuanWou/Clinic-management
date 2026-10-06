function Invoke-PortalFlow {
 param($evidence,$ports,$clinic,$branch,$otherBranch,$patientId,$userId,$tokens)
 # Explicit synthetic platform-to-patient link; never infer ownership from matching contact or UUID.
 if(-not $IncludeRealIdentity){Query 'patient' "INSERT INTO patient_v2.platform_user_patient_links(user_id,patient_id) VALUES('$userId','$patientId') ON CONFLICT(user_id) DO NOTHING;"}
 $own=@{Authorization="Bearer $($tokens.reception)"};$other=@{Authorization="Bearer $($tokens.owner)"}
 $clinicUrl="http://127.0.0.1:$($ports.clinic)/api/me/patient-clinics"
 $base="http://127.0.0.1:$($ports.billing)/api/me/clinics/$clinic/branches/$branch/bills"
 $directory=Invoke-RestMethod $clinicUrl -Headers $own
 if($directory.Count -ne 1 -or $directory[0].clinicId -ne $clinic){throw 'Private patient clinic directory scope failed'}
 # Clinic fixture is UNPUBLISHED. Its linked history remains available independently of Search.
 $bills=Invoke-RestMethod $base -Headers $own
 if($bills.Count -ne 2 -or @($bills | Where-Object status -ne 'PAID').Count -ne 0){throw 'Patient completed onsite balances missing'}
 foreach($bill in $bills){$read=Invoke-RestMethod "$base/$($bill.id)" -Headers $own;if($read.id -ne $bill.id -or @($read.receipts).Count -eq 0){throw 'Patient receipt detail missing'};$text=$read|ConvertTo-Json -Depth 6;foreach($field in @('externalRef','collectorUserId','shiftId','patientId','sourceId','SYN-POS-001','SYN-BANK-001')){if($text.Contains($field)){throw 'Patient representation disclosed internal collection/source reference'}}}
 $none=Invoke-RestMethod "http://127.0.0.1:$($ports.billing)/api/me/clinics/$clinic/branches/$otherBranch/bills" -Headers $own;if($none.Count -ne 0){throw 'Patient branch scope leaked bills'}
 $denied=Invoke-WebRequest "$base/$($bills[0].id)" -Headers $other -SkipHttpErrorCheck;if($denied.StatusCode -ne 404){throw 'Another active user read patient bill'}
 Query 'patient' "UPDATE patient_v2.clinic_patient_links SET status='REVOKED',row_version=row_version+1 WHERE clinic_id='$clinic' AND patient_id='$patientId';"
 $revoked=Invoke-WebRequest $base -Headers $own -SkipHttpErrorCheck;if($revoked.StatusCode -ne 404){throw 'Patient clinic-link revoke did not apply on next read'}
 $removed=Invoke-RestMethod $clinicUrl -Headers $own;if($removed.Count -ne 0){throw 'Revoked clinic link stayed in private history directory'}
 @{status='PASS';ownership='real-Patient-link-different-platform-user-UUID';history='linked-unpublished-Clinic-visible';money='two-source-bills-paid-onsite-internal-receipts';otherUser=404;otherBranch='empty';linkRevoke=404;privateReferences='omitted';clinicalRelease='DISABLED';onlineCollection='DISABLED';identity=$taskIdentityMode} | ConvertTo-Json | Set-Content (Join-Path $evidence 'portal-flow-summary.json')
}
