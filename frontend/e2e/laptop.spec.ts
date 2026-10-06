import { test,expect } from '@playwright/test';
import path from 'node:path';

const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S6/laptop-verification');
const sizes=[{width:1280,height:800},{width:1366,height:768},{width:1440,height:900}];

for(const size of sizes)test(`laptop ${size.width}: keyboard, worklist, draft and exact retry remain usable`,async({page})=>{
 await page.setViewportSize(size);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const ticket={id:'ticket',visitId:'visit',servicePointId:'point',date:'2026-10-02',number:1,code:'R1-20261002-0001',state:'SERVING',version:1};
 const visits=Array.from({length:25},(_,i)=>({id:i===0?'visit':`visit-${i}`,appointmentId:null,status:i===0?'IN_PROGRESS':'WAITING',version:1,ticket:{...ticket,id:`ticket-${i}`,visitId:i===0?'visit':`visit-${i}`,number:i+1,code:`R1-20261002-${String(i+1).padStart(4,'0')}`,state:i===0?'SERVING':'WAITING'}}));
 let draft={encounterId:'visit',documentVersion:1,caseVersion:1,status:'DRAFT',content:{reasonForVisit:'Synthetic review',medicalHistory:'Synthetic history',allergies:'Synthetic allergy check',vitals:'Synthetic vitals',examination:'Synthetic examination',preliminaryDiagnosis:'Synthetic diagnosis',conclusion:'Synthetic conclusion',instructions:'Synthetic instructions',followUpDate:null}};
 const saves:{body:typeof draft;key:string|undefined}[]=[];
 await page.route('**/s1/**',async route=>{
  const req=route.request(),url=req.url();let json:unknown;
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-laptop-token'}};
  else if(url.endsWith('/me/current'))json={userId:'doctor',platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/care-directory'))json={id:'clinic',name:'Phòng khám kiểm thử tổng hợp',branches:[{id:'branch',name:'Điểm khám tổng hợp',active:true},{id:'other',name:'Điểm khám khác',active:true}]};
  else if(url.endsWith('/me/invitations'))json=[];
  else if(url.endsWith('/doctor/service-points'))json=[{id:'point',code:'R1',name:'Phòng khám 1',active:true}];
  else if(url.endsWith('/doctor/worklist'))json=visits;
  else if(url.endsWith('/visits/visit/draft')){
   if(req.method()==='PUT'){
    saves.push({body:req.postDataJSON(),key:req.headers()['idempotency-key']});
    // Lost acknowledgement: the fixture applied the first request once.
    if(saves.length===1){draft={...draft,documentVersion:2,caseVersion:2,content:req.postDataJSON().content};await route.fulfill({status:503,json:{message:'Synthetic acknowledgement lost'}});return;}
   }
   json=draft;
  }
  else if(url.endsWith('/visits/visit/orders')||url.endsWith('/offerings'))json=[];
  else throw new Error('Unexpected laptop fixture request '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=doctor');
 await expect(page.getByLabel('Email',{exact:true})).toBeVisible();
 await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'Bỏ qua điều hướng'})).toBeFocused();
 await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();
 await page.getByLabel('Email',{exact:true}).fill('laptop@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');
 await page.getByLabel('Mật khẩu',{exact:true}).press('Enter');await page.getByLabel('Địa điểm khám').selectOption('branch');
 await page.getByRole('button',{name:'Cài đặt tài khoản',exact:true}).click();await expect(page.getByRole('heading',{name:'Tài khoản của tôi'})).toBeVisible();await page.getByRole('button',{name:'Danh sách khám',exact:true}).click();await page.getByLabel('Địa điểm khám').selectOption('branch');
 await page.getByRole('button',{name:'Chọn lượt R1-20261002-0001',exact:true}).click();await expect(page.getByRole('textbox',{name:'Lý do khám',exact:true})).toHaveValue('Synthetic review');
 const queue=page.locator('.doctor-queue'),detail=page.locator('.doctor-case');
 const q=await queue.boundingBox(),d=await detail.boundingBox();expect(q&&d&&q.x+q.width<=d.x).toBeTruthy();
 await expect(page.getByRole('button',{name:'Danh sách khám',exact:true})).toHaveAttribute('aria-current','page');
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});
 await page.screenshot({path:path.join(evidence,`doctor-${size.width}-top.png`)});
 await page.screenshot({path:path.join(evidence,`doctor-${size.width}-full.png`),fullPage:true});
 const reason=page.getByRole('textbox',{name:'Lý do khám',exact:true});await reason.fill('Synthetic changed note');
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeDisabled();await page.evaluate(()=>history.back());await expect(page).toHaveURL(/view=doctor/);await expect(reason).toHaveValue('Synthetic changed note');
 await expect.poll(()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(true);
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Địa điểm khám')).toBeDisabled();await expect(page.getByRole('button',{name:'Đăng xuất',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Chọn lượt R1-20261002-0002',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Tải lại danh sách khám',exact:true})).toBeDisabled();
 // Explicit tab focus scrolls the control clear of the sticky topbar.
 await reason.focus();await page.keyboard.press('Tab');await expect(page.getByRole('textbox',{name:'Tiền sử',exact:true})).toBeFocused();
 const focus=await page.locator(':focus').boundingBox(),header=await page.locator('.workspace-topbar').boundingBox();expect(focus!.y).toBeGreaterThanOrEqual(header!.y+header!.height);expect(focus!.y+focus!.height).toBeLessThanOrEqual(size.height);
 await expect(queue).toBeInViewport();
 await page.getByRole('button',{name:'Lưu bản nháp',exact:true}).click();await expect(page.getByRole('button',{name:'Thử lại hồ sơ đang chờ'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Thử lại hồ sơ đang chờ'}).click();await expect(page.getByText('Đã lưu bản nháp phiên bản 2.',{exact:true})).toBeVisible();
 expect(saves).toHaveLength(2);expect(saves[0].key).toBeTruthy();expect(saves[1]).toEqual(saves[0]);await expect(reason).toHaveValue('Synthetic changed note');
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeEnabled();
 await expect.poll(()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;})).toBe(false);
 await page.getByRole('button',{name:'Thu gọn thanh điều hướng'}).click();await expect(page.getByRole('button',{name:'Mở rộng thanh điều hướng'})).toHaveAttribute('aria-expanded','false');
 const nav=page.getByRole('button',{name:'Cài đặt tài khoản',exact:true});await nav.focus();await page.keyboard.press('Enter');
 await expect(page.getByRole('heading',{name:'Tài khoản của tôi',exact:true})).toBeVisible();await expect(page.getByRole('main')).toBeFocused();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);expect(errors).toEqual([]);
 const stored=await page.evaluate(()=>JSON.stringify({...sessionStorage,...localStorage}));expect(stored).not.toContain('Synthetic changed note');expect(stored).not.toContain('synthetic-laptop-token');
});

