import { test,expect } from '@playwright/test';
import path from 'node:path';
test('manager retries only the unchanged notification request after an unknown response and patient sees fixed preview copy',async({page})=>{
 let recovered=false;const retries:{key:string|undefined;body:unknown}[]=[];
 let bill={id:'bill',encounterId:'visit',patientId:'patient',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:40000,remainingVnd:60000,status:'PARTIALLY_PAID',version:1,lines:[{chargeId:'charge',sourceType:'MEDICAL_ORDER',sourceId:'order',name:'Synthetic performed service',amountVnd:100000}]};
 const preview='Phòng khám đã ghi nhận một khoản thu tại quầy. Xem biên nhận nội bộ trong lịch sử của bạn.';
 await page.route('**/s1/**',async route=>{
  const request=route.request(),url=request.url();let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-active-token'}};
  else if(url.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}];
  else if(url.endsWith('/me/current'))json={userId:'manager'};
  else if(url.endsWith('/billing-directory'))json={id:'clinic',name:'Synthetic clinic',branches:[{id:'branch',name:'Synthetic branch',active:true}]};
  else if(url.endsWith('/billable-visits')||url.endsWith('/collection-shifts')||url.endsWith('/payments'))json=[];
  else if(url.endsWith('/bills'))json=[bill];
  else if(url.endsWith('/notification-deliveries'))json={pending:0,delivered:recovered?1:0,manualContact:0,failed:recovered?0:1};
  else if(url.endsWith('/notification-deliveries/retry')){
   retries.push({key:request.headers()['idempotency-key'],body:request.postDataJSON()});
   if(retries.length===1){await route.fulfill({status:503,json:{error:{message:'Synthetic acknowledgement unavailable'}}});return;}
   recovered=true;bill={...bill,version:2};json={pending:1,delivered:0,manualContact:0,failed:0};
  }else if(url.includes('/public/clinics?page='))json={content:[],totalElements:0};
  else if(url.endsWith('/patient-profile'))json={patientId:'patient',fullName:'Synthetic Patient',dateOfBirth:'1990-01-01',version:0};
  else if(url.endsWith('/me/notifications'))json=[{id:'notification',kind:'PAYMENT_RECORDED',message:preview,created_at:'2026-10-02T00:00:00Z'}];
  else if(url.endsWith('/notification-preferences'))json={remindersEnabled:false};
  else throw new Error('Unexpected financial notification fixture route '+url);
  await route.fulfill({json});
 });
 await page.goto('/workspace?view=billing');await page.getByLabel('Email',{exact:true}).fill('manager@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByLabel('Địa điểm thu phí').selectOption('branch');await page.getByRole('combobox',{name:'Phiếu thu',exact:true}).selectOption('bill');await page.getByText('Trạng thái gửi biên nhận',{exact:true}).click();
 await page.getByRole('button',{name:'Kiểm tra trạng thái thông báo'}).click();await expect(page.getByRole('button',{name:'Yêu cầu giao lại thông báo'})).toBeDisabled();await page.getByLabel('Lý do lập phiếu hoặc xử lý').fill('Synthetic verified delivery recovery');await page.getByRole('button',{name:'Yêu cầu giao lại thông báo'}).click();await expect(page.getByRole('button',{name:'Thử lại thu phí đang chờ'})).toBeVisible();await expect(page.getByLabel('Lý do lập phiếu hoặc xử lý')).toBeDisabled();await page.getByRole('button',{name:'Thử lại thu phí đang chờ'}).click();await expect(page.getByRole('button',{name:'Thử lại thu phí đang chờ'})).toHaveCount(0);expect(retries).toHaveLength(2);expect(retries[0]).toEqual(retries[1]);expect(bill.paidVnd).toBe(40000);expect(bill.remainingVnd).toBe(60000);
 await page.getByRole('button',{name:'Kiểm tra trạng thái thông báo'}).click();await expect(page.getByText('Đã ghi vào thông báo trong ứng dụng: 1')).toBeVisible();
 await page.goto('/public/account');await page.getByRole('button',{name:'Đăng nhập tài khoản',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('patient@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.getByRole('button',{name:'Tải thông báo và lựa chọn nhắc lịch'}).click();await expect(page.getByText(preview,{exact:false})).toBeVisible();expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('synthetic-active-token');
 await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.getByRole('heading',{name:'Thông báo của tôi'}).scrollIntoViewIfNeeded();await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});await page.screenshot({path:path.resolve('../../../docs/audits/clinic-v2/P05-S5/financial-verification/financial-preview-mobile.png')});
});
