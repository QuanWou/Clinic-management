function Invoke-OperationsFlow {
 param($evidence,$ports,$clinic,$branch,$otherBranch,$tokens)
 $date=[DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd')
 $owner=@{Authorization="Bearer $($tokens.owner)"};$reception=@{Authorization="Bearer $($tokens.reception)"}
 $e="http://127.0.0.1:$($ports.encounter)/api/v2/clinics/$clinic/branches"
 $f="http://127.0.0.1:$($ports.billing)/api/v2/clinics/$clinic/branches"
 $encounter=Invoke-RestMethod "$e/$branch/operations-summary?date=$date" -Headers $owner
 $billing=Invoke-RestMethod "$f/$branch/operations-summary?date=$date" -Headers $owner
 if($encounter.completed -ne 2 -or $encounter.checkedIn -ne 2){throw 'Operations real daily Encounter counts mismatch'}
 if($billing.collectedCashVnd -ne 40000 -or $billing.collectedBankVnd -ne 200000 -or $billing.collectedPosVnd -ne 40000 -or $billing.outstandingVnd -ne 0 -or $billing.receiptCount -ne 3 -or $billing.approvedShifts -ne 1){throw 'Operations real onsite tender/shift summary mismatch'}
 $empty=Invoke-RestMethod "$f/$otherBranch/operations-summary?date=$date" -Headers $owner
 if($empty.receiptCount -ne 0 -or $empty.outstandingVnd -ne 0){throw 'Operations summary crossed branch RLS'}
 foreach($base in @($e,$f)){$denied=Invoke-WebRequest "$base/$branch/operations-summary?date=$date" -Headers $reception -SkipHttpErrorCheck;if($denied.StatusCode -ne 403){throw 'Reception role obtained manager financial/operations overview'}}
 $text=@($encounter,$billing)|ConvertTo-Json;if($text.Contains('patientId') -or $text.Contains('collectorUserId') -or $text.Contains('confidential')){throw 'Operations summary contained patient/collector or clinical content'}
 @{status='PASS';sources='real-Encounter-and-Billing';dailyCompleted=2;dailyCashVnd=40000;dailyBankVnd=200000;dailyPosVnd=40000;currentOutstandingVnd=0;separateShiftApproval=1;role='canonical-Owner-Manager-only';receptionDenied=403;branchScope='RLS-empty-other-branch';clinicalRelease='DISABLED'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'operations-flow-summary.json')
}
