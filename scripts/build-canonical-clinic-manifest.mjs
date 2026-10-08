import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=process.argv[2]??path.join(root,'.runtime','main','config.json');
const outputPath=path.join(root,'data','operating-clinic','annhien-canonical.json');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
const psqlExe=path.join(cfg.postgresBin,'psql.exe');

function psql(sql){
 return execFileSync(psqlExe,['-X','-w','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-A','-t','-v','ON_ERROR_STOP=1','-c',sql],{
  env:{...process.env,PGPASSWORD:cfg.databasePassword,PGCLIENTENCODING:'UTF8'},
  encoding:'utf8',maxBuffer:16*1024*1024
 }).trim();
}
const doctors=JSON.parse(psql(`select coalesce(json_agg(x order by x.doctor_code),'[]'::json)::text from (
 select d.id::text as source_doctor_id,d.doctor_code,d.user_id::text as user_id,u.full_name,u.email,
        d.specialty_id::text as specialty_id,s.name as specialty_database_name,d.active,
        d.consultation_fee::bigint as consultation_fee,d.biography,d.created_at::date::text as created_date
 from doctor.doctors d
 left join identity.users u on u.id=d.user_id
 left join doctor.specialties s on s.id=d.specialty_id
) x;`));
const specialties=JSON.parse(psql(`select coalesce(json_agg(x order by x.name),'[]'::json)::text from (
 select id::text,name,description from doctor.specialties
) x;`));
const branchRows=JSON.parse(psql(`select coalesce(json_agg(x order by x.created_at),'[]'::json)::text from (
 select id::text,clinic_id::text,name,address,opening_hours,active,created_at from clinic.branches
 where clinic_id='03136db2-48e0-4320-bbdd-5c49e24b6db3' and active=true
) x;`));
if(doctors.length!==23)throw new Error(`Expected preserved doctor.doctors=23, found ${doctors.length}`);
if(specialties.length!==6)throw new Error(`Expected doctor.specialties=6, found ${specialties.length}`);
if(branchRows.length!==1)throw new Error(`Expected one active An Nhiên branch, found ${branchRows.length}`);

const map={
 'Cardiology':{code:'CARD',displayName:'Tim mạch',slug:'tim-mach',description:'Khám và chăm sóc các vấn đề tim mạch.',serviceCode:'CONSULT-CARD',serviceName:'Khám tim mạch',amountVnd:180000},
 'General Medicine':{code:'GEN',displayName:'Nội tổng quát',slug:'noi-tong-quat',description:'Khám nội tổng quát và chăm sóc sức khỏe người lớn.',serviceCode:'CONSULT-GEN',serviceName:'Khám nội tổng quát',amountVnd:210000},
 'Neurology':{code:'NEURO',displayName:'Thần kinh',slug:'than-kinh',description:'Khám và đánh giá các vấn đề thần kinh.',serviceCode:'CONSULT-NEURO',serviceName:'Khám thần kinh',amountVnd:240000},
 'Oncology':{code:'ONC',displayName:'Ung bướu',slug:'ung-buou',description:'Khám, đánh giá và tư vấn các vấn đề ung bướu.',serviceCode:'CONSULT-ONC',serviceName:'Khám ung bướu',amountVnd:270000},
 'Orthopedics':{code:'ORTHO',displayName:'Cơ xương khớp',slug:'co-xuong-khop',description:'Khám các vấn đề xương, khớp và hệ vận động.',serviceCode:'CONSULT-ORTHO',serviceName:'Khám cơ xương khớp',amountVnd:300000},
 'Pediatrics':{code:'PED',displayName:'Nhi khoa',slug:'nhi-khoa',description:'Khám và chăm sóc sức khỏe trẻ em.',serviceCode:'CONSULT-PED',serviceName:'Khám nhi khoa',amountVnd:150000},
};
for(const specialty of specialties)if(!map[specialty.name])throw new Error('No canonical specialty mapping for '+specialty.name);
const eligibleCodes=new Set(Array.from({length:18},(_,i)=>'BS'+String(i+5).padStart(6,'0')));
const effectiveFrom=doctors.filter(x=>eligibleCodes.has(x.doctor_code)).map(x=>x.created_date).sort()[0];
const branch=branchRows[0];

