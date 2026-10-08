import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=process.argv[2]??path.join(root,'.runtime','main','config.json');
const manifestPath=path.join(root,'data','operating-clinic','annhien-canonical.json');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const BASE={
 auth:'http://127.0.0.1:8093/modules/auth',
 identity:'http://127.0.0.1:8093/modules/identity',
 clinic:'http://127.0.0.1:8094/modules/clinic',
 doctor:'http://127.0.0.1:8094/modules/doctor',
 search:'http://127.0.0.1:8094/modules/search',
 catalog:'http://127.0.0.1:8103/modules/catalog',
};
const canonicalSpecialtyCodes=new Set(manifest.specialties.map(x=>x.code));
const reason='Chuẩn hóa dữ liệu vận hành đã được bảo toàn từ doctor.doctors; hồ sơ demo/QA không được công bố';

function api(service,url,method='GET',token='',body,key){
 const responseBody=body===undefined?undefined:JSON.stringify(body);
 return fetch(BASE[service]+url,{
  method,
  headers:{
   Accept:'application/json',
   ...(token?{Authorization:'Bearer '+token}:{}),
   ...(responseBody?{'Content-Type':'application/json; charset=utf-8'}:{}),
   ...(key?{'Idempotency-Key':key}:{})
  },
  ...(responseBody?{body:responseBody}:{}),
  signal:AbortSignal.timeout(25000)
 }).then(async response=>{
  const text=await response.text();let parsed;try{parsed=text?JSON.parse(text):null;}catch{parsed=text;}
  if(!response.ok)throw new Error(`${service} ${method} ${url}: HTTP ${response.status} ${parsed?.message??parsed?.error?.message??text}`);
  return parsed;
 });
}
const write=(service,url,token,body,key,method='POST')=>api(service,url,method,token,body,key??randomUUID());

function psql(sql){
 const exe=path.join(cfg.postgresBin,'psql.exe');
 return execFileSync(exe,['-X','-w','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-A','-t','-v','ON_ERROR_STOP=1'],{
  env:{...process.env,PGPASSWORD:cfg.databasePassword,PGCLIENTENCODING:'UTF8'},
  input:Buffer.from(sql+'\n','utf8'),encoding:'utf8',maxBuffer:16*1024*1024
 }).trim();
}
const literal=value=>"'" + String(value).replaceAll("'","''") + "'";

function ensureManifestMatchesSource(){
 const raw=psql(`select coalesce(json_agg(x order by x.doctor_code),'[]'::json)::text from (
  select d.id::text as source_doctor_id,d.doctor_code,d.user_id::text as user_id,u.full_name,u.email,
         d.specialty_id::text as specialty_id,s.name as specialty_database_name,
         d.active,d.consultation_fee::bigint as consultation_fee,d.biography
  from doctor.doctors d
  left join identity.users u on u.id=d.user_id
  left join doctor.specialties s on s.id=d.specialty_id
 ) x;`);
 const source=JSON.parse(raw);
 const byCode=new Map(source.map(x=>[x.doctor_code,x]));
 for(const doctor of manifest.doctors){
  const actual=byCode.get(doctor.code);
  if(!actual)throw new Error('Legacy source doctor is missing: '+doctor.code);
  if(actual.source_doctor_id!==doctor.sourceDoctorId||actual.user_id!==doctor.userId||actual.full_name!==doctor.displayName)
   throw new Error('Canonical manifest differs from preserved source: '+doctor.code);
 }
 if(source.length!==manifest.doctors.length)throw new Error(`Expected ${manifest.doctors.length} preserved doctors but found ${source.length}`);
}

async function loginOwner(){
 const account=cfg.accounts?.owner;
 if(!account?.email||!account?.password)throw new Error('Owner credentials are not configured in private runtime config');
 const auth=await api('auth','/api/auth/login','POST','',{email:account.email,password:account.password});
 return auth.data?.accessToken??auth.accessToken;
}
function activePublicAffiliation(a){return a.active&&a.publicVisible;}

