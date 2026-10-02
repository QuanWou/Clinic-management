import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const runtime=path.join(root,'v2/.runtime/main');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
const env={...process.env,PGPASSWORD:cfg.databasePassword};
const backup=cfg.databaseBackup??path.join(runtime,'clinic_db.before-v2-20261002.dump');
const hash=value=>createHash('sha256').update(value).digest('hex');
const report={status:'RUNNING',checkedAt:new Date().toISOString(),database:cfg.databaseName,backupSha256:hash(fs.readFileSync(backup)),legacyTables:[],runtimeRoles:[],counts:{}};
const sql=query=>execFileSync(path.join(cfg.postgresBin,'psql.exe'),['-X','-q','-w','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-A','-t','-v','ON_ERROR_STOP=1','-c',query],{env,encoding:'utf8',maxBuffer:32*1024*1024}).replaceAll('\r\n','\n').trimEnd();
const json=query=>JSON.parse(sql(query));
const literal=value=>"'"+String(value).replaceAll("'","''")+"'";
try{
 if(cfg.backupSha256)assert.equal(report.backupSha256.toUpperCase(),cfg.backupSha256.toUpperCase(),'Backup SHA256');
 assert.equal(sql('SELECT current_database()'),cfg.databaseName);
 // Compare all original COPY rows against live rows; never print their content.
 // Only auth tables may gain records for the explicitly created local accounts.
 const archived=execFileSync(path.join(cfg.postgresBin,'pg_restore.exe'),['--data-only','--file=-',backup],{env,encoding:'utf8',maxBuffer:32*1024*1024}).replaceAll('\r\n','\n');
 for(const match of archived.matchAll(/^COPY ([a-z_]+\.[a-z_]+) \(([^\n]+)\) FROM stdin;\n([\s\S]*?)^\\\.\n/gm)){
  const [,table,columns,body]=match;
  const before=body?body.trimEnd().split('\n'):[];
  const copy=sql(`COPY (SELECT ${columns} FROM ${table}) TO STDOUT`);
  const after=copy?copy.split('\n'):[];
  const remaining=new Map();for(const row of after)remaining.set(row,(remaining.get(row)??0)+1);
  for(const row of before){assert.ok(remaining.get(row)>0,`${table}: original row changed or missing`);remaining.set(row,remaining.get(row)-1);}
  const additions=after.length-before.length;
  if(!['identity.users','identity.user_roles','identity.refresh_tokens'].includes(table))assert.equal(additions,0,`${table}: unexpected source write`);
  report.legacyTables.push({table,before:before.length,after:after.length,originalRows:'UNCHANGED',beforeSha256:hash([...before].sort().join('\n')),newRows:additions});
 }
 assert.equal(report.legacyTables.length,40,'Expected all main backup tables');
 const counts={legacyPatients:'SELECT count(*) FROM patient.patients',legacyAppointments:'SELECT count(*) FROM appointment.appointments',legacyDoctors:'SELECT count(*) FROM doctor.doctors',patients:'SELECT count(*) FROM patient_v2.patient_identities',copiedPatients:'SELECT count(*) FROM patient.patients p JOIN patient_v2.patient_identities v ON v.id=p.id',skippedPatients:'SELECT count(*) FROM patient.patients WHERE dob IS NULL',doctors:`SELECT count(*) FROM doctor.doctor_affiliations WHERE clinic_id=${literal(cfg.clinic)}`,schedules:`SELECT count(*) FROM doctor.working_schedules WHERE clinic_id=${literal(cfg.clinic)}`,services:`SELECT count(*) FROM catalog_v2.offerings WHERE clinic_id=${literal(cfg.clinic)}`,priceVersions:`SELECT count(*) FROM catalog_v2.price_versions WHERE clinic_id=${literal(cfg.clinic)}`,servicePoints:`SELECT count(*) FROM encounter_v2.service_points WHERE clinic_id=${literal(cfg.clinic)}`,appointments:`SELECT count(*) FROM appointment_v2.appointments WHERE clinic_id=${literal(cfg.clinic)}`,visits:`SELECT count(*) FROM encounter_v2.visits WHERE clinic_id=${literal(cfg.clinic)}`,bills:`SELECT count(*) FROM billing_v2.bills WHERE clinic_id=${literal(cfg.clinic)}`,payments:`SELECT count(*) FROM billing_v2.payments WHERE clinic_id=${literal(cfg.clinic)}`,notifications:'SELECT count(*) FROM notification_v2.notifications',auditEvents:'SELECT count(*) FROM audit_v2.audit_events'};
 for(const [name,query] of Object.entries(counts))report.counts[name]=Number(sql(query));
 report.counts.todayAppointments=Number(sql(`SELECT count(*) FROM appointment_v2.appointments a JOIN appointment_v2.capacity_slots s ON s.id=a.slot_id WHERE a.clinic_id=${literal(cfg.clinic)} AND (s.starts_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=(now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date`));
 assert.equal(report.counts.copiedPatients+report.counts.skippedPatients,report.counts.legacyPatients,'Every source patient accounted for');
 for(const [name,min] of Object.entries({doctors:6,services:9,priceVersions:9,schedules:78,servicePoints:7,appointments:60,visits:18,bills:6,payments:4}))assert.ok(report.counts[name]>=min,`${name}: missing operating data`);
 for(const [name,table] of Object.entries({visitStates:'encounter_v2.visits',billStates:'billing_v2.bills',appointmentStates:'appointment_v2.appointments'}))report[name]=json(`SELECT coalesce(json_object_agg(status,n),'{}') FROM (SELECT status,count(*) n FROM ${table} WHERE clinic_id=${literal(cfg.clinic)} GROUP BY status) s`);
 report.labStates=json(`SELECT coalesce(json_object_agg(state,n),'{}') FROM (SELECT state,count(*) n FROM medical_v2.orders WHERE clinic_id=${literal(cfg.clinic)} GROUP BY state) s`);
 assert.equal(Number(sql("SELECT count(*) FROM (SELECT journal_id FROM billing_v2.journal_lines GROUP BY journal_id HAVING sum(CASE WHEN side='D' THEN amount_vnd ELSE -amount_vnd END)<>0) x")),0,'All journals balanced');
 assert.equal(Number(sql('SELECT count(*) FROM billing_v2.bills b WHERE paid_vnd<>(SELECT coalesce(sum(amount_vnd),0) FROM billing_v2.payments p WHERE p.bill_id=b.id)')),0,'Payments agree with bill balances');
 report.ledger='BALANCED';
 report.outboxFailures={};
 for(const table of ['clinic.projection_outbox','doctor.projection_outbox','catalog_v2.projection_outbox','appointment_v2.outbox_events','encounter_v2.outbox_events','medical_v2.outbox_events','billing_v2.outbox_events']){
  const failures=Number(sql(`SELECT count(*) FROM ${table} WHERE status IN ('DLQ','DEAD_LETTER')`));assert.equal(failures,0,`${table}: dead-letter delivery`);report.outboxFailures[table]=failures;
 }
 report.runtimeRoles=json("SELECT json_agg(json_build_object('name',rolname,'superuser',rolsuper,'bypassRls',rolbypassrls)) FROM pg_roles WHERE rolname LIKE 'main_v2_%_runtime'");
 assert.equal(report.runtimeRoles.length,13);assert.ok(report.runtimeRoles.every(r=>!r.superuser&&!r.bypassRls),'No privileged runtime login');
 report.migrations=[];
 for(const schema of ['iam','clinic','doctor','catalog_v2','audit_v2','search_v2','patient_v2','appointment_v2','notification_v2','encounter_v2','medical_v2','billing_v2']){
  const migration=json(`SELECT json_build_object('schema',${literal(schema)},'successful',bool_and(success),'latestVersion',max(version::int)) FROM ${schema}.flyway_v2_schema_history`);assert.equal(migration.successful,true);report.migrations.push(migration);
 }
 report.status='PASS';console.log(`PASS: ${report.legacyTables.length} original tables preserved, ${report.counts.patients} V2 patients, operating appointments/visits and balanced onsite payments.`);
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);}finally{fs.writeFileSync(path.join(runtime,'database-verification.json'),JSON.stringify(report,null,2)+'\n');}
