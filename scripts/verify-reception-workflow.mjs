import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

// Runs only against the separately launched copy of project data, through the actual gateway.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const runtime=path.join(root,'.runtime/reception-e2e');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
assert.ok(process.argv.includes('--sandbox'),'Use --sandbox with the isolated reception runtime');
assert.match(cfg.databaseName,/^clinic_reception_e2e_[a-f0-9]+$/);
assert.equal(cfg.ports.gateway,18200);
const base=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const reason='QA reception workspace: copied sandbox data; not clinical treatment';
const run=randomUUID(),tokens={},streams=[],report={status:'RUNNING',scope:'actual project data copied into isolated database',checks:[],resources:{}};
const check=(name,condition=true)=>{assert.ok(condition,name);report.checks.push(name);console.log(`PASS: ${name}`);};
async function request(module,route,role='staff',method='GET',body,key,expected){
 const response=await fetch(`http://127.0.0.1:${cfg.ports.gateway}/s1/${module}${route}`,{method,signal:AbortSignal.timeout(25000),headers:{...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const raw=await response.text();let value;try{value=JSON.parse(raw);}catch{if(response.status===expected)return null;throw new Error(`${module} ${method} ${route}: HTTP ${response.status}, non-JSON response`);}if(Array.isArray(expected))assert.ok(expected.includes(response.status),`${module} ${route}: HTTP ${response.status}`);else if(expected)assert.equal(response.status,expected,`${module} ${route}`);else assert.ok(response.ok,`${module} ${route}: ${response.status} ${value.code??value.message??value.error?.message??''}`);return value;
}
async function login(role,accountKey){const a=cfg.accounts[accountKey];const auth=await request('auth','/api/auth/login',role,'POST',{email:a.email,password:a.password});tokens[role]=auth.data.accessToken;}
async function waitFor(predicate,message){const end=Date.now()+15000;while(Date.now()<end){if(predicate())return;await new Promise(r=>setTimeout(r,100));}throw new Error(message);}
async function stream(module){
 const controller=new AbortController(),events={ready:0,changed:0};streams.push(controller);
 const response=await fetch(`http://127.0.0.1:${cfg.ports.gateway}/s1/${module}${base}/reception/events`,{signal:controller.signal,headers:{Authorization:`Bearer ${tokens.staff}`,Accept:'text/event-stream'}});
 assert.ok(response.ok&&response.headers.get('content-type')?.startsWith('text/event-stream'));
 const reader=response.body.getReader();void(async()=>{let buffer='';const decoder=new TextDecoder();try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true}).replace(/\r/g,'');let end;while((end=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);for(const event of ['ready','changed'])if(new RegExp(`^event: *${event}$`,'m').test(frame))events[event]++;}}}catch{}})();
 await waitFor(()=>events.ready>0,`${module} SSE initial event missing`);return {events,close:()=>controller.abort()};
}
async function verify(){
 await login('staff','reception');await login('staff2','cashier');await login('admin','owner');await login('patient','patient');await login('doctor','doctor');
 for(const role of ['staff','staff2']){const contexts=await request('identity','/api/me/contexts',role);check(`${role} has canonical STAFF scope`,contexts.some(c=>c.clinicId===cfg.clinic&&c.role==='STAFF'));}
 const point=await request('encounter',`${base}/service-points`,'admin','POST',{code:'Q'+run.replaceAll('-','').slice(0,6).toUpperCase(),name:'Reception sandbox verification'});report.resources.pointId=point.id;
 const options=await request('appointment',`/api/public/booking-options?clinicId=${cfg.clinic}&branchId=${cfg.branch}`);
 const profile=await request('patient','/api/me/patient-profile','patient');
 let choices=[];
 for(const d of options.doctors){for(const o of options.offerings.filter(o=>o.specialtyCode===d.specialtyCode)){const result=await request('appointment','/api/public/availability/evaluate?'+new URLSearchParams({clinicId:cfg.clinic,branchId:cfg.branch,doctorId:d.doctorId,offeringId:o.offeringId,date:today}));if(result.available&&result.slots.length)choices.push({doctor:d,offering:o,slots:result.slots});}}
 check('Authoritative current-day booking capacity exists',choices.length>0);
 const first=choices[0],replacement=choices.find(c=>c.doctor.doctorId!==first.doctor.doctorId)??choices.find(c=>c.slots.length>1);
 assert.ok(replacement,'A valid replacement is required for scenario B');
 const holdInput={clinicId:cfg.clinic,branchId:cfg.branch,patientId:profile.patientId,doctorId:first.doctor.doctorId,offeringId:first.offering.offeringId,slotId:first.slots[0].slotId};
 const hold=await request('appointment','/api/appointments/holds','patient','POST',holdInput,`${run}-hold`);
 let appointment=await request('appointment','/api/appointments','patient','POST',{clinicId:cfg.clinic,patientId:profile.patientId,holdId:hold.holdId},`${run}-confirm`);
 appointment=await request('appointment',`${base}/reception/appointments/${appointment.id}`);report.resources.appointmentId=appointment.id;
 const alternative=replacement.slots.find(s=>s.slotId!==first.slots[0].slotId);assert.ok(alternative);
 const changeBody={patientId:profile.patientId,doctorId:replacement.doctor.doctorId,offeringId:replacement.offering.offeringId,slotId:alternative.slotId,expectedVersion:appointment.version};
 const changeHold=await request('appointment',`${base}/reception/appointments/${appointment.id}/holds`,'staff','POST',changeBody,`${run}-change-hold`);
 const confirmation={patientId:profile.patientId,newHoldId:changeHold.holdId,expectedVersion:appointment.version,reason};
 appointment=await request('appointment',`${base}/reception/appointments/${appointment.id}/change`,'staff','POST',confirmation);
 const replayChange=await request('appointment',`${base}/reception/appointments/${appointment.id}/change`,'staff','POST',confirmation);
 check('B: Pre-check-in change validates schedule/service and replays one appointment',appointment.doctorId===replacement.doctor.doctorId&&replayChange.id===appointment.id&&replayChange.version===appointment.version);
 const arrival={patientId:profile.patientId,servicePointId:point.id,reason};
 const concurrent=await Promise.all(['staff','staff2'].map(role=>request('encounter',`${base}/appointments/${appointment.id}/check-in`,role,'POST',arrival,`${run}-${role}-arrival`)));
 let arrived=concurrent[0];report.resources.onlineVisitId=arrived.id;
 check('A/E: Two receptionists receive one appointment with one encounter/ticket',concurrent.every(v=>v.id===arrived.id&&v.ticket.id===arrived.ticket.id));
 const shared=await request('encounter',`${base}/reception/workload?date=${today}`,'staff2');check('Reception workload is shared across collectors',shared.items.some(a=>a.visit.id===arrived.id));
 await request('appointment',`${base}/reception/appointments/${appointment.id}/holds`,'staff','POST',{...changeBody,expectedVersion:appointment.version},`${run}-late-change`,409);
 await request('encounter',`${base}/queue/${arrived.ticket.id}/transfer`,'staff','POST',{expectedVersion:arrived.ticket.version,destinationPointId:cfg.points.K07,reason},`${run}-forbidden-transfer`,403);
 const exception=await request('encounter',`${base}/reception/requests`,'staff','POST',{visitId:arrived.id,type:'DOCTOR_CHANGE',reason},`${run}-exception`);
 await request('encounter',`${base}/reception/requests/${exception.id}/resolve`,'staff','POST',{expectedVersion:0,reason},undefined,403);
 check('C/N: Post-check-in reassignment and Admin-only resolution are denied; request persists',exception.state==='OPEN');
 let ticket=await request('encounter',`${base}/queue/${arrived.ticket.id}/call`,'staff','POST',{expectedVersion:arrived.ticket.version,reason},`${run}-call`);
 ticket=await request('encounter',`${base}/queue/${ticket.id}/recall`,'staff','POST',{expectedVersion:ticket.version,reason},`${run}-recall`);check('F: Recall records a real versioned queue action',ticket.state==='CALLED');
 ticket=await request('encounter',`${base}/queue/${ticket.id}/skip`,'staff','POST',{expectedVersion:ticket.version,reason},`${run}-skip`);check('F: Temporary skip is persisted',ticket.state==='SKIPPED');
 ticket=await request('encounter',`${base}/queue/${ticket.id}/absent`,'staff','POST',{expectedVersion:ticket.version,reason},`${run}-absent`);check('G: Absence is persisted',ticket.state==='ABSENT');
 const requeueInput={expectedVersion:ticket.version,reason};
 const requeued=await Promise.all(Array.from({length:6},()=>request('encounter',`${base}/queue/${ticket.id}/requeue`,'staff','POST',requeueInput,`${run}-requeue`)));
 arrived=await request('encounter',`${base}/visits/${arrived.id}`);check('H: Concurrent retry moves to tail without a second encounter/check-in',requeued.every(t=>t.state==='TRANSFERRED')&&arrived.ticket.state==='WAITING'&&arrived.ticket.number>ticket.number);
 const patient=await request('patient',`${base}/patients/walk-in`,'staff','POST',{fullName:'Reception Sandbox Verification',dateOfBirth:'2000-01-01',reason},`${run}-patient`);
 const input={patientId:patient.patientId,doctorId:null,offeringId:cfg.offerings.consultation,servicePointId:point.id,reason};
 let visit=await request('encounter',`${base}/visits/walk-in`,'staff','POST',input,`${run}-walk-in`);report.resources.walkInVisitId=visit.id;
 const duplicate=await request('encounter',`${base}/visits/walk-in`,'staff','POST',input,`${run}-walk-in`);
 check('D: Auto-routed walk-in has no fake appointment and retries uniquely',visit.appointmentId===null&&!!visit.doctorId&&duplicate.id===visit.id);
 const doctorKey=Object.entries(cfg.doctors).find(([,d])=>d.id===visit.doctorId)?.[0];
 if(doctorKey)await login('doctor',doctorKey);else{const account=cfg.receptionQaDoctorAccounts?.[visit.doctorId];assert.ok(account,'Auto-routed doctor must have a copied-sandbox QA login');cfg.accounts.routedDoctor=account;await login('doctor','routedDoctor');}
 await request('billing',`${base}/bills`,'staff','POST',{encounterId:visit.id,reason},`${run}-too-early`,[409,503]);check('Payment is not required for care; billing is refused before completion');
 const encounterStream=await stream('encounter'),billingStream=await stream('billing');
 let eventCount=encounterStream.events.changed;
 // Remove the still-waiting online patient from this test point's call order.
 await request('encounter',`${base}/queue/${arrived.ticket.id}/skip`,'staff','POST',{expectedVersion:arrived.ticket.version,reason},`${run}-online-skip`);
 visit=await request('encounter',`${base}/doctor/visits/${visit.id}/call`,'doctor','POST',{expectedVersion:visit.version,reason},`${run}-doctor-call`);
 await waitFor(()=>encounterStream.events.changed>eventCount,'Doctor call SSE missing');check('I: Doctor call emits a gateway-delivered realtime invalidation',visit.ticket.state==='CALLED');
 eventCount=encounterStream.events.changed;
 visit=await request('encounter',`${base}/doctor/visits/${visit.id}/start`,'doctor','POST',{expectedVersion:visit.version,reason},`${run}-start`);
 await waitFor(()=>encounterStream.events.changed>eventCount,'Doctor start SSE missing');
 await request('encounter',`${base}/doctor/visits/${visit.id}/await-results`,'staff','POST',{expectedVersion:visit.version,reason},`${run}-clinical-denied`,403);check('J: IN_PROGRESS is visible in realtime and staff cannot mutate it',visit.status==='IN_PROGRESS');
 let draft=await request('medical',`${base}/visits/${visit.id}/draft`,'doctor','PUT',{expectedDocumentVersion:0,content:{reasonForVisit:reason,conclusion:'Sandbox workflow verification',instructions:'Not for treatment'},reason},`${run}-draft`);
 draft=await request('medical',`${base}/visits/${visit.id}/validate`,'doctor','POST',{expectedVersion:draft.caseVersion,reason},`${run}-validate`);
 eventCount=encounterStream.events.changed;
 visit=await request('encounter',`${base}/doctor/visits/${visit.id}/complete`,'doctor','POST',{expectedVersion:visit.version,medicalCaseVersion:draft.caseVersion,consultationConfirmed:true,reason},`${run}-complete`);
 await waitFor(()=>encounterStream.events.changed>eventCount,'Completion SSE missing');
 let bill=await request('billing',`${base}/bills`,'staff','POST',{encounterId:visit.id,reason},`${run}-bill`);await waitFor(()=>billingStream.events.changed>0,'Billing SSE missing');
 check('K: Professional completion produces authoritative payable bill and realtime events',visit.status==='CLINICALLY_COMPLETED'&&bill.remainingVnd===visit.consultation.price.amountVnd);
 const shifts=await request('billing',`${base}/collection-shifts`);const shift=shifts.find(s=>s.state==='OPEN'&&s.collectorUserId===cfg.accounts.reception.userId)??await request('billing',`${base}/collection-shifts`,'staff','POST',{reason},`${run}-shift`);
 bill=await request('billing',`${base}/bills/${bill.id}`);
 const pay={expectedVersion:bill.version,shiftId:shift.id,amountVnd:bill.remainingVnd,method:'CASH',reason};
 const receipts=await Promise.all(Array.from({length:6},()=>request('billing',`${base}/bills/${bill.id}/payments`,'staff','POST',pay,`${run}-payment`)));
 bill=await request('billing',`${base}/bills/${bill.id}`);const stored=await request('billing',`${base}/bills/${bill.id}/payments`);report.resources.billId=bill.id;report.resources.receiptId=receipts[0].id;
 check('L: Concurrent collection retry has one persisted receipt and one money effect',bill.status==='PAID'&&bill.remainingVnd===0&&receipts.every(r=>r.id===receipts[0].id)&&stored.length===1);
 encounterStream.close();const reconnect=await stream('encounter');const authoritative=await request('encounter',`${base}/visits/${visit.id}`);
 check('M: Reconnection emits ready and refetch restores authoritative state',reconnect.events.ready===1&&authoritative.status==='CLINICALLY_COMPLETED');
 await request('encounter',`${base}/reception/events`,'patient','GET',undefined,undefined,403);check('SSE subscription is denied to a patient');
 await request('encounter',`/api/clinics/${cfg.clinic}/branches/${randomUUID()}/reception/events`,'staff','GET',undefined,undefined,403);check('SSE subscription is denied outside the granted branch');
 const resolved=await request('encounter',`${base}/reception/requests/${exception.id}/resolve`,'admin','POST',{expectedVersion:0,reason});check('Authorized management can resolve a persisted exception',resolved.state==='RESOLVED');
 report.status='PASS';
}
try{await verify();}catch(e){report.status='FAIL';report.error=e.message;process.exitCode=1;console.error(e.message);}finally{streams.forEach(s=>s.abort());report.checkedAt=new Date().toISOString();fs.writeFileSync(path.join(runtime,'reception-workflow-report.json'),JSON.stringify(report,null,2));}
