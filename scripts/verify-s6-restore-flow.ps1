function Invoke-S6RestoreFlow {
 param($taskRoot,$evidence,$sandbox,$databasePort,$PostgresBin,$taskServices)
 # The HTTP verifier has already stopped its own Java children. Restore only
 # databases created inside this fresh synthetic PostgreSQL cluster.
 $dumpDirectory=Join-Path $sandbox 'restore-drill';New-Item -ItemType Directory -Force -Path $dumpDirectory|Out-Null
 function RestoreQuery($database,$sql){$result=$sql|& (Join-Path $PostgresBin 'psql.exe') -X -t -A -h 127.0.0.1 -p $databasePort -U postgres -d $database -v ON_ERROR_STOP=1;if($LASTEXITCODE -ne 0){throw "Restore drill query failed: $database"};return @($result|Where-Object {$_ -and $_ -notmatch '^(SET|RESET)$'})}
 function Fingerprint($database,$schema){
  $query=@'
SELECT format('SELECT %L, count(*), coalesce(md5(string_agg(md5(to_jsonb(t)::text),'''' ORDER BY md5(to_jsonb(t)::text))),md5('''')) FROM %I.%I t;',tablename,schemaname,tablename) FROM pg_tables WHERE schemaname='__SCHEMA__' ORDER BY tablename;
\gexec
'@
  return @(RestoreQuery $database ($query.Replace('__SCHEMA__',$schema))|Sort-Object)
 }
 $checks=@()
 foreach($service in (@($taskServices)+@('legacy-auth'))){
  $source=if($service -eq 'legacy-auth'){'clinic_v2_s6_auth_sandbox'}else{"clinic_v2_s1_${service}_sandbox"}
  $target=if($service -eq 'legacy-auth'){'clinic_v2_s6_restore_auth'}else{"clinic_v2_s6_restore_$service"}
  $schema=if($service -eq 'legacy-auth'){'identity'}elseif($service -eq 'identity'){'iam'}elseif($service -in @('clinic','doctor')){$service}else{"${service}_v2"}
  if($source -notmatch '^clinic_v2_s[16]_[a-z-]+_sandbox$' -or $target -notmatch '^clinic_v2_s6_restore_[a-z]+$'){throw 'Restore targets must be the explicitly isolated synthetic databases'}
  $artifact=Join-Path $dumpDirectory "$service.dump"
  & (Join-Path $PostgresBin 'pg_dump.exe') -h 127.0.0.1 -p $databasePort -U postgres -d $source -Fc -f $artifact
  if($LASTEXITCODE -ne 0){throw "Synthetic backup failed: $service"}
  $null=RestoreQuery 'postgres' "CREATE DATABASE $target;"
  & (Join-Path $PostgresBin 'pg_restore.exe') -h 127.0.0.1 -p $databasePort -U postgres -d $target --exit-on-error --single-transaction $artifact
  if($LASTEXITCODE -ne 0){throw "Synthetic restore failed: $service"}
  $before=Fingerprint $source $schema;$after=Fingerprint $target $schema
  if(($before -join "`n") -ne ($after -join "`n")){throw "Restored rows differ from source: $service"}
  $security="SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='$schema' AND c.relkind='r' ORDER BY c.relname;"
  if(((RestoreQuery $source $security)-join "`n") -ne ((RestoreQuery $target $security)-join "`n")){throw "Restored RLS flags differ: $service"}
  if($service -ne 'legacy-auth'){
   $runtime="s1_${service}_verify"
   $rows=RestoreQuery $target "SET ROLE $runtime; SELECT rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user; RESET ROLE;"
   if(($rows -join '') -ne "$runtime|f|f"){throw "Restored runtime privilege mismatch: $service"}
  }
  $checks+=@{service=$service;source=$source;restoredDatabase=$target;tableCount=$before.Count;rowsAndContent='EXACT_SYNTHETIC_MATCH';rls='PRESERVED';dumpSha256=(Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash}
 }
 $imbalanced=RestoreQuery 'clinic_v2_s6_restore_billing' "SELECT count(*) FROM (SELECT journal_id,sum(CASE WHEN side='D' THEN amount_vnd ELSE -amount_vnd END) balance FROM billing_v2.journal_lines GROUP BY journal_id) x WHERE balance<>0;"
 if(($imbalanced -join '') -ne '0'){throw 'Restored onsite ledger is unbalanced'}
 $unscoped=RestoreQuery 'clinic_v2_s6_restore_billing' 'SET ROLE s1_billing_verify; SELECT count(*) FROM billing_v2.bills; RESET ROLE;'
 if(($unscoped -join '') -ne '0'){throw 'Restored runtime reads bills without tenant context'}
 . (Join-Path $PSScriptRoot 'verify-restored-applications-flow.ps1');Invoke-RestoredApplicationsFlow $taskRoot $evidence $sandbox $databasePort $password
 @{status='PASS';environment='fresh-synthetic-loopback-cluster-only';services=$checks;balancedLedger='PASS';unscopedBillingRead=0;restoredApplications='PASS';artifactDirectory=$dumpDirectory;applicationRollback='NOT_EXECUTED';productionMigration='NOT_EXECUTED';clinicalDocumentImport='NOT_EXECUTED';releaseAcceptance='NOT_GRANTED'}|ConvertTo-Json -Depth 6|Set-Content (Join-Path $evidence 'restore-drill-summary.json')
}

