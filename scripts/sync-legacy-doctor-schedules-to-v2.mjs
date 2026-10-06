import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=new Set(process.argv.slice(2));
const apply=args.has('--apply');
const configArg=process.argv.slice(2).find(value=>!value.startsWith('--'));
const configPath=configArg??path.join(root,'.runtime/main/config.json');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
const psql=path.join(cfg.postgresBin,'psql.exe');

function sql(query){
  return execFileSync(psql,['-X','-w','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-A','-t','-v','ON_ERROR_STOP=1','-c',query],{
    env:{...process.env,PGPASSWORD:cfg.databasePassword},encoding:'utf8',maxBuffer:8*1024*1024,
  }).trim();
}

async function request(port,url,{method='GET',token='',body}={}){
  const response=await fetch(`http://127.0.0.1:${port}${url}`,{
    method,
    headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(20000),
  });
  const text=await response.text();let parsed;try{parsed=JSON.parse(text);}catch{parsed=text;}
  if(!response.ok)throw new Error(`${method} ${url}: ${response.status} ${parsed?.message??parsed?.error?.message??''}`.trim());
  return parsed;
}

function rows(){
  const raw=sql(`
    SELECT coalesce(json_agg(row_to_json(x)),'[]'::json)::text FROM (
      SELECT p.id::text practitioner_id,p.registration_code,p.display_name,
             a.id::text affiliation_id,a.clinic_id::text clinic_id,a.branch_id::text branch_id,
             a.effective_from::text affiliation_effective_from,
             d.id::text legacy_doctor_id,d.doctor_code,d.active legacy_active,
             s.day_of_week,s.start_time::text,s.end_time::text
      FROM doctor.practitioners p
      JOIN doctor.doctor_affiliations a ON a.practitioner_id=p.id
      JOIN doctor.doctors d ON d.doctor_code=p.registration_code
      JOIN doctor.schedules s ON s.doctor_id=d.id
      WHERE d.active=true AND a.active=true AND a.public_visible=true
        AND a.clinic_id='${String(cfg.clinic).replaceAll("'","''")}'::uuid
        AND a.branch_id='${String(cfg.branch).replaceAll("'","''")}'::uuid
      ORDER BY d.doctor_code,s.day_of_week,s.start_time
    ) x;
  `);
  return JSON.parse(raw||'[]');
}

function keyOf(schedule){
  return [Number(schedule.dayOfWeek??schedule.day_of_week),String(schedule.startTime??schedule.start_time).slice(0,5),String(schedule.endTime??schedule.end_time).slice(0,5)].join('|');
}

async function main(){
  const source=rows();
  const doctors=new Map();
  for(const row of source){
    const value=doctors.get(row.affiliation_id)??{...row,schedules:[]};
    value.schedules.push(row);doctors.set(row.affiliation_id,value);
  }
  const planned=[];
  for(const doctor of doctors.values()){
    const existingRaw=sql(`SELECT coalesce(json_agg(row_to_json(x)),'[]'::json)::text FROM (
      SELECT day_of_week "dayOfWeek",start_minute,end_minute,effective_from::text "effectiveFrom",effective_until::text "effectiveUntil",active
      FROM doctor.working_schedules WHERE affiliation_id='${doctor.affiliation_id}'::uuid AND active=true
      ORDER BY day_of_week,start_minute
    ) x;`);
    const existing=JSON.parse(existingRaw||'[]').map(item=>({
      dayOfWeek:item.dayOfWeek,
      startTime:`${String(Math.floor(item.start_minute/60)).padStart(2,'0')}:${String(item.start_minute%60).padStart(2,'0')}`,
      endTime:`${String(Math.floor(item.end_minute/60)%24).padStart(2,'0')}:${String(item.end_minute%60).padStart(2,'0')}`,
    }));
    const keys=new Set(existing.map(keyOf));
    const missing=doctor.schedules.filter(item=>!keys.has(keyOf(item)));
    planned.push({doctorCode:doctor.doctor_code,doctorName:doctor.display_name,practitionerId:doctor.practitioner_id,affiliationId:doctor.affiliation_id,existing:existing.length,missing:missing.length});
    doctor.missing=missing;
  }

  console.table(planned);
  console.log(JSON.stringify({mode:apply?'APPLY':'DRY_RUN',mappedDoctors:doctors.size,sourceSchedules:source.length,missingSchedules:planned.reduce((sum,item)=>sum+item.missing,0)},null,2));
  if(!apply){console.log('Dry run only. Re-run with --apply to create only the missing V2 schedules through Doctor Service API.');return;}

  const owner=cfg.accounts?.owner;
  if(!owner?.email||!owner?.password)throw new Error('Owner credentials are not configured in runtime config.');
  const gatewayPort=cfg.ports?.gateway??8090;
  const auth=await request(gatewayPort,'/s1/auth/api/auth/login',{method:'POST',body:{email:owner.email,password:owner.password}});
  const token=auth?.data?.accessToken;if(!token)throw new Error('Owner login returned no access token.');
  let created=0;
  for(const doctor of doctors.values()){
    const base=`/s1/doctor/api/clinics/${doctor.clinic_id}/branches/${doctor.branch_id}/doctor-affiliations/${doctor.affiliation_id}/schedules`;
    for(const schedule of doctor.missing){
      await request(gatewayPort,base,{method:'POST',token,body:{
        dayOfWeek:Number(schedule.day_of_week),
        startTime:String(schedule.start_time).slice(0,8),
        endTime:String(schedule.end_time).slice(0,8),
        effectiveFrom:doctor.affiliation_effective_from,
        effectiveUntil:null,
        timezone:'Asia/Ho_Chi_Minh',
        active:true,
      }});
      created++;
    }
  }
  console.log(JSON.stringify({status:'PASS',createdSchedules:created,mappedDoctors:doctors.size},null,2));
}

await main();