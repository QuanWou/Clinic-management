import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';

// Opt-in: adds one isolated QA patient/visit/receipt via the running main APIs.
// Saved commands and idempotency keys let a failed run continue without reset.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtime = path.join(root, '.runtime/main');
const cfg = JSON.parse(fs.readFileSync(path.join(runtime, 'config.json'), 'utf8').replace(/^\uFEFF/, ''));
assert.ok(process.argv.includes('--workflow'), 'Use --workflow to add an isolated QA workflow');
assert.equal(cfg.roleModel, 'ACADEMIC_4');
const withoutOrders=process.argv.includes('--without-orders');
const runName=process.argv.find(x=>x.startsWith('--run-name='))?.slice(11);
if(runName)assert.match(runName,/^[a-z][a-z0-9-]{0,40}$/);
const output = path.join(runtime, runName?`${runName}/${withoutOrders?'without-orders':'with-orders'}`:process.argv.includes('--priority-fixes')?`priority-fixes/${withoutOrders?'without-orders':'with-orders'}`:'role-reduction');
fs.mkdirSync(output, {recursive: true});
const stateFile = path.join(output, 'workflow-state.json');
const state = fs.existsSync(stateFile)
  ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
  : {run: randomUUID(), commands: {}};
const report = {status: 'RUNNING', checkedAt: new Date().toISOString(), checks: [], clinicalRelease: 'DISABLED', onlinePayment: cfg.payments?.CLINIC_PAYMENTS_ENABLED==='true'?'INVOICE_CONFIGURED':'DISABLED'};
const tokens = {};
const base = `/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
const reason = 'QA: Kiểm chứng bốn vai trò cho bài tập, không dùng điều trị';
const check = (name, value = true) => { assert.ok(value, name); report.checks.push(name); };

async function request(service, route, role, method = 'GET', body, key, expected) {
  const response = await fetch(`http://127.0.0.1:${cfg.ports[service]}${route}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: {
      ...(tokens[role] ? {Authorization: `Bearer ${tokens[role]}`} : {}),
      ...(body ? {'Content-Type': 'application/json'} : {}),
      ...(key ? {'Idempotency-Key': key} : {}),
    },
    ...(body ? {body: JSON.stringify(body)} : {}),
  });
  const value = await response.json();
  if (expected) assert.equal(response.status, expected, `${role}: ${method} ${route}`);
  else assert.ok(response.ok, `${role}: ${method} ${route}: ${response.status} ${value.code ?? value.message ?? ''}`);
  return value;
}

async function command(name, service, route, role, body, method = 'POST') {
  if (Object.hasOwn(state.commands, name)) return state.commands[name];
  const result = await request(service, route, role, method, body, `four-roles-${state.run}-${name}`);
  state.commands[name] = result;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  return result;
}