async function ensureCanonicalServices(token,clinicId,branchId){
 let offerings=await api('catalog',`/api/clinics/${clinicId}/offerings`,'GET',token);
 let assignments=await api('catalog',`/api/clinics/${clinicId}/branches/${branchId}/offerings`,'GET',token);
 const services=[];
 const effective=new Date(Date.now()-86400000).toISOString();

 for(const spec of manifest.specialties){
  let offering=offerings.find(x=>x.code===spec.service.code);
  if(!offering){
   offering=await write('catalog',`/api/clinics/${clinicId}/offerings`,token,{
    code:spec.service.code,name:spec.service.name,description:spec.service.description,specialtyCode:spec.code,active:true
   },'canonical-offering-'+spec.code);
   offerings=[...offerings,offering];
  }else if(offering.name!==spec.service.name||offering.description!==spec.service.description||offering.specialtyCode!==spec.code||!offering.active){
   offering=await write('catalog',`/api/clinics/${clinicId}/offerings/${offering.id}`,token,{
    expectedVersion:offering.version,name:spec.service.name,description:spec.service.description,specialtyCode:spec.code,active:true
   },undefined,'PUT');
   offerings=offerings.map(x=>x.id===offering.id?offering:x);
  }

  let assignment=assignments.find(x=>x.offering.id===offering.id);
  if(!assignment){
   assignment=await write('catalog',`/api/clinics/${clinicId}/branches/${branchId}/offerings`,token,{
    offeringId:offering.id,durationMinutes:30,active:true,publicVisible:true
   },'canonical-assignment-'+spec.code);
   assignments=[...assignments,assignment];
  }else if(!assignment.active||!assignment.publicVisible||assignment.durationMinutes!==30){
   assignment=await write('catalog',`/api/clinics/${clinicId}/branches/${branchId}/offerings/${assignment.id}`,token,{
    expectedVersion:assignment.version,durationMinutes:30,active:true,publicVisible:true
   },undefined,'PUT');
   assignments=assignments.map(x=>x.id===assignment.id?assignment:x);
  }

  const prices=await api('catalog',`/api/clinics/${clinicId}/branches/${branchId}/offerings/${offering.id}/price-versions`,'GET',token);
  const latestPrice=[...prices].sort((a,b)=>String(b.effectiveFrom).localeCompare(String(a.effectiveFrom)))[0];
  if(!latestPrice||Number(latestPrice.amountVnd)!==Number(spec.service.amountVnd)){
   await write('catalog',`/api/clinics/${clinicId}/branches/${branchId}/price-versions`,token,{
    offeringId:offering.id,amountVnd:spec.service.amountVnd,effectiveFrom:effective,taxPolicyCode:null,discountPolicyCode:null
   },'canonical-price-'+spec.code);
  }
  services.push({
   offeringId:offering.id,code:offering.code,name:offering.name,specialtyName:spec.displayName,specialtySlug:spec.slug,
   description:offering.description,suitableFor:'Khám và tư vấn theo chuyên khoa '+spec.displayName,
   preparation:'Mang theo giấy tờ và hồ sơ khám trước đây nếu có.',cta:'Đặt lịch khám'
  });
 }

 // Preserve non-canonical offerings for existing records, but do not expose them on this canonical public site.
 for(const assignment of assignments){
  const code=assignment.offering.specialtyCode;
  if(assignment.publicVisible&&(!code||!canonicalSpecialtyCodes.has(code))){
   await write('catalog',`/api/clinics/${clinicId}/branches/${branchId}/offerings/${assignment.id}`,token,{
    expectedVersion:assignment.version,durationMinutes:assignment.durationMinutes,active:assignment.active,publicVisible:false
   },undefined,'PUT');
  }
 }
 return services;
}

