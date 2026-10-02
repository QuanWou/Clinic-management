import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const demo=path.resolve(root,process.env.CLINIC_RUNTIME_DIRECTORY??'v2/.sandbox/local-demo');
const read=name=>JSON.parse(fs.readFileSync(path.join(demo,name),'utf8').replace(/^\uFEFF/,''));
const config=read('config.json'),state=read('processes.json');
if(state.status!=='RUNNING'||state.workspace.replaceAll('\\','/')!==root.replaceAll('\\','/'))throw Error('The owned local demo must already be running');
let currentScreen='API';
const require=createRequire(new URL('../apps/web-shell/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const report={status:'RUNNING',checkedAt:new Date().toISOString(),backend:[],accounts:[],browser:[],data:process.env.CLINIC_RUNTIME_DIRECTORY?'operating-clinic-local-test':'synthetic-loopback-demo',clinicalRelease:'DISABLED',onlinePayment:'DISABLED'};
const primaryDoctor=config.doctor??config.doctors?.doctor?.id;
async function api(service,url,options={}){
 const response=await fetch(`http://127.0.0.1:${config.ports[service]}${url}`,{...options,signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`${service} ${url} returned ${response.status}`);
 return response.json();
}
const roles={owner:'CLINIC_OWNER',manager:'CLINIC_MANAGER',reception:'RECEPTIONIST',doctor:'DOCTOR',lab:'LAB',cashier:'CASHIER'};
let browser;
try{
 for(const service of Object.keys(config.ports).filter(s=>s!=='web')){const health=await api(service,'/actuator/health');expect(health.status).toBe('UP');report.backend.push({service,status:'UP'});}
 for(const [name,account] of Object.entries(config.accounts)){
  const auth=await api('auth','/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
  const headers={Authorization:`Bearer ${auth.data.accessToken}`};
  const current=await api('identity','/api/v2/me/current',{headers});expect(current.userId).toBe(account.userId);
  const contexts=await api('identity','/api/v2/me/contexts',{headers});
  const role=roles[name]??(/^doctor\d+$/.test(name)?'DOCTOR':undefined);
  if(role){const scope=contexts.filter(c=>c.clinicId===config.clinic&&c.role===role);expect(scope).toHaveLength(1);expect(scope[0].allBranches||scope[0].branchIds.includes(config.branch)).toBe(true);}
  if(name==='platform'){expect(current.platformOperator).toBe(true);expect(contexts).toHaveLength(0);}
  if(/^patient\d*$/.test(name)){expect(contexts).toHaveLength(0);const profile=await api('patient','/api/v2/me/patient-profile',{headers});expect(profile.patientId).toBe(config.patients?.[name]??config.patientId);}
  report.accounts.push({role:name,email:account.email,passwordLogin:'PASS',canonicalScope:'PASS'});
 }
 const siteClinic=await api('clinic',`/api/v2/public/clinics/by-id/${config.clinic}`);expect(siteClinic.id).toBe(config.clinic);
 const doctors=await api('search',`/api/v2/public/clinics/${config.clinic}/doctors?branchId=${config.branch}`);expect(doctors.some(d=>d.doctorId===primaryDoctor)).toBe(true);
 const offerings=await api('search',`/api/v2/public/clinics/${config.clinic}/offerings?branchId=${config.branch}`);expect(offerings.some(c=>c.offeringId===config.offerings.consultation)).toBe(true);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+86400000));
 const availability=await api('appointment','/api/v2/public/availability?'+new URLSearchParams({clinicId:config.clinic,branchId:config.branch,doctorId:primaryDoctor,offeringId:config.offerings.consultation,date}));expect(availability.length).toBeGreaterThan(0);report.singleClinicSource='PASS';report.availableSlots=availability.length;
 browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHROMIUM_CHANNEL??'msedge',headless:true});
 const publicContext=await browser.newContext(),publicPage=await publicContext.newPage();
 const publicErrors=[],publicRequests=[];publicPage.on('pageerror',e=>publicErrors.push(e.message));publicPage.on('request',r=>publicRequests.push(r.url()));
 await publicPage.goto(state.url+'/public');await expect(publicPage.getByRole('heading',{name:siteClinic.name,level:2,exact:true})).toBeVisible({timeout:15000});
 await expect(publicPage.getByRole('heading',{name:offerings[0].name,exact:true})).toBeVisible();await expect(publicPage.getByRole('heading',{name:doctors[0].displayName,exact:true})).toBeVisible();
 await expect(publicPage.getByRole('searchbox')).toHaveCount(0);await expect(publicPage.locator('form')).toHaveCount(0);await expect(publicPage.getByRole('alert')).toHaveCount(0);
 for(const size of [{width:1366,height:768},{width:1024,height:768},{width:375,height:812}]){
  await publicPage.setViewportSize(size);expect(await publicPage.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
  await publicPage.evaluate(()=>window.scrollTo(0,0));await publicPage.screenshot({path:path.join(demo,`public-home-${size.width}.png`),fullPage:true});
  if(size.width===1366)await publicPage.screenshot({path:path.join(demo,'public-home-hero-1366.png')});
 }
 await publicPage.getByRole('button',{name:'Đặt lịch dịch vụ '+offerings[0].name,exact:true}).click();await expect(publicPage.getByRole('combobox',{name:'Dịch vụ',exact:true})).toHaveValue(offerings[0].offeringId);
 await expect(publicPage.getByRole('combobox',{name:'Địa điểm khám',exact:true})).toHaveCount(0);await publicPage.getByRole('link',{name:'Bác sĩ',exact:true}).click();await expect(publicPage.getByRole('heading',{name:doctors[0].displayName,exact:true})).toBeInViewport();
 await publicPage.getByRole('button',{name:'Đặt lịch với '+doctors[0].displayName,exact:true}).click();await expect(publicPage.getByRole('combobox',{name:'Bác sĩ',exact:true})).toHaveValue(doctors[0].doctorId);
 expect(publicRequests.some(url=>url.includes('/public/search'))).toBe(false);expect(publicErrors).toEqual([]);report.publicWebsite={status:'PASS',clinicName:siteClinic.name,singleClinic:true,viewportWidths:[1366,1024,375],serviceAndDoctorPrefill:'PASS',patientFormsOnHome:false};await publicContext.close();
 const screens=[
  {name:'owner',view:'overview',load:true},
  {name:'manager',view:'overview',load:true},
  {name:'reception',view:'reception',branch:'Địa điểm tiếp nhận'},
  {name:'doctor',view:'doctor',branch:'Địa điểm khám'},
  {name:'lab',view:'lab',branch:'Địa điểm lab'},
  {name:'cashier',view:'billing',branch:'Địa điểm thu phí'},
  {name:'patient',route:'/public/account'},
  {name:'platform',route:'/platform'}
 ];
 for(const screen of screens){
  currentScreen=screen.name;
  const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();
  let passwordLogins=0;page.on('request',r=>{if(r.url().endsWith('/api/auth/login'))passwordLogins++;});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/s1/')&&r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
  await page.goto(state.url+(screen.name==='patient'?'/login?area=public':screen.route??'/workspace'));
  await page.screenshot({path:path.join(demo,`${screen.name}-login-1366.png`),fullPage:true});
  await page.getByLabel('Email',{exact:true}).fill(config.accounts[screen.name].email);await page.getByLabel('Mật khẩu',{exact:true}).fill(config.accounts[screen.name].password);
  await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toBeVisible({timeout:15000});
  if(screen.branch){await expect(page.getByLabel(screen.branch)).toHaveValue(config.branch,{timeout:15000});await expect(page.getByLabel(screen.branch)).toBeEnabled({timeout:15000});expect(new URL(page.url()).searchParams.get('view')).toBe(screen.view);await expect(page.getByRole('button',{name:'Tổng quan',exact:true})).toHaveCount(0);}
  if(screen.load){await expect(page.getByRole('heading',{name:'Toàn phạm vi đang chọn',exact:true})).toBeVisible({timeout:15000});}
  if(screen.name==='patient'){await expect(page.getByRole('heading',{name:'Tài khoản bệnh nhân',exact:true})).toBeVisible({timeout:15000});await expect(page.getByRole('button',{name:'Lưu hồ sơ',exact:true})).toBeVisible();await page.getByRole('link',{name:'Đặt lịch khám',exact:true}).click();await expect(page.getByRole('heading',{name:'Đặt lịch khám',exact:true})).toBeVisible();await expect(page.getByRole('combobox',{name:'Địa điểm khám',exact:true})).toHaveCount(0);await expect(page.getByRole('option',{name:doctors[0].displayName,exact:true})).toHaveCount(1);await page.getByRole('link',{name:'Tài khoản bệnh nhân',exact:true}).click();await expect(page.getByRole('button',{name:'Lưu hồ sơ',exact:true})).toBeVisible();}
  if(screen.name==='platform'){await page.getByLabel('Trạng thái kiểm duyệt').selectOption('APPROVED');await page.getByRole('button',{name:'Tải hồ sơ từ nguồn',exact:true}).click();await expect(page.getByRole('heading',{name:siteClinic.name,exact:true})).toBeVisible({timeout:15000});}
  if(config.doctors&&screen.name==='doctor'){
   const completed=page.getByRole('list',{name:'Lượt khám được phân công'}).locator('li').filter({has:page.locator('strong',{hasText:'Đã hoàn tất chuyên môn'})});
   await expect(completed).toHaveCount(1);await completed.getByRole('button').click();await expect(page.getByRole('heading',{name:'Lượt đang chọn',exact:true})).toBeVisible();
  }
  if(config.doctors&&screen.name==='cashier'){
   const id=config.visits['visit-15'].billId;await page.getByLabel('Phiếu thu').selectOption(id);await expect(page.getByRole('heading',{name:'Khoản phải thu',exact:true})).toBeVisible();
   await page.getByLabel(/^Ca thu/).selectOption(config.shift);await expect(page.getByRole('list',{name:'Biên nhận đã ghi nhận'}).getByRole('button')).toHaveCount(1,{timeout:15000});
   await page.getByRole('list',{name:'Biên nhận đã ghi nhận'}).getByRole('button').click();await expect(page.getByRole('article',{name:'Biên nhận nội bộ',exact:true})).toBeVisible();
  }
  await expect(page.getByRole('alert')).toHaveCount(0);expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  await page.evaluate(()=>{(document.activeElement instanceof HTMLElement)&&document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(demo,`${screen.name}-1366.png`),fullPage:true});
  if(!screen.route){const before=await page.locator('input[type=password]').count();expect(before).toBe(0);await page.getByRole('button',{name:'Cài đặt tài khoản',exact:true}).click();await expect(page.getByRole('heading',{name:'Tài khoản của tôi',exact:true})).toBeVisible({timeout:15000});await expect(page.locator('input[type=password]')).toHaveCount(0);await page.goBack();await expect(page.getByLabel(screen.branch??'Địa điểm báo cáo')).toBeVisible({timeout:15000});}
  expect(passwordLogins).toBe(1);expect(errors).toEqual([]);await expect(page.getByRole('alert')).toHaveCount(0);report.browser.push({role:screen.name,status:'PASS',viewport:'1366x768',http:'real-source',passwordLogins,sessionNavigation:screen.route?'NOT_APPLICABLE':'PASS'});await context.close();console.log(`Verified live login/UI: ${screen.name}`);
 }
 report.status='PASS';console.log(`PASS: ${report.backend.length} backend services, ${report.accounts.length} real account scopes, 8 live browser logins, single-clinic Public website and booking availability. Services remain running.`);
}catch(error){report.status='FAIL';report.error=currentScreen+': '+error.message;process.exitCode=1;console.error(error.message);}finally{await browser?.close();fs.writeFileSync(path.join(demo,'verification.json'),JSON.stringify(report,null,2));}