const manifest={
 schemaVersion:1,
 dataset:{
  classification:'local-operating-synthetic',
  effectiveFrom,
  note:'Bộ dữ liệu được chuẩn hóa từ dữ liệu local đã bảo toàn. Tên, hồ sơ và ảnh minh họa phục vụ phát triển/kiểm thử phần mềm; không khẳng định đây là người hành nghề hoặc cơ sở ngoài đời thực.'
 },
 clinic:{
  id:'03136db2-48e0-4320-bbdd-5c49e24b6db3',
  branchId:branch.id,
  name:'Phòng khám An Nhiên',
  media:{
   hero:{src:'/images/generated/clinic-exterior-ai.png',alt:'Hình ảnh minh họa ngoại thất phòng khám',caption:'Hình ảnh minh họa'},
   reception:{src:'/images/generated/clinic-reception-ai.png',alt:'Hình ảnh minh họa khu tiếp đón',caption:'Khu tiếp đón · Hình ảnh minh họa'},
   contact:{src:'/images/generated/clinic-corridor-ai.png',alt:'Hình ảnh minh họa không gian phòng khám',caption:'Không gian phòng khám · Hình ảnh minh họa'},
   gallery:[
    {src:'/images/generated/clinic-waiting-area-ai.png',alt:'Hình ảnh minh họa không gian chờ',caption:'Không gian chờ · Hình ảnh minh họa'},
    {src:'/images/generated/clinic-consultation-room-ai.png',alt:'Hình ảnh minh họa phòng khám',caption:'Phòng khám · Hình ảnh minh họa'},
    {src:'/images/generated/clinic-corridor-ai.png',alt:'Hình ảnh minh họa khu vực hỗ trợ',caption:'Khu vực hỗ trợ · Hình ảnh minh họa'}
   ]
  }
 },
 specialties:specialties.map(source=>{
  const item=map[source.name];
  return {
   sourceSpecialtyId:source.id,databaseName:source.name,code:item.code,displayName:item.displayName,slug:item.slug,
   description:item.description,
   service:{code:item.serviceCode,name:item.serviceName,description:item.description,amountVnd:item.amountVnd}
  };
 }),
 doctors:doctors.map(source=>{
  const item=map[source.specialty_database_name];
  const publicEligible=eligibleCodes.has(source.doctor_code);
  return {
   sourceDoctorId:source.source_doctor_id,code:source.doctor_code,userId:source.user_id,displayName:source.full_name,email:source.email,
   sourceSpecialtyId:source.specialty_id,databaseSpecialtyName:source.specialty_database_name,
   specialtyCode:item.code,specialtyName:item.displayName,specialtySlug:item.slug,
   consultationFeeVnd:Number(source.consultation_fee),biography:source.biography,sourceActive:Boolean(source.active),
   publicEligible,imageUrl:publicEligible?`/images/doctors/${source.doctor_code}.png`:null,
   imageKind:publicEligible?'illustration':null,
   classification:publicEligible?'preserved-synthetic-operating-profile':'demo-or-qa-fixture'
  };
 })
};
fs.mkdirSync(path.dirname(outputPath),{recursive:true});
fs.writeFileSync(outputPath,JSON.stringify(manifest,null,2)+'\n','utf8');
console.log(JSON.stringify({
 output:path.relative(root,outputPath).replaceAll('\\','/'),
 doctors:manifest.doctors.length,
 publicEligible:manifest.doctors.filter(x=>x.publicEligible).length,
 specialties:manifest.specialties.length,
 branchId:manifest.clinic.branchId,
 effectiveFrom:manifest.dataset.effectiveFrom
},null,2));
