// Opt-in live QA: creates one patient booking and records a 1,000 VND partial
// payment on the isolated consultation bill prepared by the four-role verifier.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
assert.ok(process.argv.includes('--live-qa'),'Use --live-qa to authorize the QA records');
const runtime=path.join(root,'.runtime/main'),out=path.join(runtime,'priority-fixes');
const cfg=JSON.parse(fs.readFileSync(path.join(runtime,'config.json'),'utf8').replace(/^\uFEFF/,''));
const require=createRequire(path.join(root,'frontend/package.json'));
const {chromium,expect}=require('@playwright/test');
fs.mkdirSync(out,{recursive:true});
const rolesOnly=process.argv.includes('--roles-only');
const previous=process.argv.includes('--billing-only')||rolesOnly?JSON.parse(fs.readFileSync(path.join(out,'browser-regressions.json'),'utf8')):null;
const report={status:'RUNNING',checks:previous?.checks??[],screens:previous?.screens??[],checkedAt:new Date().toISOString()};
const browser=await chromium.launch({channel:'msedge',headless:true});
const base=`/api/clinics/${cfg.clinic}/branches/${cfg.branch}`;
let token,patient,appointment;
async function api(service,route,auth,method='GET',body,key,status){
 const response=await fetch(`http://127.0.0.1:${cfg.ports[service]}${route}`,{method,signal:AbortSignal.timeout(20000),headers:{...(auth?{Authorization:`Bearer ${auth}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();assert.equal(response.status,status??(method==='GET'?200:response.status),`${service} ${route}`);if(!status)assert.ok(response.ok,`${service}: ${result.message??result.code}`);return result;
}
async function login(page,account,url){
 await page.goto(`http://127.0.0.1:4176${url}`);
 await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(account.password);
 await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible();
}
async function layout(page,name){
 for(const width of [1366,1024]){await page.setViewportSize({width,height:768});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}: overflow ${width}`);await page.screenshot({path:path.join(out,`${name}-${width}.png`),fullPage:true});report.screens.push(`${name}-${width}`);}
}
try{
 if(!previous){
 const account={email:`qa.priority.${randomUUID()}@annhien.local`,password:`Qa!${randomUUID()}`,fullName:'QA Kiểm tra khôi phục đổi lịch'};
 token=(await api('auth','/api/auth/register',null,'POST',account)).data.accessToken;
 patient=await api('patient','/api/me/patient-profile',token,'PUT',{fullName:account.fullName,dateOfBirth:'2001-02-03',sex:'OTHER',phone:'0900000001',email:account.email,expectedVersion:0});
 const date=offset=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offset*86400000));
 const query=d=>new URLSearchParams({clinicId:cfg.clinic,branchId:cfg.branch,offeringId:cfg.offerings.consultation,doctorId:cfg.doctors.doctor.id,date:d});
 const slots=await api('appointment',`/api/public/availability?${query(date(2))}`);
 assert.ok(slots.length);const input=s=>({clinicId:cfg.clinic,branchId:cfg.branch,offeringId:cfg.offerings.consultation,doctorId:cfg.doctors.doctor.id,patientId:patient.patientId,slotId:s.slotId});
 const hold=await api('appointment','/api/appointments/holds',token,'POST',input(slots[0]),randomUUID());
 appointment=await api('appointment','/api/appointments',token,'POST',{clinicId:cfg.clinic,patientId:patient.patientId,holdId:hold.holdId},randomUUID());
 const newSlots=await api('appointment',`/api/public/availability?${query(date(3))}`);
 const moving=await api('appointment',`/api/appointments/${appointment.id}/reschedule-holds`,token,'POST',input(newSlots[0]),randomUUID());
 assert.equal(moving.purpose,'RESCHEDULE');assert.equal(moving.rescheduleAppointmentId,appointment.id);
 await api('appointment','/api/appointments',token,'POST',{clinicId:cfg.clinic,patientId:patient.patientId,holdId:moving.holdId},randomUUID(),409);
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
 await login(page,account,'/login?area=public&next=booking');await expect(page.getByRole('button',{name:'Lưu hồ sơ',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Đăng nhập để đặt lịch',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill(account.email);await page.getByLabel('Mật khẩu',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 async function recover(p){await expect(p.getByRole('button',{name:'Tải giờ đang giữ'})).toBeEnabled();await p.getByRole('button',{name:'Tải giờ đang giữ'}).click();await p.getByRole('button',{name:/Tiếp tục đổi lịch/}).click();await expect(p.getByLabel('Ngày khám')).toHaveValue(date(3));await expect(p.getByRole('button',{name:'Xác nhận đổi lịch',exact:true})).toBeVisible();}
 await recover(page);await layout(page,'reschedule-recovered');
 const second=await context.newPage();await login(second,account,'/login?area=public&next=booking');await recover(second);
 await second.getByRole('button',{name:'Xác nhận đổi lịch',exact:true}).click();await expect(second.getByText(/Đã đổi lịch:/)).toBeVisible();
 await page.getByRole('button',{name:'Xác nhận đổi lịch',exact:true}).click();await expect(page.getByText(/Đã đổi lịch:/)).toBeVisible();
 const mine=await api('appointment',`/api/me/appointments?${new URLSearchParams({clinicId:cfg.clinic,patientId:patient.patientId})}`,token);
 assert.equal(mine.length,1);assert.equal(mine[0].id,appointment.id);assert.equal(mine[0].slotId,moving.slotId);report.checks.push('Reload and another tab recover the bound reschedule; both confirmations keep exactly one appointment');await context.close();
 }

 if(!rolesOnly){
 const state=JSON.parse(fs.readFileSync(path.join(out,'without-orders/workflow-state.json'),'utf8'));
 const staff=cfg.accounts.reception,auth=(await api('auth','/api/auth/login',null,'POST',{email:staff.email,password:staff.password})).data.accessToken;
 const bill=await api('billing',`${base}/bills/${state.commands.bill.id}`,auth);assert.equal(bill.lines.length,1);assert.equal(bill.lines[0].sourceType,'WALK_IN');assert.equal(bill.subtotalVnd,180000);
 const shift=await api('billing',`${base}/collection-shifts`,auth,'POST',{reason:'QA Kiểm tra ô nhập tiền VND'},`priority-browser-${state.run}`);
 state.commands.shift=shift;fs.writeFileSync(path.join(out,'without-orders/workflow-state.json'),JSON.stringify(state,null,2));
 const cashierContext=await browser.newContext({viewport:{width:1366,height:768}}),cashier=await cashierContext.newPage();
 await login(cashier,staff,'/workspace?view=billing');await expect(cashier.getByLabel('Địa điểm thu phí')).toHaveValue(cfg.branch);await cashier.getByLabel('Phiếu thu').selectOption(bill.id);await cashier.getByRole('combobox',{name:/^Ca thu/}).selectOption(shift.id);
 await expect(cashier.locator('.cashier-payment .patient-identity')).toContainText('QA Kiểm chứng bốn vai trò');await expect(cashier.locator('.cashier-payment .patient-identity')).toContainText('Ngày sinh');
 await cashier.getByLabel('Lý do lập phiếu hoặc xử lý').fill('QA Kiểm tra phân cách hàng nghìn');await cashier.getByLabel('Số tiền VND',{exact:true}).fill('1.000');await expect(cashier.getByText(/Số tiền: 1.000/)).toBeVisible();await layout(cashier,'cashier-vnd');
 await cashier.setViewportSize({width:1366,height:768});
 const paymentButton=cashier.getByRole('button',{name:'Ghi nhận tiền đã nhận',exact:true});
 const rect=await paymentButton.boundingBox();assert.ok(rect&&rect.y+rect.height<=768,'Cash receipt action must fit the 1366 × 768 laptop viewport');
 if(bill.paidVnd===0){
  const sent=cashier.waitForRequest(r=>r.method()==='POST'&&r.url().endsWith(`/bills/${bill.id}/payments`));await paymentButton.click();assert.equal((await sent).postDataJSON().amountVnd,1000);await expect(cashier.getByRole('article',{name:'Biên nhận nội bộ'})).toBeVisible();
 }else assert.equal(bill.paidVnd,1000,'Resume only the existing 1,000 VND QA payment');
 const paid=await api('billing',`${base}/bills/${bill.id}`,auth);assert.equal(paid.paidVnd,1000);assert.equal(paid.remainingVnd,179000);report.checks.push('Real browser sends 1,000 VND for 1.000, and the source bill balance changes by exactly 1,000');await cashierContext.close();
 }
 for(const [role,url,heading] of [['reception','/workspace?view=reception','Tiếp nhận & hàng đợi'],['doctor','/workspace?view=doctor','Danh sách khám của bác sĩ'],['doctor','/workspace?view=lab','Kết quả xét nghiệm']]){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),p=await context.newPage();await login(p,cfg.accounts[role],url);await expect(p.getByRole('heading',{name:heading,exact:true})).toBeVisible();
  if(url.endsWith('reception')){await expect(p.getByLabel('Dịch vụ khám cho khách đến trực tiếp')).toBeEnabled();await p.getByLabel('Dịch vụ khám cho khách đến trực tiếp').selectOption(cfg.offerings.consultation);await expect(p.getByText(/Giá khám:/)).toBeVisible();}
  await expect(p.locator('.patient-identity').first()).toContainText('Ngày sinh');await layout(p,url.split('=')[1]);await context.close();
 }
 report.checks.push('Reception, assigned doctor, results and cashier show patient identity without laptop overflow');report.checks=[...new Set(report.checks)];report.screens=[...new Set(report.screens)];report.status='PASS';console.log(`PASS: ${report.checks.length} live regressions; ${report.screens.length} laptop screenshots`);
}catch(e){for(const context of browser.contexts())for(const page of context.pages()){await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});fs.writeFileSync(path.join(out,'failure-body.txt'),await page.locator('body').innerText().catch(()=>''));}report.status='FAIL';report.error=e.message;console.error(e.message);process.exitCode=1;}
finally{
 if(appointment&&patient&&token)await api('appointment',`/api/appointments/${appointment.id}/cancel`,token,'POST',{clinicId:cfg.clinic,patientId:patient.patientId,reason:'QA hoàn tất kiểm tra đổi lịch'}).catch(e=>{report.cleanupError=e.message;process.exitCode=1;});
 await browser.close();fs.writeFileSync(path.join(out,'browser-regressions.json'),JSON.stringify(report,null,2));
}