async function main(){
 ensureManifestMatchesSource();
 const ownerToken=await loginOwner();
 const clinicId=manifest.clinic.id;
 const clinic=await api('clinic',`/api/clinics/${clinicId}`,'GET',ownerToken);
 const branch=clinic.branches.find(x=>x.id===manifest.clinic.branchId&&x.active);
 if(!branch)throw new Error('Canonical active branch does not exist in Clinic Service: '+manifest.clinic.branchId);
 const branchId=branch.id;

 let memberships=await api('identity',`/api/clinics/${clinicId}/memberships`,'GET',ownerToken);
 let affiliations=await api('doctor',`/api/clinics/${clinicId}/branches/${branchId}/doctor-affiliations`,'GET',ownerToken);
 const publicDoctors=[];
 const eligible=manifest.doctors.filter(x=>x.publicEligible);
 const eligibleUserIds=new Set(eligible.map(x=>x.userId));

 // Keep prior seed/QA doctors operational for history, but remove them from this canonical public projection.
 for(const affiliation of affiliations.filter(activePublicAffiliation)){
  if(!eligibleUserIds.has(affiliation.userId)){
   const updated=await write('doctor',`/api/clinics/${clinicId}/branches/${branchId}/doctor-affiliations/${affiliation.id}`,ownerToken,{
    expectedVersion:affiliation.version,specialtyCode:affiliation.specialtyCode,specialtyName:affiliation.specialtyName,
    professionalTitle:affiliation.professionalTitle,effectiveFrom:affiliation.effectiveFrom,effectiveUntil:affiliation.effectiveUntil,
    active:affiliation.active,publicVisible:false
   },undefined,'PUT');
   affiliations=affiliations.map(x=>x.id===updated.id?updated:x);
  }
 }

 const scheduleFrom=manifest.dataset.effectiveFrom;
 for(const doctor of eligible){
  let membership=memberships.find(x=>x.userId===doctor.userId&&x.role==='DOCTOR'&&x.status==='ACTIVE');
  if(!membership){
   membership=await write('identity',`/api/clinics/${clinicId}/staff`,ownerToken,{
    userId:doctor.userId,role:'DOCTOR',allBranches:true,reason
   },'canonical-staff-'+doctor.code);
   memberships=[...memberships,membership];
  }

  let affiliation=affiliations.find(x=>x.userId===doctor.userId&&x.active);
  if(!affiliation){
   affiliation=await write('doctor',`/api/clinics/${clinicId}/branches/${branchId}/doctor-affiliations`,ownerToken,{
    userId:doctor.userId,displayName:doctor.displayName,registrationCode:doctor.code,
    specialtyCode:doctor.specialtyCode,specialtyName:doctor.specialtyName,professionalTitle:'Bác sĩ',
    effectiveFrom:scheduleFrom,effectiveUntil:null,publicVisible:true
   },'canonical-affiliation-'+doctor.code);
   affiliations=[...affiliations,affiliation];
  }else if(!affiliation.publicVisible||affiliation.specialtyCode!==doctor.specialtyCode||affiliation.specialtyName!==doctor.specialtyName){
   affiliation=await write('doctor',`/api/clinics/${clinicId}/branches/${branchId}/doctor-affiliations/${affiliation.id}`,ownerToken,{
    expectedVersion:affiliation.version,specialtyCode:doctor.specialtyCode,specialtyName:doctor.specialtyName,
    professionalTitle:'Bác sĩ',effectiveFrom:affiliation.effectiveFrom,effectiveUntil:affiliation.effectiveUntil,
    active:true,publicVisible:true
   },undefined,'PUT');
   affiliations=affiliations.map(x=>x.id===affiliation.id?affiliation:x);
  }

  const schedulePath=`/api/clinics/${clinicId}/branches/${branchId}/doctor-affiliations/${affiliation.id}/schedules`;
  const scheduleView=await api('doctor',schedulePath,'GET',ownerToken);
  const schedules=scheduleView.schedules??[];
  const wanted=[];
  for(let day=1;day<=7;day++){
   const ranges=day===7?[['08:00','12:00']]:[['08:00','12:00'],['13:00','18:00']];
   for(const [startTime,endTime] of ranges)wanted.push({day,startTime,endTime});
  }
  for(const slot of wanted){
   if(schedules.some(x=>x.active&&x.dayOfWeek===slot.day&&String(x.startTime).slice(0,5)===slot.startTime&&String(x.endTime).slice(0,5)===slot.endTime))continue;
   await write('doctor',schedulePath,ownerToken,{
    dayOfWeek:slot.day,startTime:slot.startTime,endTime:slot.endTime,effectiveFrom:scheduleFrom,
    effectiveUntil:null,timezone:'Asia/Ho_Chi_Minh',active:true
   },`canonical-schedule-${doctor.code}-${slot.day}-${slot.startTime.replace(':','')}`);
  }

  publicDoctors.push({
   sourceDoctorId:doctor.sourceDoctorId,doctorId:affiliation.practitionerId,code:doctor.code,displayName:doctor.displayName,
   title:'Bác sĩ',specialtyName:doctor.specialtyName,specialtySlug:doctor.specialtySlug,yearsExperience:null,
   headline:`Bác sĩ ${doctor.specialtyName}`,summary:doctor.biography??'',expertise:[],consultationAreas:[doctor.specialtyName],
   education:[],experience:[],cta:'Đặt lịch khám',imageUrl:doctor.imageUrl,imageKind:'illustration'
  });
 }

 const publicServices=await ensureCanonicalServices(ownerToken,clinicId,branchId);
 const bySpecialty=new Map();
 for(const doctor of publicDoctors)bySpecialty.set(doctor.specialtySlug,(bySpecialty.get(doctor.specialtySlug)??0)+1);
 const content={
  clinic:{
   heroMessage:clinic.publicDescription,
   shortIntroduction:clinic.publicDescription,
   detailedIntroduction:clinic.publicDescription,
   facilities:'Không gian khám ngoại trú được tổ chức theo các khu vực tiếp đón, chờ và phòng khám.',
   careProcess:'Đặt lịch → tiếp nhận → khám → nhận hướng dẫn và hồ sơ được phát hành.',
   media:manifest.clinic.media
  },
  specialties:manifest.specialties.map(spec=>({
   specialtyId:spec.sourceSpecialtyId,databaseName:spec.databaseName,displayName:spec.displayName,slug:spec.slug,
   shortDescription:spec.description,description:spec.description,commonConditions:[],keyExpertise:[],
   doctorCount:bySpecialty.get(spec.slug)??0,cta:'Xem bác sĩ'
  })),
  doctors:publicDoctors,
  services:publicServices,
  dataset:{
   classification:manifest.dataset.classification,
   note:manifest.dataset.note,
   legacyDoctorCount:manifest.doctors.length,
   publicDoctorCount:publicDoctors.length
  }
 };
 const payload=JSON.stringify(content);
 const sourceHash=createHash('sha256').update(fs.readFileSync(manifestPath)).digest('hex');
 psql(`insert into search_v2.public_web_content(clinic_id,content,source_label,source_sha256)
  values(${literal(clinicId)},${literal(payload)}::jsonb,${literal(path.relative(root,manifestPath).replaceAll('\\','/'))},${literal(sourceHash)})
  on conflict(clinic_id) do update set content=excluded.content,source_label=excluded.source_label,source_sha256=excluded.source_sha256,imported_at=now();`);

 cfg.clinic=clinicId;cfg.branch=branchId;
 fs.writeFileSync(configPath,JSON.stringify(cfg,null,2)+'\n','utf8');

 // Wait for source-service projection relay; never write public_doctors directly.
 let projected=[];
 for(let attempt=0;attempt<60;attempt++){
  try{projected=await api('search',`/api/public/clinics/${clinicId}/doctors`);if(new Set(projected.map(x=>x.doctorId)).size===eligible.length)break;}catch{}
  await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const specialties=await api('search',`/api/public/clinics/${clinicId}/specialties`);
 console.log(JSON.stringify({
  clinicId,branchId,preservedLegacyDoctors:manifest.doctors.length,publicEligibleDoctors:eligible.length,
  projectedDoctors:new Set(projected.map(x=>x.doctorId)).size,projectedSpecialties:specialties.map(x=>({code:x.code,name:x.name,doctorCount:x.doctorCount})),
  contentDoctors:publicDoctors.length,sourceSha256:sourceHash
 },null,2));
}
main().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
