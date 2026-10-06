import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const configPath=process.argv[2]??path.join(root,'.runtime/main/config.json');
const cfg=JSON.parse(fs.readFileSync(configPath,'utf8').replace(/^\uFEFF/,''));
const save=()=>fs.writeFileSync(configPath,JSON.stringify(cfg,null,2)+'\n');
const date=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+n*86400000));
const reason='Khởi tạo dữ liệu vận hành để kiểm thử tại phòng khám';
const tokens={};
async function api(service,url,method='GET',token='',body,key){
 const response=await fetch(`http://127.0.0.1:${cfg.ports[service]}${url}`,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)});
 const text=await response.text();let result;try{result=JSON.parse(text);}catch{result=text;}
 if(!response.ok)throw Error(`${service} ${method} ${url}: ${response.status} ${result?.message??result?.error?.message??''}`);
 return result;
}
const write=(service,url,token,body,key=randomUUID(),method='POST')=>api(service,url,method,token,body,key);
function sql(query){return execFileSync(path.join(cfg.postgresBin,'psql.exe'),['-X','-w','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-A','-t','-v','ON_ERROR_STOP=1','-c',query],{env:{...process.env,PGPASSWORD:cfg.databasePassword},encoding:'utf8',maxBuffer:4*1024*1024}).trim();}
const literal=s=>"'"+String(s).replaceAll("'","''")+"'";
async function account(key,name,email){
 if(!cfg.accounts[key]){
  const response=await fetch(`http://127.0.0.1:${cfg.ports.auth}/api/auth/register`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:cfg.testPassword,fullName:name}),signal:AbortSignal.timeout(20000)});
  if(![200,201,409].includes(response.status))throw Error('Account registration failed: '+key);
  cfg.accounts[key]={email,password:cfg.testPassword,fullName:name};save();
 }
 const auth=await api('auth','/api/auth/login','POST','',{email:cfg.accounts[key].email,password:cfg.accounts[key].password});
 cfg.accounts[key].userId=auth.data.userId;tokens[key]=auth.data.accessToken;save();return cfg.accounts[key];
}
async function membership(key,role,allBranches=false){
 const id=cfg.accounts[key].userId,base=`/api/clinics/${cfg.clinic}/memberships`;
 let memberships=await api('identity',base,'GET',tokens.owner);
 let m=memberships.find(m=>m.userId===id&&m.role===role&&m.status!=='REVOKED');
 if(!m)m=await write('identity',base,tokens.owner,{userId:id,role,allBranches,reason});
 if(m.status==='INVITED')m=await write('identity',`/api/memberships/${m.id}/activate`,tokens[key],{});
 if(!allBranches&&!m.branchIds.includes(cfg.branch))await write('identity',`${base}/${m.id}/branches`,tokens.owner,{branchId:cfg.branch,reason});
}
async function seed(){
 await account('owner','Nguyễn Hoàng Phúc','owner@annhien.local');
 sql(`INSERT INTO iam.platform_operators(user_id) VALUES(${literal(cfg.accounts.owner.userId)}) ON CONFLICT(user_id) DO NOTHING;`);
 if(!cfg.clinic){
  const c=await write('clinic','/api/clinics',tokens.owner,{name:'Phòng khám An Nhiên',slug:'phong-kham-an-nhien',publicDescription:'Chăm sóc sức khỏe cho bạn và gia đình tại Long Biên, Hà Nội. Tìm hiểu các dịch vụ khám, lựa chọn bác sĩ và chủ động sắp xếp lịch hẹn.',contactName:cfg.accounts.owner.fullName,contactEmail:cfg.accounts.owner.email,contactPhone:'0000000101',license:{licenseNumber:'LOCAL-TEST-NOT-A-LICENSE',issuingAuthority:'LOCAL-TEST',scopeSummary:'Fictional operating clinic for local software acceptance only',evidenceRef:'local-test/operating-clinic',validUntil:date(365)}});
  cfg.clinic=c.id;save();
 }
 await write('clinic',`/api/clinics/${cfg.clinic}/owner-membership`,tokens.owner,{});
 let clinic=await api('clinic',`/api/clinics/${cfg.clinic}`,'GET',tokens.owner);
 if(!cfg.branch){
  const c=await write('clinic',`/api/clinics/${cfg.clinic}/branches`,tokens.owner,{name:'Phòng khám An Nhiên',address:'125 Nguyễn Văn Cừ, Long Biên, Hà Nội',openingHours:'Thứ Hai–Thứ Bảy: 08:00–12:00, 13:00–18:00 · Chủ Nhật: 08:00–12:00',active:true,expectedVersion:clinic.version});cfg.branch=c.branches[0].id;save();
 }
 await account('reception','Lê Ngọc Mai','reception@annhien.local');await membership('reception','STAFF');
 for(const [key,role] of [['manager','ADMIN'],['cashier','STAFF'],['lab','DOCTOR'],['platform','ADMIN']]){if(cfg.accounts[key]){await account(key,cfg.accounts[key].fullName,cfg.accounts[key].email);await membership(key,role,role==='ADMIN');}}
 tokens.platform=tokens.owner;tokens.manager=tokens.owner;tokens.cashier=tokens.reception;
 cfg.roleModel='ACADEMIC_4';cfg.primaryAccounts={admin:'owner',staff:'reception',doctor:'doctor',patient:'patient'};save();
 const doctors=[['doctor','Nguyễn Minh Khôi','GEN','Nội tổng quát'],['doctor2','Trần Thu Hà','FAMILY','Y học gia đình'],['doctor3','Lê Quốc An','PED','Nhi khoa'],['doctor4','Phạm Thanh Sơn','CARD','Tim mạch'],['doctor5','Đỗ Ngọc Anh','DERM','Da liễu'],['doctor6','Hoàng Thanh Bình','ENT','Tai mũi họng']];
 for(const [key,name,code,specialty] of doctors){
  await account(key,name,key+'@annhien.local');await membership(key,'DOCTOR');
  const base=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}/doctor-affiliations`;
  let list=await api('doctor',base,'GET',tokens.owner);let a=list.find(a=>a.userId===cfg.accounts[key].userId&&a.active);
  if(!a)a=await write('doctor',base,tokens.owner,{userId:cfg.accounts[key].userId,displayName:name,specialtyCode:code,specialtyName:specialty,effectiveFrom:date(-90),publicVisible:true});
  cfg.doctors[key]={id:a.practitionerId,affiliation:a.id,name,specialty};save();
  const schedules=(await api('doctor',`${base}/${a.id}/schedules`,'GET',tokens.owner)).schedules;
  for(let day=1;day<=7;day++)for(const [start,end] of (day===7?[['08:00','12:00']]:[['08:00','12:00'],['13:00','18:00']])){
   if(!schedules.some(s=>s.dayOfWeek===day&&s.startTime.slice(0,5)===start&&s.endTime.slice(0,5)===end))await write('doctor',`${base}/${a.id}/schedules`,tokens.owner,{dayOfWeek:day,startTime:start,endTime:end,effectiveFrom:date(-90),timezone:'Asia/Ho_Chi_Minh',active:true});
  }
 }
 const services=[['consultation','CONSULT-GEN','Khám nội tổng quát',180000,30,true,'GEN','Đánh giá sức khỏe và trao đổi các vấn đề bạn đang gặp.'],['family','CONSULT-FAMILY','Khám sức khỏe gia đình',220000,30,true,'FAMILY','Khám ngoại trú và tư vấn kế hoạch theo dõi sức khỏe.'],['pediatrics','CONSULT-PED','Khám nhi khoa',200000,30,true,'PED','Thăm khám cho trẻ theo lịch hẹn.'],['cardiology','CONSULT-CARD','Khám tim mạch',250000,30,true,'CARD','Thăm khám và đánh giá các vấn đề tim mạch.'],['dermatology','CONSULT-DERM','Khám da liễu',220000,30,true,'DERM','Thăm khám các vấn đề về da.'],['ent','CONSULT-ENT','Khám tai mũi họng',200000,30,true,'ENT','Thăm khám các vấn đề tai, mũi và họng.'],['laboratory','CBC','Công thức máu',90000,15,false,'LAB','Xét nghiệm thực hiện theo chỉ định của bác sĩ.'],['glucose','GLUCOSE','Đường huyết',50000,15,false,'LAB','Xét nghiệm thực hiện theo chỉ định của bác sĩ.'],['ultrasound','US-ABDOMEN','Siêu âm ổ bụng',180000,20,false,'DIAG','Thực hiện theo chỉ định của bác sĩ.']];
 for(const [key,code,name,amount,duration,publicVisible,specialtyCode,description] of services){
  const base=`/api/clinics/${cfg.clinic}`;const list=await api('catalog',`${base}/offerings`,'GET',tokens.owner);let o=list.find(o=>o.code===code);
  if(!o)o=await write('catalog',`${base}/offerings`,tokens.owner,{code,name,description,specialtyCode,active:true});
  const assignments=await api('catalog',`${base}/branches/${cfg.branch}/offerings`,'GET',tokens.owner);
  if(!assignments.some(a=>a.offering.id===o.id))await write('catalog',`${base}/branches/${cfg.branch}/offerings`,tokens.owner,{offeringId:o.id,durationMinutes:duration,active:true,publicVisible});
  const prices=await api('catalog',`${base}/branches/${cfg.branch}/offerings/${o.id}/price-versions`,'GET',tokens.owner);
  if(!prices.length)await write('catalog',`${base}/branches/${cfg.branch}/price-versions`,tokens.owner,{offeringId:o.id,amountVnd:amount,effectiveFrom:new Date(Date.now()-90*86400000).toISOString()});
  cfg.offerings[key]=o.id;save();
 }
 clinic=await api('clinic',`/api/clinics/${cfg.clinic}`,'GET',tokens.owner);
 if(clinic.reviewStatus==='DRAFT')await write('clinic',`/api/clinics/${cfg.clinic}/submit`,tokens.owner,{});
 clinic=await api('clinic',`/api/clinics/${cfg.clinic}`,'GET',tokens.owner);
 if(clinic.reviewStatus==='SUBMITTED')await write('clinic',`/api/platform/clinics/${cfg.clinic}/approve`,tokens.platform,{reason:'LOCAL TEST ONLY: verify fictional fixture evidence for acceptance, not a professional or production approval',evidenceVerified:true});
 clinic=await api('clinic',`/api/clinics/${cfg.clinic}`,'GET',tokens.owner);
 if(clinic.publicationStatus==='UNPUBLISHED')await write('clinic',`/api/platform/clinics/${cfg.clinic}/publish`,tokens.platform,{reason:'LOCAL TEST ONLY: one operating-clinic dataset for software acceptance on loopback'});
 // Preserve the existing source tables. Copy valid patient identities/links only;
 // old clinical documents, money and unknown price snapshots are never invented.
 if(!cfg.legacyPatientsImported){
  sql(`BEGIN; INSERT INTO patient_v2.patient_identities(id,full_name,date_of_birth,sex,phone,email,created_at,updated_at) SELECT p.id,coalesce(nullif(trim(p.full_name),''),nullif(trim(u.full_name),''),'Người bệnh'),p.dob,p.gender,p.phone,u.email,p.created_at,p.updated_at FROM patient.patients p LEFT JOIN identity.users u ON u.id=p.user_id WHERE p.dob IS NOT NULL ON CONFLICT(id) DO NOTHING; INSERT INTO patient_v2.platform_user_patient_links(user_id,patient_id) SELECT p.user_id,p.id FROM patient.patients p JOIN patient_v2.patient_identities v ON v.id=p.id JOIN identity.users u ON u.id=p.user_id WHERE p.user_id IS NOT NULL ON CONFLICT DO NOTHING; INSERT INTO patient_v2.clinic_patient_links(id,clinic_id,patient_id,patient_code,status,verified_at) SELECT gen_random_uuid(),${literal(cfg.clinic)},v.id,coalesce(nullif(p.patient_code,''),'BN-'||left(replace(v.id::text,'-',''),16)),'VERIFIED',now() FROM patient_v2.patient_identities v JOIN patient.patients p ON p.id=v.id ON CONFLICT DO NOTHING; COMMIT;`);cfg.legacyPatientsImported=true;save();
 }
 const names=['Nguyễn Thị Lan','Trần Văn Minh','Lê Thu Hương','Phạm Quốc Hùng','Hoàng Ngọc Linh','Vũ Đức Nam','Đỗ Thị Thanh','Đặng Quang Hải','Bùi Minh Anh','Phan Văn Bình','Hồ Ngọc Mai','Võ Thanh Tùng','Nguyễn Hồng Nhung','Trần Đức Long','Lê Thị Hạnh','Phạm Gia Bảo','Hoàng Thu Trang','Vũ Minh Tuấn','Đỗ Ngọc Hà','Đặng Thị Phương','Bùi Văn Sơn','Phan Thu Giang','Hồ Thanh An','Võ Quốc Khánh'];
 for(let n=0;n<48;n++){
  const key=n===0?'patient':'patient'+(n+1),name=names[n%names.length];await account(key,name,key+'@annhien.local');
  const monthDay=`-${String(1+n%12).padStart(2,'0')}-${String(1+n%27).padStart(2,'0')}`,birthDate=`${n%6===2?2012+n%11:1975+n%30}${monthDay}`;
  if(!cfg.patients[key]){const p=await api('patient','/api/me/patient-profile','PUT',tokens[key],{fullName:name,dateOfBirth:birthDate,sex:n%2?'MALE':'FEMALE',phone:'000'+String(1000000+n),email:cfg.accounts[key].email,expectedVersion:0});cfg.patients[key]=p.patientId;save();}
  else if(cfg.seedVersion===1&&n%6===2){
   const p=await api('patient','/api/me/patient-profile','GET',tokens[key]);
   // Correct only the unchanged DOB from this seeder's first fixture version.
   if(p.dateOfBirth===`${1975+n%30}${monthDay}`)await api('patient','/api/me/patient-profile','PUT',tokens[key],{fullName:p.fullName,dateOfBirth:birthDate,sex:p.sex,phone:p.phone,email:p.email,expectedVersion:p.version});
  }
 }
 cfg.points??={};
 const pointBase=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}/service-points`;const points=await api('encounter',pointBase,'GET',tokens.owner);
 const roomNames=['Phòng Nội tổng quát','Phòng Y học gia đình','Phòng Nhi khoa','Phòng Tim mạch','Phòng Da liễu','Phòng Tai mũi họng','Phòng xét nghiệm'];
 for(let n=1;n<=roomNames.length;n++){const code='K'+String(n).padStart(2,'0');let p=points.find(p=>p.code===code);if(!p)p=await write('encounter',pointBase,tokens.owner,{code,name:roomNames[n-1]});cfg.points[code]=p.id;save();}
 console.log('Configured one operating clinic, 6 doctors, 9 services, 48 patient accounts and existing patient identities.');
 for(let n=0;n<60;n++){
  const key='booking-'+n;if(cfg.appointments[key])continue;
  const patientIndex=n%48,patient=patientIndex===0?'patient':'patient'+(patientIndex+1),doctor=doctors[n%6][0],offering=services[n%6][0];
  let slot;
  for(const offset of n<48?[1+Math.floor(n/12)]:[0,1,2,3]){
   const query=new URLSearchParams({clinicId:cfg.clinic,branchId:cfg.branch,doctorId:cfg.doctors[doctor].id,offeringId:cfg.offerings[offering],date:date(offset)});
   const slots=await api('appointment','/api/public/availability?'+query);slot=slots.find(s=>s.remaining>0);if(slot)break;
  }
  if(!slot)throw Error('No source capacity for '+key);
  const hold=await write('appointment','/api/appointments/holds',tokens[patient],{clinicId:cfg.clinic,branchId:cfg.branch,doctorId:cfg.doctors[doctor].id,offeringId:cfg.offerings[offering],slotId:slot.slotId,patientId:cfg.patients[patient]},'operating-hold-'+n);
  const a=await write('appointment','/api/appointments',tokens[patient],{clinicId:cfg.clinic,patientId:cfg.patients[patient],holdId:hold.holdId},'operating-confirm-'+n);cfg.appointments[key]=a.id;save();
 }
 const base=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
 // Complete earlier visits before leaving active care and waiting tickets in
 // each doctor's room, respecting the real queue order and room occupancy.
 for(const n of [12,13,14,15,16,17,8,9,10,11,6,7,0,1,2,3,4,5]){
  const key='visit-'+n;if(cfg.visits[key]?.ready)continue;
  const doctor=doctors[n%6][0],patient=n===0?'patient':'patient'+(n+1),point=cfg.points['K'+String(1+n%6).padStart(2,'0')];
  let v=cfg.visits[key]?.id?await api('encounter',`${base}/visits/${cfg.visits[key].id}`,'GET',tokens.reception):await write('encounter',`${base}/visits/walk-in`,tokens.reception,{patientId:cfg.patients[patient],doctorId:cfg.doctors[doctor].id,servicePointId:point,offeringId:cfg.offerings.consultation,reason:'Đến khám ngoại trú tại phòng khám'},'operating-walk-in-'+n);
  cfg.visits[key]={id:v.id};save();
  if(n<6){cfg.visits[key].ready=true;save();continue;}
  if(v.status==='WAITING'){
   if(v.ticket.state==='WAITING')await write('encounter',`${base}/queue/${v.ticket.id}/call`,tokens.reception,{expectedVersion:v.ticket.version,reason:'Mời bệnh nhân vào phòng khám'});
   v=await api('encounter',`${base}/visits/${v.id}`,'GET',tokens.reception);
   v=await write('encounter',`${base}/doctor/visits/${v.id}/start`,tokens[doctor],{expectedVersion:v.version,reason:'Bắt đầu lượt khám'},'operating-start-'+n);
  }
  if(n<8){cfg.visits[key].ready=true;save();continue;}
  let m=await api('medical',`${base}/visits/${v.id}/draft`,'GET',tokens[doctor]);
  if(m.documentVersion===0)m=await api('medical',`${base}/visits/${v.id}/draft`,'PUT',tokens[doctor],{expectedDocumentVersion:0,content:{reasonForVisit:n%2?'Khám sức khỏe định kỳ':'Đến khám và theo dõi sức khỏe',medicalHistory:'Thông tin tiền sử được ghi nhận khi tiếp nhận.',allergies:'Chưa ghi nhận trong lượt khám này.',vitals:'Đã tiếp nhận thông tin sinh hiệu tại phòng khám.',examination:'Đã thăm khám ngoại trú.',preliminaryDiagnosis:'Đánh giá và theo dõi sức khỏe.',conclusion:'Đã hoàn tất đánh giá trong lượt khám.',instructions:'Theo dõi theo hướng dẫn tại buổi khám.',followUpDate:date(7)},reason:'Lưu hồ sơ khám nội bộ'},'operating-draft-'+n);
  let orders=await api('medical',`${base}/visits/${v.id}/orders`,'GET',tokens[doctor]);let order=orders[0];
  if(!order)order=await write('medical',`${base}/visits/${v.id}/orders`,tokens[doctor],{expectedCaseVersion:m.caseVersion,offeringId:cfg.offerings.laboratory,reason:'Thực hiện xét nghiệm theo chỉ định'},'operating-order-'+n);
  if(order.state==='ORDERED')order=await write('medical',`${base}/orders/${order.id}/accept`,tokens[doctor],{expectedVersion:order.version,reason:'Tiếp nhận chỉ định'},'operating-lab-accept-'+n);
  if(order.state==='ACCEPTED')order=await write('medical',`${base}/orders/${order.id}/process`,tokens[doctor],{expectedVersion:order.version,reason:'Đang thực hiện xét nghiệm'},'operating-lab-process-'+n);
  if(n<10){if(v.status==='IN_PROGRESS')await write('encounter',`${base}/doctor/visits/${v.id}/await-results`,tokens[doctor],{expectedVersion:v.version,reason:'Chờ kết quả xét nghiệm'},'operating-await-'+n);cfg.visits[key].ready=true;save();continue;}
  if(order.state==='PROCESSING')order=await write('medical',`${base}/orders/${order.id}/results`,tokens[doctor],{expectedVersion:order.version,sourceRef:'XN-'+date(0).replaceAll('-','')+'-'+n,content:'Đã ghi nhận kết quả xét nghiệm trong hồ sơ nội bộ; chờ bác sĩ xem xét.',reason:'Ghi nhận kết quả xét nghiệm'},'operating-result-'+n);
  if(n<12){cfg.visits[key].ready=true;save();continue;}
  if(order.state==='RESULTED')order=await write('medical',`${base}/orders/${order.id}/reviews`,tokens[doctor],{expectedVersion:order.version,resultVersion:order.resultVersion,reason:'Đã xem kết quả xét nghiệm'},'operating-review-'+n);
  m=await api('medical',`${base}/visits/${v.id}/draft`,'GET',tokens[doctor]);if(m.status!=='VALIDATED')m=await write('medical',`${base}/visits/${v.id}/validate`,tokens[doctor],{expectedVersion:m.caseVersion,reason:'Hoàn tất kiểm tra hồ sơ nội bộ'},'operating-validate-'+n);
  if(v.status!=='CLINICALLY_COMPLETED'&&v.status!=='CLOSED')v=await write('encounter',`${base}/doctor/visits/${v.id}/complete`,tokens[doctor],{expectedVersion:v.version,medicalCaseVersion:m.caseVersion,consultationConfirmed:true,reason:'Hoàn tất lượt khám nội bộ'},'operating-complete-'+n);
  // Source charge relay may still be in flight; the bill endpoint reads its source.
  const bill=await write('billing',`${base}/bills`,tokens.cashier,{encounterId:v.id,reason:'Lập phiếu thu cho dịch vụ đã thực hiện'},'operating-bill-'+n);
  if(!cfg.shift){const shift=await write('billing',`${base}/collection-shifts`,tokens.cashier,{reason:'Ca thu phí tại quầy'},'operating-shift');cfg.shift=shift.id;save();}
  if(n>=14&&bill.paidVnd===0){const amount=n===14?Math.floor(bill.remainingVnd/2):bill.remainingVnd;await write('billing',`${base}/bills/${bill.id}/payments`,tokens.cashier,{expectedVersion:bill.version,shiftId:cfg.shift,amountVnd:amount,method:'CASH',reason:'Ghi nhận khoản thu tại quầy'},'operating-payment-'+n);}
  cfg.visits[key].ready=true;cfg.visits[key].billId=bill.id;save();
 }
 cfg.seeded=true;cfg.seedVersion=2;cfg.seededAt=new Date().toISOString();save();
 fs.writeFileSync(path.join(path.dirname(configPath),'dataset-summary.json'),JSON.stringify({status:'PASS',clinic:'Phòng khám An Nhiên',database:cfg.databaseName,source:'main PostgreSQL, additive V2 schemas and real service APIs',doctors:6,services:9,patientAccounts:48,confirmedAppointments:Object.keys(cfg.appointments).length,visits:Object.keys(cfg.visits).length,legacyPatientIdentitiesCopied:true,clinicalRelease:'DISABLED',onlinePayment:'DISABLED',fictionalTestData:true},null,2));
 console.log('Operating clinic data ready: 60 appointments and 18 visits for ADMIN, STAFF, DOCTOR and PATIENT.');
}
await seed();