test('short laptop sidebar and denied view remain reachable at 200% viewport equivalent',async({page})=>{
 await page.route('**/s1/**',async route=>{const url=route.request().url();let json:unknown;if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-short-token'}};else if(url.endsWith('/me/current'))json={userId:'doctor',platformOperator:false};else if(url.endsWith('/me/contexts'))json=[{clinicId:'clinic',role:'DOCTOR',branchIds:['branch']}];else if(url.endsWith('/care-directory'))json={id:'clinic',name:'Synthetic Clinic',branches:[]};else if(url.endsWith('/doctor/worklist')||url.endsWith('/doctor/service-points'))json=[];else throw new Error('Unexpected denied-view source '+url);await route.fulfill({json});});
 for(const size of [{width:1366,height:500},{width:683,height:384}]){
  await page.setViewportSize(size);await page.goto('/workspace?view=doctor');await page.getByLabel('Email',{exact:true}).fill('doctor@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeVisible();await page.evaluate(()=>{history.replaceState(history.state,'','/workspace?view=doctor&clinicId=clinic&state=denied');window.dispatchEvent(new Event('clinic:navigate'));});
  await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cài đặt tài khoản',exact:true}).focus();
  await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(size.width);
 }
});

test('laptop cashier keeps pending money command through exact retry and locks navigation',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 let bill={id:'bill',encounterId:'visit',patientId:'patient',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:0,remainingVnd:100000,status:'ISSUED',version:0,lines:[{chargeId:'charge',sourceType:'ENCOUNTER',sourceId:'visit',name:'Dịch vụ kiểm thử tổng hợp',amountVnd:100000}]};
 const shift={id:'shift',collectorUserId:'cashier',state:'OPEN',version:0,expectedCashVnd:null,expectedBankVnd:null,expectedPosVnd:null,varianceVnd:null};
 const receipt={id:'receipt',billId:'bill',shiftId:'shift',collectorUserId:'cashier',amountVnd:40000,currency:'VND',method:'CASH',externalRef:null,receiptCode:'RCT-LAPTOP-001',createdAt:'2026-10-02T00:00:00Z',label:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'};
 const requests:{body:unknown;key:string|undefined}[]=[];
 await page.route('**/s1/**',async route=>{
  const req=route.request(),url=req.url();let json:unknown;
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-cashier-token'}};
  else if(url.endsWith('/me/current'))json={userId:'cashier'};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'STAFF',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/billing-directory'))json={id:'clinic',name:'Phòng khám kiểm thử tổng hợp',branches:[{id:'branch',name:'Điểm khám tổng hợp',active:true}]};
  else if(url.endsWith('/billable-visits'))json=[{id:'visit',patientId:'patient',appointmentId:null,status:'CLOSED',medicalCaseVersion:7,visitCode:'S2-20261002-0001'}];
  else if(url.endsWith('/bills'))json=[bill];
  else if(url.endsWith('/collection-shifts'))json=[shift];
  else if(url.endsWith('/bills/bill/payments')){
   if(req.method()==='POST'){
    requests.push({body:req.postDataJSON(),key:req.headers()['idempotency-key']});
    if(requests.length===1){bill={...bill,paidVnd:40000,remainingVnd:60000,status:'PARTIALLY_PAID',version:1};await route.fulfill({status:503,json:{message:'Synthetic lost acknowledgement'}});return;}
    json=receipt;
   }else json=requests.length?[receipt]:[];
  }else throw new Error('Unexpected laptop cashier fixture '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=billing');await page.getByLabel('Email',{exact:true}).fill('cashier@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByLabel('Địa điểm thu phí').selectOption('branch');
 await page.getByRole('combobox',{name:'Phiếu thu',exact:true}).selectOption('bill');await page.getByRole('combobox',{name:'Ca thu',exact:true}).selectOption('shift');await page.getByLabel('Lý do lập phiếu hoặc xử lý').fill('Synthetic onsite collection');await page.getByLabel('Số tiền VND',{exact:true}).fill('40000');
 await page.getByRole('button',{name:'Ghi nhận tiền đã nhận',exact:true}).click();await expect(page.getByRole('button',{name:'Thử lại thu phí đang chờ'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Đăng xuất'})).toBeDisabled();await expect(page.getByLabel('Địa điểm thu phí')).toBeDisabled();
 await page.getByRole('button',{name:'Thử lại thu phí đang chờ'}).click();await expect(page.getByRole('heading',{name:receipt.label})).toBeVisible();expect(requests).toHaveLength(2);expect(requests[0].key).toBeTruthy();expect(requests[1]).toEqual(requests[0]);
 await expect(page.getByRole('button',{name:'Cài đặt tài khoản',exact:true})).toBeEnabled();expect(bill.paidVnd).toBe(40000);expect(bill.remainingVnd).toBe(60000);
 await page.getByRole('textbox',{name:'Số tiền VND',exact:true}).focus();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
 await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'cashier-1366.png'),fullPage:true});
});

test('laptop doctor can continue beyond 200 loaded visits after a failed page read',async({page})=>{
 await page.setViewportSize({width:1366,height:768});
 const rows=Array.from({length:225},(_,i)=>({id:'visit-'+i,appointmentId:null,status:'WAITING',version:1,ticket:{id:'ticket-'+i,visitId:'visit-'+i,servicePointId:'point',date:'2026-10-02',number:i+1,code:'Q-'+i,state:'WAITING',version:0}}));
 const cursors:string[]=[];
 await page.route('**/s1/**',async route=>{
  const url=route.request().url();let json:unknown;
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-paging-token'}};
  else if(url.endsWith('/me/current'))json={userId:'doctor',platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'DOCTOR',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/care-directory'))json={id:'clinic',name:'Phòng khám kiểm thử tổng hợp',branches:[{id:'branch',name:'Điểm khám tổng hợp',active:true}]};
  else if(url.endsWith('/me/invitations'))json=[];
  else if(url.endsWith('/doctor/service-points'))json=[];
  else if(url.endsWith('/doctor/worklist'))json=rows.slice(0,200);
  else if(url.includes('/doctor/worklist/page?')){cursors.push(new URL(url).searchParams.get('after')!);if(cursors.length===1){await route.abort('failed');return;}json={items:rows.slice(200),nextAfter:null};}
  else throw new Error('Unexpected paging fixture '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=doctor');await page.getByLabel('Email',{exact:true}).fill('doctor@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập'}).click();await page.getByLabel('Địa điểm khám').selectOption('branch');
 await expect(page.locator('.doctor-queue legend')).toHaveText('Lượt khám đã tải (200)');await page.getByRole('button',{name:'Tải thêm lượt khám'}).click();await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.doctor-queue li')).toHaveCount(200);
 await page.getByRole('button',{name:'Tải thêm lượt khám'}).click();await expect(page.locator('.doctor-queue legend')).toHaveText('Lượt khám đã tải (225)');await expect(page.locator('.doctor-queue li')).toHaveCount(225);await expect(page.getByRole('button',{name:'Tải thêm lượt khám'})).toHaveCount(0);await expect(page.getByRole('button',{name:'Chọn lượt Q-224',exact:true})).toBeVisible();expect(cursors).toEqual(['visit-199','visit-199']);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
});