async function verify() {
  for (const [role, accountKey] of Object.entries({...cfg.primaryAccounts, otherDoctor: 'doctor2'})) {
    const account = cfg.accounts[accountKey];
    const auth = await request('auth', '/api/auth/login', role, 'POST', {email: account.email, password: account.password});
    tokens[role] = auth.data.accessToken;
    const contexts = await request('identity', '/api/me/contexts', role);
    if (role === 'patient') assert.equal(contexts.length, 0);
    else assert.equal(contexts.find(c => c.clinicId === cfg.clinic)?.role, role === 'otherDoctor' ? 'DOCTOR' : role.toUpperCase());
  }
  check('Four canonical roles; PATIENT has no clinic staff membership');

  for (const role of ['admin', 'staff', 'patient']) {
    await request('medical', `${base}/lab/orders`, role, 'GET', undefined, undefined, 403);
    await request('encounter', `${base}/doctor/worklist`, role, 'GET', undefined, undefined, 403);
  }
  for (const role of ['doctor', 'patient']) {
    await request('billing', `${base}/bills`, role, 'GET', undefined, undefined, 403);
    await request('identity', `/api/clinics/${cfg.clinic}/memberships`, role, 'GET', undefined, undefined, 403);
  }
  await request('identity', `/api/clinics/${cfg.clinic}/memberships`, 'staff', 'GET', undefined, undefined, 403);
  check('ADMIN/STAFF/PATIENT cannot enter clinical work; DOCTOR/PATIENT cannot collect or manage memberships');

  const accountProfile=process.argv.includes('--use-patient-account')?await request('patient','/api/me/patient-profile','patient'):null;
  const patient = accountProfile?{patientId:accountProfile.patientId}:await command('patient', 'patient', `${base}/patients/walk-in`, 'staff', {
    fullName: 'QA Kiểm chứng bốn vai trò', dateOfBirth: '2000-01-01', reason,
  });
  const visitInput = {offeringId:cfg.offerings.consultation,patientId: patient.patientId, doctorId: cfg.doctors.doctor.id, servicePointId: cfg.points.K07, reason};
  let visit = await command('visit', 'encounter', `${base}/visits/walk-in`, 'staff', visitInput);
  const replay = await request('encounter', `${base}/visits/walk-in`, 'staff', 'POST', visitInput, `four-roles-${state.run}-visit`);
  assert.equal(replay.id, visit.id);
  await command('call', 'encounter', `${base}/queue/${visit.ticket.id}/call`, 'staff', {expectedVersion: visit.ticket.version, reason});
  visit = await request('encounter', `${base}/visits/${visit.id}`, 'staff');
  visit = await command('start', 'encounter', `${base}/doctor/visits/${visit.id}/start`, 'doctor', {expectedVersion: visit.version, reason});
  check('STAFF creates patient and receives visit; assigned DOCTOR starts; walk-in replay is unique');

  for (const role of ['admin', 'staff', 'patient', 'otherDoctor']) {
    await request('medical', `${base}/visits/${visit.id}/draft`, role, 'GET', undefined, undefined, 403);
  }
  check('Draft is denied to ADMIN/STAFF/PATIENT and another DOCTOR');
  let draft = await command('draft', 'medical', `${base}/visits/${visit.id}/draft`, 'doctor', {
    expectedDocumentVersion: 0,
    content: {reasonForVisit: reason, conclusion: 'Hồ sơ kiểm thử nội bộ chưa ký', instructions: 'Dữ liệu QA; không dùng điều trị'}, reason,
  }, 'PUT');
  if(!withoutOrders){
  let order = await command('order', 'medical', `${base}/visits/${visit.id}/orders`, 'doctor', {expectedCaseVersion: draft.caseVersion, offeringId: cfg.offerings.laboratory, reason});
  const queue = await request('medical', `${base}/lab/orders`, 'doctor');
  // Reviewed orders disappear from the processing worklist on a repeated run.
  check('Assigned DOCTOR sees their pending result order', !!state.commands.review || queue.some(o => o.id === order.id));
  if(process.argv.includes('--pause-after-order')){
    report.resources={patientId:patient.patientId,visitId:visit.id,orderId:order.id};
    report.status='PASS';console.log('PASS: QA order is ready for browser identity verification');return;
  }
  await request('medical', `${base}/orders/${order.id}/accept`, 'otherDoctor', 'POST', {expectedVersion: order.version, reason}, randomUUID(), 403);
  check('Another DOCTOR cannot take the result order');
  order = await command('accept', 'medical', `${base}/orders/${order.id}/accept`, 'doctor', {expectedVersion: order.version, reason});
  order = await command('process', 'medical', `${base}/orders/${order.id}/process`, 'doctor', {expectedVersion: order.version, reason});
  order = await command('result', 'medical', `${base}/orders/${order.id}/results`, 'doctor', {expectedVersion: order.version, sourceRef: `QA-${state.run}`, content: reason, reason});
  assert.equal(order.result.authorUserId, cfg.accounts.doctor.userId);
  draft = await request('medical', `${base}/visits/${visit.id}/draft`, 'doctor');
  if (!state.commands.review) {
    await request('medical', `${base}/visits/${visit.id}/validate`, 'doctor', 'POST', {expectedVersion: draft.caseVersion, reason}, randomUUID(), 409);
    check('Unreviewed result blocks clinical validation');
  }
  order = await command('review', 'medical', `${base}/orders/${order.id}/reviews`, 'doctor', {expectedVersion: order.version, resultVersion: order.resultVersion, reason});
  assert.equal(order.reviewedBy, cfg.accounts.doctor.userId);
  assert.equal(order.state, 'REVIEWED');
  check('Same assigned DOCTOR authors result and explicitly reviews the current version');
  }
  draft = await request('medical', `${base}/visits/${visit.id}/draft`, 'doctor');
  draft = await command('validate', 'medical', `${base}/visits/${visit.id}/validate`, 'doctor', {expectedVersion: draft.caseVersion, reason});
  visit = await command('complete', 'encounter', `${base}/doctor/visits/${visit.id}/complete`, 'doctor', {expectedVersion: visit.version, medicalCaseVersion: draft.caseVersion, consultationConfirmed:true, reason});
  assert.equal(visit.status, 'CLINICALLY_COMPLETED');
  check('Unsigned internal case completes with performed consultation');
  assert.equal(visit.consultation.offeringId,cfg.offerings.consultation);assert.equal(visit.consultation.price.amountVnd,180000);assert.ok(visit.consultationPerformedAt);
  const identities=await request('encounter',`${base}/doctor/visit-identities`,'otherDoctor','POST',[visit.id]);assert.equal(identities.length,0);check('Another doctor cannot obtain patient identity for this visit');

  let bill = await command('bill', 'billing', `${base}/bills`, 'staff', {encounterId: visit.id, reason});
  check('STAFF issues bill using performed service price snapshot', bill.lines.some(l => l.sourceType === 'WALK_IN' && l.amountVnd === 180000) && bill.subtotalVnd === (withoutOrders?180000:270000));
  if(!process.argv.includes('--pause-before-payment')){
  bill=await request('billing',`${base}/bills/${bill.id}`,'staff');
  let shift = await command('shift', 'billing', `${base}/collection-shifts`, 'staff', {reason});
  const receipt = await command('payment', 'billing', `${base}/bills/${bill.id}/payments`, 'staff', {expectedVersion: bill.version, shiftId: shift.id, amountVnd: bill.remainingVnd, method: 'CASH', reason});
  bill = await request('billing', `${base}/bills/${bill.id}`, 'staff');
  assert.equal(bill.status, 'PAID');
  assert.equal(bill.remainingVnd, 0);
  assert.equal(receipt.collectorUserId, cfg.accounts.reception.userId);
  check('The same STAFF receives and collects onsite payment');
  shift = await command('submit', 'billing', `${base}/collection-shifts/${shift.id}/submit`, 'staff', {expectedVersion: shift.version, declaredCashVnd: bill.subtotalVnd, declaredBankVnd: 0, declaredPosVnd: 0, reason});
  await request('billing', `${base}/collection-shifts/${shift.id}/approve`, 'staff', 'POST', {expectedVersion: shift.version, reason}, randomUUID(), 403);
  check('STAFF cannot approve their own collection shift');
  shift = await command('approve', 'billing', `${base}/collection-shifts/${shift.id}/approve`, 'admin', {expectedVersion: shift.version, reason});
  assert.equal(shift.approvedBy, cfg.accounts.owner.userId);
  assert.equal(shift.varianceVnd, 0);
  check('A different ADMIN approves a balanced shift');
  visit = await command('close', 'encounter', `${base}/doctor/visits/${visit.id}/close`, 'doctor', {expectedVersion: visit.version, reason});
  assert.equal(visit.status, 'CLOSED');
  check('DOCTOR closes the paid visit; QA room is released');
  report.resources = {patientId: patient.patientId, visitId: visit.id, billId: bill.id, shiftId: shift.id};
  }else{report.resources={patientId:patient.patientId,visitId:visit.id,billId:bill.id};check('Unpaid QA consultation bill is ready for browser collection');}
  report.status = 'PASS';
  console.log(`PASS: ${report.checks.length} four-role workflow and backend authorization checks`);
}
try { await verify(); } catch (error) {
  report.status = 'FAIL'; report.error = error.message; process.exitCode = 1;
  console.error(error.message);
} finally {
  fs.writeFileSync(path.join(output, 'workflow-verification.json'), JSON.stringify(report, null, 2));
}
