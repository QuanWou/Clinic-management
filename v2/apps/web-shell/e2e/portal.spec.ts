import { test, expect } from '@playwright/test';
import path from 'node:path';
const evidence=path.resolve('../../../docs/audits/clinic-v2/P05-S5/verification');
test('patient sees linked unpublished-clinic history and own internal receipts on desktop/mobile, then loses data on revoke',async({page})=>{
 let revoked=false;const requests: string[]=[];
 const bill={id:'bill-a',currency:'VND',subtotalVnd:100000,adjustmentVnd:0,paidVnd:40000,remainingVnd:60000,status:'PARTIALLY_PAID',issuedAt:'2026-10-01T14:00:00Z',lines:[{name:'Synthetic performed service',amountVnd:100000}],receipts:[{id:'receipt-a',amountVnd:40000,currency:'VND',method:'CASH',receiptCode:'RCT-11111111-2222-3333-4444-555555555555',createdAt:'2026-10-01T14:00:00Z',label:'BIÊN NHẬN NỘI BỘ — KHÔNG PHẢI HÓA ĐƠN THUẾ'}]};
 await page.route('**/s1/**',async route=>{
  const url=route.request().url();requests.push(url);let json:unknown={};
  if(url.endsWith('/auth/login'))json={data:{accessToken:'synthetic-patient-token'}};
  else if(url.endsWith('/me/current'))json={userId:'fixture-user',legacyRoles:['ROLE_USER'],platformOperator:false};
  else if(url.endsWith('/me/contexts'))json=[];
  else if(url.includes('/public/clinics?page='))json={content:[],totalElements:0};
  else if(url.endsWith('/patient-profile'))json={patientId:'patient-a',fullName:'Synthetic Patient',dateOfBirth:'1990-01-01',sex:'',phone:'',email:'',version:0};
  else if(url.endsWith('/me/patient-clinics'))json=[{clinicId:'clinic-a',name:'Synthetic unpublished clinic',branches:[{branchId:'branch-a',name:'Synthetic historical branch',active:false}]}];
  else if(url.includes('/me/appointments?'))json=[{id:'appointment-a',appointmentCode:'AP-SYN',status:'FULFILLED',startsAt:'2026-10-01T01:00:00Z'}];
  else if(url.endsWith('/me/clinics/clinic-a/branches/branch-a/bills')){if(revoked){await route.fulfill({status:404,json:{error:{code:'NOT_FOUND',message:'Synthetic link revoked'}}});return;}json=[bill];}
  await route.fulfill({json});
 });
 await page.setViewportSize({width:1440,height:1000});await page.goto('/public/account');await page.getByRole('button',{name:'Đăng nhập tài khoản',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('synthetic-password');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.getByRole('button',{name:'Tải phòng khám có hồ sơ của tôi'}).click();await page.getByLabel('Phòng khám trong lịch sử').selectOption('clinic-a');await expect(page.getByText('Đã hoàn tất lượt khám',{exact:false})).toBeVisible();await page.getByLabel('Chi nhánh trong lịch sử').selectOption('branch-a');
 await page.getByRole('button',{name:'Tải khoản phải thu của tôi'}).click();await expect(page.getByText('Đã thu một phần')).toBeVisible();await page.getByText(/RCT-11111111/).click();await expect(page.getByText(bill.receipts[0].label)).toBeVisible();
 await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'patient-portal-desktop.png'),fullPage:true});await page.setViewportSize({width:375,height:812});expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await page.evaluate(()=>{if(document.activeElement instanceof HTMLElement)document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.join(evidence,'patient-portal-mobile.png'),fullPage:true});
 expect(requests.some(u=>u.includes('/public/search'))).toBe(false);expect(requests.some(u=>u.includes('/bills')&&u.includes('patientId='))).toBe(false);expect(await page.evaluate(()=>JSON.stringify([localStorage,sessionStorage]))).not.toContain('synthetic-patient-token');
 revoked=true;await page.getByRole('button',{name:'Tải khoản phải thu của tôi'}).click();await expect(page.getByText('Synthetic link revoked')).toBeVisible();await expect(page.getByText('Synthetic performed service')).toHaveCount(0);await expect(page.getByText(/RCT-11111111/)).toHaveCount(0);
 await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await expect(page.getByRole('heading',{name:'Lịch sử tại phòng khám của tôi'})).toHaveCount(0);
});
