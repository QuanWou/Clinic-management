import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID,createHmac} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '../frontend/node_modules/@playwright/test/index.mjs';

// All writes are confined to a disposable copy of the project's verified snapshot.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime/realtime-e2e');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
assert.ok(process.argv.includes('--sandbox'));
assert.match(cfg.databaseName,/^clinic_realtime_e2e_[a-f0-9]+$/);
assert.equal(cfg.ports.gateway,18300);
const base=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
const patientBase=`/api/me/clinics/${cfg.clinic}/branches/${cfg.branch}`;
const run=randomUUID(),reason='Disposable realtime verification '+run+'; not clinical treatment';
const tokens={},streams=[],pages={},contexts=[];
const report={status:'RUNNING',environment:'isolated PostgreSQL snapshot + five real cores + gateway + browser',provider:'signed simulated payOS webhook; no real bank transaction',checks:[],browserErrors:[],navigation:{},latencyMs:{}};
const check=(name,ok=true)=>{assert.ok(ok,name);report.checks.push(name);console.log('PASS: '+name);};
const sql=query=>execFileSync('C:/Program Files/PostgreSQL/17/bin/psql.exe',['-w','-X','-h',cfg.databaseHost,'-p',String(cfg.databasePort),'-U',cfg.databaseUser,'-d',cfg.databaseName,'-At','-v','ON_ERROR_STOP=1'],{input:query,encoding:'utf8',env:{...process.env,PGPASSWORD:cfg.databasePassword}}).trim();
async function request(module,route,role='staff',method='GET',body,key,expected){
 const response=await fetch(`http://127.0.0.1:${cfg.ports.gateway}/s1/${module}${route}`,{method,signal:AbortSignal.timeout(25000),headers:{...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{if(response.status===expected)return null;throw new Error(`${module} ${method} ${route}: non-JSON HTTP ${response.status}`);}
 if(expected)assert.equal(response.status,expected,`${module} ${route}`);else assert.ok(response.ok,`${module} ${method} ${route}: HTTP ${response.status} ${value.code??value.error?.message??''}`);return value;
}
async function login(role,key){const account=cfg.accounts[key];let result;try{result=await request('auth','/api/auth/login',role,'POST',{email:account.email,password:account.password});}catch(e){throw new Error(`Fixture login ${key}: ${e.message}`);}tokens[role]=result.data.accessToken;}
async function until(predicate,message,timeout=25000){const end=Date.now()+timeout;while(Date.now()<end){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,120));}throw new Error(message);}
async function stream(module,route,role){
 const controller=new AbortController(),events={ready:0,changed:0,payloads:[]};streams.push(controller);
 const response=await fetch(`http://127.0.0.1:${cfg.ports.gateway}/s1/${module}${route}`,{signal:controller.signal,headers:{...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`} :{}),Accept:'text/event-stream'}});
 assert.ok(response.ok&&response.headers.get('content-type')?.startsWith('text/event-stream'),`${module} stream authorized`);
 void(async()=>{let current=response;while(!controller.signal.aborted){let reader;try{
  reader=current.body.getReader();let buffer='';const decoder=new TextDecoder();while(!controller.signal.aborted){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const event of ['ready','changed'])if(new RegExp(`^event: *${event}$`,'m').test(frame)){events[event]++;events.payloads.push(frame.match(/^data: *(.*)$/m)?.[1]);}}}
 }catch{}finally{if(reader)try{await reader.cancel();reader.releaseLock();}catch{}}
 if(controller.signal.aborted)break;await new Promise(resolve=>setTimeout(resolve,1000));try{current=await fetch(`http://127.0.0.1:${cfg.ports.gateway}/s1/${module}${route}`,{signal:controller.signal,headers:{...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`} :{}),Accept:'text/event-stream'}});if(!current.ok)break;}catch{break;}
 }})();
 await until(()=>events.ready>0,`${module} ${role} initial ready missing`);return {events,close:()=>controller.abort()};
}
const browser=await chromium.launch({channel:'msedge',headless:true});
// Decorative remote styles must not gate the real application's module startup
// when internet font delivery is unavailable. All app/API traffic stays real.
async function isolateDecorativeNetwork(target){
 await target.route('https://fonts.googleapis.com/**',route=>route.abort());
 await target.route('https://fonts.gstatic.com/**',route=>route.abort());
}
async function openWorkspace(name,key,view){
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',timezoneId:'Asia/Bangkok'});contexts.push(context);const page=await context.newPage();pages[name]={page,context};report.navigation[name]=0;
 await isolateDecorativeNetwork(context);
 page.on('pageerror',error=>report.browserErrors.push({surface:name,message:error.message}));page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())report.navigation[name]++;});
 await page.goto(`http://127.0.0.1:${cfg.ports.web}/workspace?view=${view}&clinicId=${cfg.clinic}`,{waitUntil:'domcontentloaded'});
 await page.getByLabel('Email',{exact:true}).fill(cfg.accounts[key].email);await page.getByLabel('Mật khẩu',{exact:true}).fill(cfg.accounts[key].password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.locator('.workspace-topbar').waitFor({timeout:30000});return page;
}
async function openPatient(){
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',timezoneId:'Asia/Bangkok'});contexts.push(context);const page=await context.newPage();pages.patient={page,context};report.navigation.patient=0;
 await isolateDecorativeNetwork(context);
 page.on('pageerror',error=>report.browserErrors.push({surface:'patient',message:error.message}));page.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame())report.navigation.patient++;});
 await page.goto(`http://127.0.0.1:${cfg.ports.web}/tai-khoan/lich-kham`,{waitUntil:'domcontentloaded'});await page.getByLabel('Email',{exact:true}).fill(cfg.accounts.patient.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(cfg.accounts.patient.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByRole('button',{name:'Lịch khám',exact:true}).waitFor({timeout:30000});return page;
}
async function verify(){
 // A frozen snapshot may predate the private runtime account passwords. Rehash through
 // the real registration endpoint, then update only these copied QA identities.
 const qaPassword=randomUUID()+randomUUID();
 const qa=await request('auth','/api/auth/register','fixture','POST',{email:`realtime-${run}@example.invalid`,password:qaPassword,fullName:'Disposable realtime fixture'});
 const fixtureUser=qa.data.userId;
 const keys=['reception','cashier','doctor','owner','patient','patient2','doctor2'];
 for(const key of ['doctor','doctor2']){
  const identity=JSON.parse(sql(`select json_build_object('email',u.email,'userId',u.id) from doctor.practitioners p join identity.users u on u.id=p.platform_user_id where p.id='${cfg.doctors[key].id}';`));
  cfg.accounts[key]={...cfg.accounts[key],...identity};
 }
 for(const key of keys){
  const email=cfg.accounts[key].email.replaceAll("'","''");
  const id=sql(`update identity.users set password_hash=(select password_hash from identity.users where id='${fixtureUser}') where email='${email}' returning id;`).split('\n')[0].trim();
  assert.match(id,/^[a-f0-9-]{36}$/,`Copied fixture identity ${key} exists`);
  cfg.accounts[key].userId=id;cfg.accounts[key].password=qaPassword;
 }
 // Clear only copied active encounters so the fixture is deterministic and does not impersonate care.
 sql("update encounter_v2.queue_tickets set state='CANCELLED' where visit_id in(select id from encounter_v2.visits where status='IN_PROGRESS');update encounter_v2.visits set status='INTERRUPTED',row_version=row_version+1 where status='IN_PROGRESS';");
 await login('staff','reception');await login('doctor','doctor');await login('admin','owner');await login('patient','patient');await login('patient2','patient2');await login('doctor2','doctor2');
 const profile=await request('patient','/api/me/patient-profile','patient');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const initialAffiliations=await request('doctor',base+'/doctor-affiliations','admin');
 const initialAffiliation=initialAffiliations.find(item=>item.practitionerId===cfg.doctors.doctor.id);
 assert.ok(initialAffiliation,'Copied doctor affiliation exists');
 if(!initialAffiliation.active||!initialAffiliation.publicVisible){await request('doctor',base+`/doctor-affiliations/${initialAffiliation.id}`,'admin','PUT',{...initialAffiliation,expectedVersion:initialAffiliation.version,active:true,publicVisible:true});}
 const options=await request('appointment',`/api/public/booking-options?clinicId=${cfg.clinic}&branchId=${cfg.branch}`);
 const doctorId=cfg.doctors.doctor.id;
 const choice=options.doctors.find(item=>item.doctorId===doctorId);assert.ok(choice,'Configured doctor is booking eligible');
 const offering=options.offerings.find(item=>item.specialtyCode===choice.specialtyCode);assert.ok(offering);
 sql(`update appointment_v2.slot_reservations set state='EXPIRED' where clinic_id='${cfg.clinic}' and branch_id='${cfg.branch}' and state='ACTIVE'; update appointment_v2.appointments set status='CANCELLED',row_version=row_version+1 where clinic_id='${cfg.clinic}' and branch_id='${cfg.branch}' and doctor_id='${doctorId}' and slot_id in(select id from appointment_v2.capacity_slots where (starts_at at time zone 'Asia/Bangkok')::date='${today}') and status in('CONFIRMED','CHECKED_IN','FULFILLED');`);
 const available=await request('appointment','/api/public/availability/evaluate?'+new URLSearchParams({clinicId:cfg.clinic,branchId:cfg.branch,doctorId,offeringId:offering.offeringId,date:today}));
 assert.ok(available.slots.length,'A current-day fixture slot is available: '+available.reason);const slot=available.slots.find(item=>item.remaining>0);assert.ok(slot);
 // One remaining seat makes the two-session booking race explicit.
 sql(`update appointment_v2.capacity_slots set capacity=1+(select count(*) from appointment_v2.appointments where slot_id='${slot.slotId}' and status in('CONFIRMED','CHECKED_IN','FULFILLED')) where id='${slot.slotId}';`);
 const receptionStream=await stream('encounter',base+'/reception/events','staff');
 const doctorStream=await stream('encounter',base+'/doctor/events','doctor');
 const otherDoctorStream=await stream('encounter',base+'/doctor/events','doctor2');
 const medicalStream=await stream('medical',base+'/doctor/events','doctor');
 const patientEncounter=await stream('encounter',patientBase+'/events','patient');
 const patientMedical=await stream('medical',patientBase+'/events','patient');
 const patientBilling=await stream('billing',patientBase+'/events','patient');
 const patientAppointments=await stream('appointment',`/api/me/appointment-events?clinicId=${cfg.clinic}&patientId=${profile.patientId}`,'patient');
 const notifications=await stream('notification','/api/me/notifications/events','patient');
 const otherNotifications=await stream('notification','/api/me/notifications/events','patient2');
 const adminBilling=await stream('billing',base+'/reception/events','admin');
 const adminAppointments=await stream('appointment',base+'/reception/events','admin');
 check('Doctor, Patient, Reception and Admin streams are authorized through the real gateway');
 await request('encounter',base+'/reception/events','patient','GET',undefined,undefined,403);
 await request('medical',base+'/doctor/events','staff','GET',undefined,undefined,403);
 await request('encounter',`/api/clinics/${randomUUID()}/branches/${cfg.branch}/doctor/events`,'doctor','GET',undefined,undefined,403);
 await request('appointment',`/api/me/appointment-events?clinicId=${cfg.clinic}&patientId=${profile.patientId}`,'patient2','GET',undefined,undefined,403);
 check('Unauthorized clinical, tenant and other-patient subscriptions are rejected server-side');
 const receptionist=await openWorkspace('reception','reception','reception');
 const doctorPage=await openWorkspace('doctor','doctor','doctor');
 const cashier=await openWorkspace('cashier','cashier','billing');
 await cashier.getByRole('heading',{name:'Thu phí & ca thu',exact:true}).waitFor();
 await cashier.getByLabel('Địa điểm thu phí').waitFor({state:'attached'});
 if(await cashier.getByLabel('Địa điểm thu phí').isVisible())await cashier.getByLabel('Địa điểm thu phí').selectOption(cfg.branch);
 await cashier.getByLabel('Danh sách phiếu').waitFor();
 const admin=await openWorkspace('admin','owner','overview');
 const patientPage=await openPatient();
 const unreadBefore=(await request('notification','/api/me/notifications/unread-count','patient')).count;
 await until(async()=>Number((await patientPage.getByRole('button',{name:/Thông báo, \d+ chưa đọc/}).getAttribute('aria-label')).match(/\d+/)[0])===unreadBefore,'Initial inbox count missing');
 await doctorPage.getByRole('heading',{name:'Hàng đợi khám của bác sĩ'}).waitFor();
 await receptionist.getByText('Đang cập nhật trực tiếp',{exact:true}).waitFor({timeout:30000});
 check('Five simultaneously open authorized browser sessions are ready');
 const baselineNavigation={...report.navigation};
 const holdInput={clinicId:cfg.clinic,branchId:cfg.branch,patientId:profile.patientId,doctorId,offeringId:offering.offeringId,slotId:slot.slotId};
 const hold=await request('appointment','/api/appointments/holds','patient','POST',holdInput,run+'-hold');
 const secondProfile=await request('patient','/api/me/patient-profile','patient2');
 await request('appointment','/api/appointments/holds','patient2','POST',{...holdInput,patientId:secondProfile.patientId},run+'-second-hold',409);
 const appointment=await request('appointment','/api/appointments','patient','POST',{clinicId:cfg.clinic,patientId:profile.patientId,holdId:hold.holdId},run+'-confirm');
 await until(()=>patientAppointments.events.changed>0,'Own appointment invalidation missing');
 await patientPage.getByText(appointment.appointmentCode,{exact:true}).waitFor({timeout:20000});
 await receptionist.getByText(new RegExp(appointment.appointmentCode)).first().waitFor({timeout:20000});
 check('Booking rejects a stale second-session slot; Reception and Patient lists update without navigation');
 await until(async()=>Number((await patientPage.getByRole('button',{name:/Thông báo, \d+ chưa đọc/}).getAttribute('aria-label')).match(/\d+/)[0])>unreadBefore,'Live notification badge did not update');
 check('Notification badge changes automatically in the already-open patient session');
 const point=await request('encounter',base+'/service-points','admin','POST',{code:'RT'+run.replaceAll('-','').slice(0,6).toUpperCase(),name:'Disposable realtime verification'});
 const tick=Date.now();let visit=await request('encounter',base+`/appointments/${appointment.id}/check-in`,'staff','POST',{patientId:profile.patientId,servicePointId:point.id,reason},run+'-arrival');
 await doctorPage.getByText(visit.ticket.code,{exact:true}).waitFor({timeout:20000});report.latencyMs.receptionToDoctor=Date.now()-tick;
 check('Reception check-in appears automatically in the already-open Doctor worklist');
 await receptionist.getByRole('button',{name:'Hàng đợi',exact:true}).click();
 let eventCount=receptionStream.events.changed;
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/call`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-call');
 await until(()=>receptionStream.events.changed>eventCount,'Doctor call invalidation missing');
 await until(async()=>await receptionist.locator('tr').filter({hasText:visit.ticket.code}).innerText().then(text=>text.includes('Đã gọi')),'Reception did not show called state');
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/start`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-start');
 await until(async()=>await receptionist.locator('tr').filter({hasText:visit.ticket.code}).innerText().then(text=>text.includes('Đang khám')),'Reception did not show examination state');
 check('Doctor call and start update Reception to Đã gọi / Đang khám automatically');
 let draft=await request('medical',base+`/visits/${visit.id}/draft`,'doctor','PUT',{expectedDocumentVersion:0,content:{reasonForVisit:reason,conclusion:'Verified only in disposable sandbox',instructions:'Not for treatment'},reason},run+'-draft');
 let order=await request('medical',base+`/visits/${visit.id}/orders`,'doctor','POST',{expectedCaseVersion:draft.caseVersion,offeringId:cfg.offerings.laboratory,reason},run+'-order');
 order=await request('medical',base+`/orders/${order.id}/accept`,'doctor','POST',{expectedVersion:order.version,reason},run+'-accept');
 order=await request('medical',base+`/orders/${order.id}/process`,'doctor','POST',{expectedVersion:order.version,reason},run+'-process');
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/await-results`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-await');
 const beforeRelease=await request('medical',patientBase+'/medical-records','patient');check('Unreleased clinical records are withheld',!beforeRelease.some(row=>row.encounterId===visit.id));
 const patientMedicalCount=patientMedical.events.changed;
 order=await request('medical',base+`/orders/${order.id}/results`,'doctor','POST',{expectedVersion:order.version,sourceRef:run,content:'Disposable authenticated lab result',reason},run+'-result');
 await doctorPage.getByRole('heading',{name:'Có kết quả mới',exact:true}).waitFor({timeout:20000});
 await new Promise(resolve=>setTimeout(resolve,300));check('Lab result reaches Doctor worklist but emits no unreleased patient hint',patientMedical.events.changed===patientMedicalCount&&medicalStream.events.changed>0);
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/resume-queue`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-resume');
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/call`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-resume-call');
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/start`,'doctor','POST',{expectedVersion:visit.version,reason},run+'-resume-start');
 order=await request('medical',base+`/orders/${order.id}/reviews`,'doctor','POST',{expectedVersion:order.version,resultVersion:order.resultVersion,reason},run+'-review');
 draft=await request('medical',base+`/visits/${visit.id}/draft`,'doctor');
 await patientPage.getByRole('button',{name:'Hồ sơ khám',exact:true}).click();
 await patientPage.getByRole('heading',{name:'Hồ sơ khám đã hoàn tất',exact:true}).waitFor();
 draft=await request('medical',base+`/visits/${visit.id}/validate`,'doctor','POST',{expectedVersion:draft.caseVersion,reason},run+'-validate');
 visit=await request('encounter',base+`/doctor/visits/${visit.id}/complete`,'doctor','POST',{expectedVersion:visit.version,medicalCaseVersion:draft.caseVersion,consultationConfirmed:true,reason},run+'-complete');
 await until(()=>patientEncounter.events.changed>0,'Release completion invalidation missing');
 const released=await request('medical',patientBase+'/medical-records','patient');check('Only validated, completed records and reviewed results are released',released.some(row=>row.encounterId===visit.id&&row.results.some(result=>result.content==='Disposable authenticated lab result')));
 const releasedCard=patientPage.locator('.patient-medical-record').filter({hasText:reason});await releasedCard.waitFor({timeout:20000});
 await releasedCard.getByText('Kết quả đã được bác sĩ xem (1)',{exact:true}).click();await releasedCard.getByText('Disposable authenticated lab result',{exact:true}).waitFor({timeout:20000});
 check('Already-open Patient record view updates automatically through the release-filtered source');
 let bill=await request('billing',base+'/bills','staff','POST',{encounterId:visit.id,reason},run+'-bill');
 await until(()=>patientBilling.events.changed>0&&adminBilling.events.changed>0,'Bill invalidation missing');
 await patientPage.getByRole('button',{name:'Hóa đơn',exact:true}).click();await patientPage.getByText('Phiếu thu khám bệnh',{exact:true}).first().waitFor({timeout:20000});
 // Seed a pending gateway intent, then exercise the production signature verifier and confirmation transaction.
 // This makes no outbound payment-provider call and transfers no real money.
 const intent=randomUUID(),code=String(Date.now()),link='qa-'+run;
 const display=await request('billing',base+`/bills/${bill.id}/payment-display`,'staff','POST',{method:'BANK_TRANSFER',expectedVersion:bill.version},run+'-display');
 const displayToken=new URL(display.displayUrl).pathname.split('/').at(-1);
 const displayPage=await browser.newPage();pages.display={page:displayPage};report.navigation.display=0;displayPage.on('request',request=>{if(request.isNavigationRequest()&&request.frame()===displayPage.mainFrame())report.navigation.display++;});displayPage.on('pageerror',error=>report.browserErrors.push({surface:'display',message:error.message}));
 await displayPage.route('https://img.vietqr.io/**',route=>route.abort());
 await isolateDecorativeNetwork(displayPage);
 await displayPage.goto(`http://127.0.0.1:${cfg.ports.web}/payment-display/${displayToken}`,{waitUntil:'domcontentloaded'});await displayPage.getByText('QUÉT MÃ ĐỂ THANH TOÁN',{exact:true}).waitFor({timeout:20000});
 const displayStream=await stream('billing',`/api/public/payment-displays/${displayToken}/events`,null);
 sql(`insert into billing_v2.payment_intents(id,clinic_id,branch_id,bill_id,patient_id,initiated_by,provider,provider_order_code,amount_vnd,status,client_ip,payment_link_id,expires_at) values('${intent}','${cfg.clinic}','${cfg.branch}','${bill.id}','${profile.patientId}','${cfg.accounts.patient.userId}','PAYOS','${code}',${bill.remainingVnd},'PENDING','127.0.0.1','${link}',now()+interval '15 minutes');`);
 await cashier.getByLabel('Danh sách phiếu').selectOption('all');
 const cashierBill=cashier.locator(`[data-bill-id="${bill.id}"]`);await cashierBill.waitFor();
 const adminBefore=await admin.locator('.admin-finance-strip').innerText();
 // Patient disconnects before the other session confirms payment.
 await pages.patient.context.setOffline(true);
 const data={orderCode:Number(code),amount:bill.remainingVnd,currency:'VND',reference:'qa-'+run,paymentLinkId:link,code:'00'};
 const signed=Object.keys(data).sort().map(key=>`${key}=${data[key]}`).join('&');
 const signature=createHmac('sha256',cfg.payments.PAYOS_CHECKSUM_KEY).update(signed).digest('hex');
 const acknowledgement=await request('billing',base.replace('/api/clinics/','/api/public/payments/clinics/')+'/payos/webhook',null,'POST',{data,signature});
 check('Verified simulated payOS webhook commits Billing PAID',acknowledgement.status==='PAID');
 const replay=await request('billing',base.replace('/api/clinics/','/api/public/payments/clinics/')+'/payos/webhook',null,'POST',{data,signature});
 check('Duplicate webhook produces one persisted receipt',replay.status==='ALREADY_PAID'&&Number(sql(`select count(*) from billing_v2.payments where bill_id='${bill.id}'`))===1);
 await displayPage.getByText('THANH TOÁN THÀNH CÔNG',{exact:true}).waitFor({timeout:20000});
 await until(async()=>(await cashierBill.innerText()).includes('Đã tất toán'),'Already-open Cashier balance did not update');
 await until(async()=>(await admin.locator('.admin-finance-strip').innerText())!==adminBefore,'Already-open Admin finance counters did not update');
 check('Already-open Cashier balance and Admin financial counters update automatically');
 await until(()=>displayStream.events.changed>0,'Capability-scoped display invalidation missing');
 check('Customer payment display updates automatically through its own bill capability');
 await pages.patient.context.setOffline(false);await patientPage.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await patientPage.locator(`[data-bill-id="${bill.id}"]`).getByText('Đã thanh toán',{exact:true}).waitFor({timeout:25000});
 bill=await request('billing',patientBase+`/bills/${bill.id}`,'patient');check('Patient reconnect restores the authoritative payment and receipt',bill.status==='PAID'&&bill.receipts.length===1);
 const stableCount=otherNotifications.events.changed;
 await until(async()=>notifications.events.changed>0&&(await request('notification','/api/me/notifications','patient')).some(row=>row.billing_id===bill.id),'Patient notification delivery missing');
 await patientPage.getByRole('button',{name:/Thông báo, \d+ chưa đọc/}).first().waitFor({timeout:20000});
 check('Notification inbox updates for its recipient without leaking to the other patient',otherNotifications.events.changed===stableCount);
 const inbox=await request('notification','/api/me/notifications','patient'),notification=inbox.find(row=>row.billing_id===bill.id);
 await request('notification',`/api/me/notifications/${notification.id}/read`,'patient','POST',{});
 const read=await request('notification','/api/me/notifications','patient');check('Persisted notification read state is idempotent',!!read.find(row=>row.id===notification.id).read_at);
 const changed=patientBilling.events.changed;
 sql(`begin;select pg_notify('billing_patient_'||md5('${cfg.clinic}:${cfg.branch}:${profile.patientId}'),'rolled-back');rollback;`);
 await new Promise(resolve=>setTimeout(resolve,700));check('Rolled-back invalidation is not published',patientBilling.events.changed===changed);
 sql(`select pg_notify('billing_patient_'||md5('${cfg.clinic}:${cfg.branch}:${profile.patientId}'),'PENDING-version-1');`);
 await until(()=>patientBilling.events.changed>changed,'Delayed hint missing');
 const latest=await request('billing',patientBase+`/bills/${bill.id}`,'patient');check('A delayed older hint cannot regress committed payment state',latest.status==='PAID');
 check('Realtime never forwards sensitive PostgreSQL payloads',streams.length>0&&[patientBilling,doctorStream,medicalStream,notifications,displayStream].every(item=>item.events.payloads.every(payload=>payload==='refetch')));
 check('Assigned-doctor channels isolate unrelated worklists',otherDoctorStream.events.changed===0);
 const reconnect=await stream('encounter',base+'/doctor/events','doctor');check('Reconnect starts with authoritative refetch readiness',reconnect.events.ready===1);
 // Booking eligibility is an owner check at confirmation, independent of projection lag.
 const bookingPage=await browser.newPage();await isolateDecorativeNetwork(bookingPage);await bookingPage.goto(`http://127.0.0.1:${cfg.ports.web}/dat-lich`,{waitUntil:'domcontentloaded'});
 await bookingPage.getByRole('combobox',{name:/^Chuyên khoa/}).selectOption({label:choice.specialtyName});await bookingPage.getByRole('combobox',{name:/^Dịch vụ/}).selectOption(offering.offeringId);
 await bookingPage.getByRole('radio',{name:/Chọn bác sĩ cụ thể/}).check();await bookingPage.getByRole('combobox',{name:/^Bác sĩ/}).selectOption(doctorId);
 const nextAvailable=await request('appointment','/api/public/availability/evaluate?'+new URLSearchParams({clinicId:cfg.clinic,branchId:cfg.branch,doctorId,offeringId:offering.offeringId,date:today}));
 const nextSlot=nextAvailable.slots.find(item=>item.remaining>0);assert.ok(nextSlot);
 const obsoleteHold=await request('appointment','/api/appointments/holds','patient2','POST',{...holdInput,patientId:secondProfile.patientId,slotId:nextSlot.slotId},run+'-obsolete-hold');
 const affiliations=await request('doctor',base+'/doctor-affiliations','admin'),affiliation=affiliations.find(item=>item.practitionerId===doctorId);
 assert.ok(affiliation);await request('doctor',base+`/doctor-affiliations/${affiliation.id}`,'admin','PUT',{expectedVersion:affiliation.version,specialtyCode:affiliation.specialtyCode,specialtyName:affiliation.specialtyName,professionalTitle:affiliation.professionalTitle,effectiveFrom:affiliation.effectiveFrom,effectiveUntil:affiliation.effectiveUntil,active:false,publicVisible:affiliation.publicVisible});
 await until(async()=>!(await request('appointment',`/api/public/booking-options?clinicId=${cfg.clinic}&branchId=${cfg.branch}`)).doctors.some(item=>item.doctorId===doctorId),'Disabled doctor still bookable');
 await request('appointment','/api/appointments/holds','patient2','POST',{...holdInput,patientId:secondProfile.patientId},run+'-obsolete-doctor',404);
 await request('appointment','/api/appointments','patient2','POST',{clinicId:cfg.clinic,patientId:secondProfile.patientId,holdId:obsoleteHold.holdId},run+'-obsolete-confirm',404);
 await until(()=>bookingPage.getByRole('combobox',{name:/^Bác sĩ/}).evaluateAll((elements,oldDoctor)=>elements.every(element=>element.value!==oldDoctor),doctorId),'Already-open public doctor selection did not revalidate',40000);
 check('Admin disables doctor eligibility; already-open public selection updates and stale hold confirmation is rejected');
 check('Cashier and Admin retain active operational subscriptions',await cashier.getByText('Đang cập nhật trực tiếp',{exact:true}).count()===1&&adminAppointments.events.ready>0&&adminBilling.events.changed>0);
 // Explicit tab navigation is recorded separately from data synchronization.
 check('No synchronization reload occurs on Reception, Doctor, Cashier, Admin or Display',report.navigation.reception===baselineNavigation.reception&&report.navigation.doctor===baselineNavigation.doctor&&report.navigation.cashier===baselineNavigation.cashier&&report.navigation.admin===baselineNavigation.admin&&report.navigation.display===1);
 check('All open browser surfaces remain free of JavaScript errors',report.browserErrors.length===0);
 report.status='PASS';
}
try{await verify();}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);if(pages.cashier){console.error('Cashier diagnostics: '+JSON.stringify({alerts:await pages.cashier.page.getByRole('alert').allTextContents(),branchSelect:await pages.cashier.page.getByLabel('Địa điểm thu phí').count()}));}}
finally{streams.forEach(controller=>controller.abort());report.checkedAt=new Date().toISOString();fs.writeFileSync(path.join(runtime,'realtime-system-report.json'),JSON.stringify(report,null,2));await browser.close();}
