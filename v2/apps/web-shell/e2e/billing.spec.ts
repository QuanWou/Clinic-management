import { test,expect } from '@playwright/test';
import path from 'node:path';
const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S4/verification');
test('cashier records partial onsite tender, prints an internal receipt and submits counted shift on desktop/mobile',async({page})=>{
 let bill={id:'bill',encounterId:'visit',patientId:'patient',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:0,remainingVnd:100000,status:'ISSUED',version:0,lines:[{chargeId:'charge',sourceType:'MEDICAL_ORDER',sourceId:'order',name:'Synthetic performed lab',amountVnd:100000}]};
 let shift:any=null;const receipts:any[]=[];const writes:{url:string;key:string|undefined;body:any}[]=[];
 await page.route('**/s1/**',async route=>{
  const req=route.request(),url=req.url(),body=req.postDataJSON();let json:any={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-cashier-token'}};
  else if(url.endsWith('/me/current'))json={userId:'cashier'};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'CASHIER',allBranches:false,branchIds:['branch'],version:1}];
  else if(url.endsWith('/billing-directory'))json={id:'clinic',name:'Synthetic Clinic',branches:[{id:'branch',name:'Synthetic Branch',active:true}]};
  else if(url.endsWith('/billable-visits'))json=[{id:'visit',patientId:'patient',appointmentId:null,status:'CLOSED',medicalCaseVersion:7,visitCode:'S2-20261001-0001'}];
  else if(url.endsWith('/bills')){if(req.method()==='POST'){expect(body.encounterId).toBe('visit');writes.push({url,key:req.headers()['idempotency-key'],body});json=bill;}else json=[bill];}
  else if(url.endsWith('/collection-shifts')){if(req.method()==='POST'){writes.push({url,key:req.headers()['idempotency-key'],body});shift={id:'shift',collectorUserId:'cashier',state:'OPEN',version:0,expectedCashVnd:null,expectedBankVnd:null,expectedPosVnd:null,varianceVnd:null};json=shift;}else json=shift?[shift]:[];}
  else if(url.endsWith('/bills/bill/payments')){
   if(req.method()==='POST'){expect(body.expectedVersion).toBe(bill.version);expect(body.amountVnd).toBe(40000);expect(body.method).toBe('CASH');expect(body.shiftId).toBe('shift');writes.push({url,key:req.headers()['idempotency-key'],body});bill={...bill,paidVnd:40000,remainingVnd:60000,status:'PARTIALLY_PAID',version:1};const receipt={id:'receipt',billId:'bill',shiftId:'shift',collectorUserId:'cashier',amountVnd:40000,currency:'VND',method:'CASH',externalRef:null,receiptCode:'RCT-SYN-001',createdAt:'2026-10-01T14:00:00Z',label:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'};receipts.push(receipt);json=receipt;}else json=receipts;
  }else if(url.endsWith('/collection-shifts/shift/submit')){expect(body.declaredCashVnd).toBe(39900);expect(body.expectedVersion).toBe(0);writes.push({url,key:req.headers()['idempotency-key'],body});shift={...shift,state:'SUBMITTED',version:1,expectedCashVnd:40000,expectedBankVnd:0,expectedPosVnd:0,declaredCashVnd:39900,declaredBankVnd:0,declaredPosVnd:0,varianceVnd:-100};json=shift;}
  else throw new Error('Unexpected billing fixture route '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=billing');await page.getByLabel('Email',{exact:true}).fill('cashier@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByLabel('Địa điểm thu phí').selectOption('branch');
 await page.getByLabel('Lý do lập phiếu hoặc xử lý').fill('Synthetic onsite operation');await page.getByLabel('Lượt khám đã hoàn tất').selectOption('visit');await page.getByRole('button',{name:'Lập phiếu thu từ dịch vụ thực',exact:true}).click();await expect(page.getByRole('heading',{name:'Khoản phải thu'})).toBeVisible();await page.getByRole('button',{name:'Mở ca thu của tôi',exact:true}).click();
 await page.getByLabel('Số tiền VND',{exact:true}).fill('40000');await page.getByRole('button',{name:'Ghi nhận tiền đã nhận',exact:true}).click();await expect(page.getByRole('heading',{name:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'})).toBeVisible();await expect(page.getByRole('button',{name:'Duyệt giảm khoản phải thu'})).toHaveCount(0);
 await page.getByLabel('Tiền mặt kiểm đếm VND').fill('39900');await page.getByRole('button',{name:'Gửi chốt ca',exact:true}).click();await expect(page.getByText(/Chênh lệch kiểm đếm/)).toBeVisible();await expect(page.getByRole('button',{name:'Duyệt chốt ca và chênh lệch'})).toHaveCount(0);
 await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'cashier-desktop.png'),fullPage:true});
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);await page.evaluate(()=>{(document.activeElement as HTMLElement)?.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'cashier-mobile.png'),fullPage:true});
 await page.emulateMedia({media:'print'});await expect(page.getByRole('heading',{name:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'})).toBeVisible();await expect(page.getByLabel('Lý do lập phiếu hoặc xử lý')).toBeHidden();await page.screenshot({path:path.join(evidence,'cashier-print.png'),fullPage:true});await page.emulateMedia({media:'screen'});
 expect(writes.every(w=>!!w.key)).toBe(true);expect(writes.filter(w=>w.url.endsWith('/payments'))).toHaveLength(1);const storage=await page.evaluate(()=>JSON.stringify({...sessionStorage,...localStorage}));expect(storage).not.toContain('synthetic-cashier-token');expect(storage).not.toContain('Synthetic onsite operation');
});
