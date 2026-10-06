// Verify built assets and deep links with API fixtures; no database writes.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {gzipSync} from 'node:zlib';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'frontend'),dist=path.join(web,'dist');
const output=path.join(root,'.runtime/main/ui-optimization');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'.vite/manifest.json'),'utf8'));
const require=createRequire(path.join(web,'package.json'));
const {chromium,expect}=require('@playwright/test');
const port=4187,base=`http://127.0.0.1:${port}`;
const entry=Object.values(manifest).find(chunk=>chunk.isEntry);
if(!entry)throw Error('Build the website before verifying delivery.');
await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(resolve));});
fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,[path.join(web,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:web,windowsHide:true,stdio:'ignore'});
const bill={id:'bill',encounterId:'visit',patientId:'patient',currency:'VND',subtotalVnd:250000,adjustmentVnd:0,paidVnd:100000,remainingVnd:150000,status:'PARTIALLY_PAID',version:1,lines:[{chargeId:'charge',sourceType:'ENCOUNTER',sourceId:'visit',name:'Khám Nội tổng quát',amountVnd:250000}]};
async function fixture(route){
 const url=new URL(route.request().url()),p=url.pathname;let json;
 const boundClinic=decodeURIComponent(p.split('/public/clinics/by-id/')[1]??'clinic');
 const projectedClinic=decodeURIComponent(p.split('/clinics/')[1]?.split('/')[0]??'clinic');
 if(route.request().method()!=='GET'&&!p.endsWith('/auth/login'))throw Error(`Unexpected fixture write: ${p}`);
 if(p.endsWith('/auth/login'))json={data:{accessToken:'fixture-ui-session'}};
 else if(p.endsWith('/me/current'))json={userId:'cashier',platformOperator:false};
 else if(p.endsWith('/me/contexts'))json=[{membershipId:'membership',clinicId:'clinic',role:'STAFF',allBranches:true,branchIds:[],version:1}];
 else if(p.includes('/public/clinics/by-id/'))json={id:boundClinic,name:'Phòng khám An Nhiên',publicDescription:'Chăm sóc sức khỏe ngoại trú.',branches:[{id:'branch',name:'Phòng khám An Nhiên',address:'Địa chỉ kiểm thử giao diện',openingHours:'07:30–17:30',active:true}]};
 else if(p.endsWith('/public/clinics'))json={content:[{id:'clinic',name:'Phòng khám An Nhiên',branches:[{id:'branch',name:'Phòng khám An Nhiên',address:'Địa chỉ kiểm thử giao diện',openingHours:'07:30–17:30',active:true}]}],totalElements:1};
 else if(p.endsWith('/doctors'))json=[{doctorId:'doctor',clinicId:projectedClinic,branchId:'branch',displayName:'BS. Nguyễn Minh An',specialtyName:'Nội tổng quát'}];
 else if(p.endsWith('/offerings'))json=[{offeringId:'consultation',clinicId:projectedClinic,branchId:'branch',name:'Khám Nội tổng quát',amountVnd:250000,priceVersionId:'price'}];
 else if(p.endsWith('/billing-directory'))json={id:'clinic',name:'Phòng khám An Nhiên',branches:[{id:'branch',name:'Phòng khám An Nhiên',active:true}]};
 else if(p.endsWith('/billable-visits'))json=[{id:'visit',patientId:'patient',appointmentId:null,status:'CLINICALLY_COMPLETED',medicalCaseVersion:1,visitCode:'AN-20261002-0015'}];
 else if(p.endsWith('/bills'))json=[bill];
 else if(p.endsWith('/collection-shifts'))json=[{id:'shift',collectorUserId:'cashier',state:'OPEN',version:0}];
 else if(p.endsWith('/payments'))json=[];
 else throw Error(`Unexpected fixture read: ${p}`);
 await route.fulfill({json});
}
const report={checkedAt:new Date().toISOString(),status:'RUNNING',mode:'production-build-with-api-fixtures',entry:{bytes:fs.statSync(path.join(dist,entry.file)).size,gzipBytes:gzipSync(fs.readFileSync(path.join(dist,entry.file))).length},surfaces:[]};
let browser;
try{
 let ready=false;
 for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Preview exited before startup.');try{ready=(await fetch(base,{signal:AbortSignal.timeout(1000)})).ok;}catch{}if(ready)break;await new Promise(resolve=>setTimeout(resolve,200));}
 if(!ready)throw Error('Preview did not start.');
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true});
 for(const surface of ['public','workspace']){
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage(),scripts=new Set(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.js'))scripts.add(new URL(r.url()).pathname.slice(1));});
  await page.route('**/s1/**',fixture);
  await page.goto(`${base}/${surface}${surface==='workspace'?'?view=billing&clinicId=clinic':''}`);
  if(surface==='public'){
   await expect(page.getByRole('heading',{name:'Phòng khám An Nhiên',exact:true,level:2})).toBeVisible();
   for(const width of [1366,1024,375]){await page.setViewportSize({width,height:768});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);}
   await page.setViewportSize({width:1366,height:768});
   await page.getByRole('link',{name:'Đặt lịch khám',exact:false}).first().click();
   await expect(page.getByRole('heading',{name:'Chọn lịch khám'})).toBeVisible();
   for(const width of [1366,1024]){
    await page.setViewportSize({width,height:768});
    const booking=await page.locator('#booking').boundingBox(),profile=await page.locator('#profile').boundingBox();
    expect(booking.x+booking.width).toBeLessThanOrEqual(profile.x);
    expect(Math.abs(booking.y-profile.y)).toBeLessThan(2);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   }
   await page.setViewportSize({width:1366,height:768});
  }else{
   await page.getByLabel('Email',{exact:true}).fill('cashier@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('fixture-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
   await page.getByRole('combobox',{name:'Phiếu thu',exact:true}).selectOption('bill');
   await page.getByRole('combobox',{name:'Ca thu',exact:true}).selectOption('shift');
   for(const width of [1366,1024]){
    await page.setViewportSize({width,height:768});
    const selection=await page.locator('.cashier-selection').boundingBox(),payment=await page.locator('.cashier-payment').boundingBox();
    expect(selection.x+selection.width).toBeLessThanOrEqual(payment.x);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
   }
   await page.setViewportSize({width:1366,height:768});
   await page.getByLabel('Số tiền VND',{exact:true}).focus();await page.keyboard.press('Tab');
   await expect(page.getByRole('combobox',{name:'Hình thức nhận tiền',exact:true})).toBeFocused();
  }
  expect(errors).toEqual([]);
  const files=[...scripts];
  const forbidden=surface==='public'?['WorkspaceShell','PlatformShell','CashierPanel','DoctorPanel','MedicalPanel','PatientHistoryPanel']:['PublicShell','PlatformShell','DoctorPanel','MedicalPanel','ReceptionPanel','LabPanel'];
  expect(files.filter(file=>forbidden.some(name=>file.includes(name)))).toEqual([]);
  const bytes=files.reduce((sum,file)=>sum+fs.statSync(path.join(dist,file)).size,0);
  report.surfaces.push({surface,files,bytes,unrelatedScreensLoaded:false,laptopWidths:[1366,1024],status:'PASS'});
  await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
  await page.screenshot({path:path.join(output,`${surface}-production-1366.png`),fullPage:true});
  await context.close();
 }
 report.status='PASS';console.log(JSON.stringify(report,null,2));
}catch(error){report.status='FAIL';report.error=error.message;process.exitCode=1;console.error(error.message);}
finally{await browser?.close();server.kill();fs.writeFileSync(path.join(output,'delivery.json'),JSON.stringify(report,null,2));}
