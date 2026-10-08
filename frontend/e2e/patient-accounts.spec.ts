import {test,expect} from '@playwright/test';
import path from 'node:path';

test('admin manages patient accounts on desktop and mobile',async({page})=>{
 let account={id:'patient-account',fullName:'Nguyễn An',email:'patient@example.invalid',phone:'0901234567',accountCode:'TK000012',status:'ACTIVE',createdAt:'2026-10-01T08:00:00',updatedAt:'2026-10-01T08:00:00'};
 let statusWrites=0,profileWrites=0;
 const clinic={id:'clinic',ownerUserId:'admin',name:'Phòng khám kiểm thử',slug:'clinic',reviewStatus:'APPROVED',publicationStatus:'PUBLISHED',evidenceVerified:true,version:1,branches:[{id:'branch',name:'Cơ sở',active:true,address:'Địa chỉ kiểm thử',openingHours:'08-17'}]};
 await page.route('**/s1/**',async route=>{
  const request=route.request(),url=new URL(request.url()),pathname=url.pathname;let json:unknown=[];
  if(pathname.endsWith('/auth/refresh')){await route.fulfill({status:401,json:{}});return;}
  if(pathname.endsWith('/auth/login'))json={data:{accessToken:'fixture-admin-token',email:'admin@example.invalid'}};
  else if(pathname.endsWith('/me/current'))json={userId:'admin',legacyRoles:['ROLE_PATIENT'],platformOperator:false};
  else if(pathname.endsWith('/me/contexts'))json=[{membershipId:'m',clinicId:'clinic',role:'ADMIN',allBranches:true,branchIds:[],version:1}];
  else if(pathname.endsWith('/clinics/mine'))json=[clinic];
  else if(pathname.endsWith('/clinics/clinic'))json=clinic;
  else if(pathname.includes('/clinic-patient-accounts/')){
   if(request.method()==='PATCH'){statusWrites++;account={...account,status:request.postDataJSON().status};json=account;}
   else if(request.method()==='PUT'){profileWrites++;account={...account,...request.postDataJSON()};json=account;}
   else if(pathname.endsWith('/patient-account'))json=account;
   else json={content:[account],totalElements:1,totalPages:1,number:0,size:20};
  }
  await route.fulfill({json});
 });
 await page.setViewportSize({width:1440,height:960});await page.goto('/workspace?view=customers&clinicId=clinic');
 await page.getByLabel('Email',{exact:true}).fill('admin@example.invalid');await page.getByLabel('Mật khẩu',{exact:true}).fill('Fixture!123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Tài khoản bệnh nhân',exact:true})).toBeVisible();
 await expect(page.getByRole('table',{name:'Tài khoản bệnh nhân'})).toBeVisible();
 await page.screenshot({path:path.resolve('../.runtime/main/patient-accounts-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:path.resolve('../.runtime/main/patient-accounts-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Quản lý tài khoản Nguyễn An'}).click();
 await page.getByLabel('Số điện thoại').fill('0909999999');
 await expect(page.getByRole('button',{name:'Về danh sách'})).toBeDisabled();
 await page.getByRole('button',{name:'Lưu thông tin tài khoản'}).click();
 await expect(page.getByText('Đã lưu thay đổi.')).toBeVisible();expect(profileWrites).toBe(1);
 await page.getByRole('button',{name:'Khóa tài khoản',exact:true}).click();expect(statusWrites).toBe(0);
 await page.getByRole('dialog').getByRole('button',{name:'Khóa tài khoản',exact:true}).click();
 await expect(page.getByText('Đã khóa',{exact:true})).toBeVisible();expect(statusWrites).toBe(1);
 await page.screenshot({path:path.resolve('../.runtime/main/patient-accounts-detail-mobile.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
