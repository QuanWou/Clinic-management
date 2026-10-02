function Invoke-ClinicalAccessFlow {
 param($evidence,$ports,$clinic,$branch,$visit,$unassignedUser,$tokens)
 $medical="http://127.0.0.1:$($ports.medical)/api/v2/clinics/$clinic/branches/$branch/visits/$visit/draft";$encounter="http://127.0.0.1:$($ports.encounter)/api/v2/clinics/$clinic/branches/$branch/doctor/visits/$visit"
 $doctor=@{Authorization="Bearer $($tokens.doctor)"};$unassigned=@{Authorization="Bearer $($tokens.unassigned)"};$reception=@{Authorization="Bearer $($tokens.reception)"}
 $before=Invoke-RestMethod $medical -Headers $doctor
 foreach($request in @(@{url=$medical;headers=$unassigned},@{url=$encounter;headers=$unassigned},@{url=$medical;headers=$reception})){$denied=Invoke-WebRequest $request.url -Headers $request.headers -SkipHttpErrorCheck;if($denied.StatusCode -ne 403){throw 'Unassigned Doctor or Reception obtained clinical access'};if($denied.Content -match 'Synthetic diagnosis|Synthetic conclusion|Synthetic history'){throw 'Denied response contains clinical text'}}
 $after=Invoke-RestMethod $medical -Headers $doctor
 $worklist="http://127.0.0.1:$($ports.encounter)/api/v2/clinics/$clinic/branches/$branch/doctor/worklist/page"
 $firstPage=Invoke-RestMethod ($worklist+'?limit=1') -Headers $doctor
 if(@($firstPage.items).Count -ne 1){throw 'Assigned Doctor must have an active worklist source'}
 $nextPage=Invoke-RestMethod ($worklist+'?limit=1&after='+$firstPage.items[0].id) -Headers $doctor
 if(@($nextPage.items|Where-Object id -eq $firstPage.items[0].id).Count -ne 0){throw 'Doctor page repeated its cursor row'}
 $wrongCursor=Invoke-WebRequest ($worklist+'?limit=1&after='+$firstPage.items[0].id) -Headers $unassigned -SkipHttpErrorCheck
 $wrongRole=Invoke-WebRequest ($worklist+'?limit=1') -Headers $reception -SkipHttpErrorCheck
 if($wrongCursor.StatusCode -ne 409 -or $wrongRole.StatusCode -ne 403){throw 'Worklist cursor ownership or canonical role failed'}
 Poll { $sql="SELECT count(*) FROM audit_v2.audit_events WHERE resource_id='$branch' AND actor_user_id='$($taskAuth.users.doctor)' AND category='SECURITY' AND action='clinic.encounter.access_recorded.v1' AND metadata_json::jsonb->>'operation'='READ_WORKLIST' AND outcome='SUCCESS';";$count=$sql|& (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox;$LASTEXITCODE -eq 0 -and [int]$count -ge 2 } 'paged worklist reads have identifier-only security audit'
 @{status='PASS';identity='actual-password-login-canonical-Doctor';firstPageSize=1;repeatedCursorRows=0;unassignedCursor=409;receptionRole=403;audit='SOURCE_SECURITY_READ_WORKLIST';volumeProof='225 rows in isolated PostgreSQL unit/integration fixture, not this small HTTP dataset'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'worklist-paging-summary.json')
 if(($before|ConvertTo-Json -Depth 8 -Compress) -ne ($after|ConvertTo-Json -Depth 8 -Compress)){throw 'Clinical access changed the validated document'}
 Poll { $sql="SELECT count(*) FROM audit_v2.audit_events WHERE resource_id='$visit' AND actor_user_id='$unassignedUser' AND category='SECURITY' AND outcome='DENIED' AND resource_type IN ('medical-access','encounter-access');";$count=$sql|& (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox;$LASTEXITCODE -eq 0 -and [int]$count -eq 3 } 'unassigned clinical accesses have source Audit effects'
 $sql="SELECT count(*) FROM audit_v2.audit_events WHERE resource_id='$visit' AND resource_type IN ('medical-access','encounter-access') AND (metadata_json::text ~* 'diagnosis|confidential|password|accessToken|medicalHistory' OR (outcome='DENIED' AND reason<>'AUTHORIZATION_REJECTED'));";$count=$sql|& (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d clinic_v2_s1_audit_sandbox;if($LASTEXITCODE -ne 0 -or [int]$count -ne 0){throw 'Clinical access audit disclosed private fields or unbounded reason'}
 @{status='PASS';identity='actual-password-login-canonical-unassigned-Doctor';unassignedEncounter=403;unassignedMedical=403;receptionMedical=403;assignedRead=200;document='IMMUTABLE_VALIDATED_SOURCE_UNCHANGED';audit='separate-identifier-only-source-outbox-security-chain';readPermission='SEPARATE_FROM_AUDIT_READ';signature='DISABLED';clinicalRelease='DISABLED'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'clinical-access-summary.json')
}
