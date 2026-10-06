function Invoke-ConfigurationFlow {
 param($evidence,$ports,$tokens)
 $owner=@{Authorization="Bearer $($tokens.stranger)"};$doctor=@{Authorization="Bearer $($tokens.doctor)"};$other=@{Authorization="Bearer $($tokens.reception)"}
 $clinicBase="http://127.0.0.1:$($ports.clinic)/api/clinics";$iam="http://127.0.0.1:$($ports.identity)/api"
 $actor=Invoke-RestMethod "$iam/me/current" -Headers $owner;$doctorActor=Invoke-RestMethod "$iam/me/current" -Headers $doctor
 $draft=@{name='Synthetic configuration clinic';slug=('synthetic-config-'+[guid]::NewGuid().ToString('N'));contactName='Synthetic owner';contactEmail='synthetic@example.invalid';contactPhone='000CONFIG'}
 $created=Post $clinicBase $owner $draft
 if($created.ownerUserId -ne $actor.userId -or $created.reviewStatus -ne 'DRAFT' -or $created.publicationStatus -ne 'UNPUBLISHED'){throw 'Created clinic is not a private actor-owned draft'}
 $null=Invoke-WebRequest "$clinicBase/$($created.id)/owner-membership" -Method Post -Headers $owner
 $mine=Invoke-RestMethod "$clinicBase/mine" -Headers $owner
 if(@($mine).Count -ne 1 -or $mine[0].id -ne $created.id){throw 'Owner private directory leaked the original LAB clinic or lost creator recovery'}
 $staffMine=Invoke-RestMethod "$clinicBase/mine" -Headers $other;if(@($staffMine).Count -ne 0){throw 'Ordinary receptionist obtained private clinic directory'}
 $source=Invoke-RestMethod "$clinicBase/$($created.id)" -Headers $owner;$draft.name='Synthetic configured source';$draft.expectedVersion=$source.version
 $changed=Invoke-RestMethod "$clinicBase/$($created.id)" -Method Put -Headers $owner -ContentType 'application/json' -Body ($draft|ConvertTo-Json)
 if($changed.version -le $source.version){throw 'Clinic update did not return a committed version'}
 $stale=Invoke-WebRequest "$clinicBase/$($created.id)" -Method Put -Headers $owner -ContentType 'application/json' -Body ($draft|ConvertTo-Json) -SkipHttpErrorCheck
 if($stale.StatusCode -ne 409){throw 'Stale clinic form overwrote a newer version'}
 $withBranch=Post "$clinicBase/$($created.id)/branches" $owner @{name='Synthetic configuration location';address='Synthetic address';openingHours='08-17';active=$true;expectedVersion=$changed.version}
 $branch=$withBranch.branches[0].id
 $denied=Invoke-WebRequest "$clinicBase/$($created.id)" -Headers $other -SkipHttpErrorCheck;if($denied.StatusCode -ne 404){throw 'Unrelated staff accessed private owner view'}
 $invite=Post "$iam/clinics/$($created.id)/memberships" $owner @{userId=$doctorActor.userId;role='DOCTOR';allBranches=$false;reason='Synthetic doctor invitation'}
 $null=Post "$iam/clinics/$($created.id)/memberships/$($invite.id)/branches" $owner @{branchId=$branch;reason='Synthetic branch grant'}
 $own=Invoke-RestMethod "$iam/me/invitations" -Headers $doctor;if(@($own|Where-Object id -eq $invite.id).Count -ne 1){throw 'Own invitation discovery failed'}
 $foreign=Invoke-RestMethod "$iam/me/invitations" -Headers $other;if(@($foreign|Where-Object id -eq $invite.id).Count -ne 0){throw 'Invitation leaked to an unrelated user'}
 $wrong=Invoke-WebRequest "$iam/memberships/$($invite.id)/activate" -Method Post -Headers $owner -SkipHttpErrorCheck;if($wrong.StatusCode -ne 404){throw 'Owner accepted another user invitation'}
 $activated=Post "$iam/memberships/$($invite.id)/activate" $doctor @{};if($activated.status -ne 'ACTIVE'){throw 'Target user invitation was not activated'}
 $doctorBase="http://127.0.0.1:$($ports.doctor)/api/clinics/$($created.id)/branches/$branch/doctor-affiliations"
 $today=[DateTimeOffset]::UtcNow.ToOffset([TimeSpan]::FromHours(7)).ToString('yyyy-MM-dd')
 $affiliation=Post $doctorBase $owner @{userId=$doctorActor.userId;displayName='Synthetic S2 Doctor';specialtyCode='SYN';specialtyName='Synthetic configuration specialty';effectiveFrom=$today;publicVisible=$false}
 $schedule=Post "$doctorBase/$($affiliation.id)/schedules" $owner @{dayOfWeek=1;startTime='08:00';endTime='17:00';effectiveFrom=$today;timezone='Asia/Ho_Chi_Minh';active=$true}
 $scheduleBody=@{expectedVersion=$schedule.version;dayOfWeek=1;startTime='09:00';endTime='17:00';effectiveFrom=$today;timezone='Asia/Ho_Chi_Minh';active=$true}
 $edited=Invoke-RestMethod "$doctorBase/$($affiliation.id)/schedules/$($schedule.id)" -Method Put -Headers $owner -ContentType 'application/json' -Body ($scheduleBody|ConvertTo-Json)
 if($edited.version -le $schedule.version -or $edited.startTime -ne '09:00:00'){throw 'Doctor schedule source edit failed'}
 $staleSchedule=Invoke-WebRequest "$doctorBase/$($affiliation.id)/schedules/$($schedule.id)" -Method Put -Headers $owner -ContentType 'application/json' -Body ($scheduleBody|ConvertTo-Json) -SkipHttpErrorCheck
 if($staleSchedule.StatusCode -ne 409){throw 'Stale schedule overwrote source'}
 $catalog="http://127.0.0.1:$($ports.catalog)/api/clinics/$($created.id)"
 $offering=Post "$catalog/offerings" $owner @{code='SYN-CONFIG';name='Synthetic configuration offering';active=$true}
 $null=Post "$catalog/branches/$branch/offerings" $owner @{offeringId=$offering.id;durationMinutes=30;active=$true;publicVisible=$false}
 $old=Post "$catalog/branches/$branch/price-versions" $owner @{offeringId=$offering.id;amountVnd=100000;effectiveFrom=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o')}
 $new=Post "$catalog/branches/$branch/price-versions" $owner @{offeringId=$offering.id;amountVnd=120000;effectiveFrom=[DateTimeOffset]::UtcNow.ToString('o')}
 $history=Invoke-RestMethod "$catalog/branches/$branch/offerings/$($offering.id)/price-versions" -Headers $owner
 if(@($history).Count -ne 2 -or @($history|Where-Object {$_.id -eq $old.id -and $_.amountVnd -eq 100000}).Count -ne 1){throw 'New Catalog price replaced old version'}
 $null=Post "$iam/clinics/$($created.id)/memberships/$($invite.id)/revoke" $owner @{reason='Synthetic configured role revoked'}
 $revoked=Invoke-WebRequest "$doctorBase/$($affiliation.id)/schedules" -Headers $doctor -SkipHttpErrorCheck;if($revoked.StatusCode -ne 404){throw 'Existing token bypassed configured membership revoke'}
 @{status='PASS';clinic='real-private-creator-draft-bootstrap-profile-version';ordinaryStaffMine='empty';privateViewDenied=$denied.StatusCode;staleProfile=$stale.StatusCode;invitation='own-list-target-only-accept';wrongInviteActor=$wrong.StatusCode;doctor='active-membership-required-affiliation-schedule';staleSchedule=$staleSchedule.StatusCode;catalog='branch-assignment-two-immutable-price-versions';revoke=$revoked.StatusCode;identity=$taskIdentityMode;signature='DISABLED';onlinePayment='DISABLED'}|ConvertTo-Json|Set-Content (Join-Path $evidence 'configuration-flow-summary.json')
}
